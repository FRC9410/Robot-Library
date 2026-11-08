import rebuiltImage from "./wpilib/2026-rebuilt.png";
import reefscapeImage from "./wpilib/2025-reefscape.png";
import rebuiltWelded from "./wpilib/2026-rebuilt-welded.json";
import reefscapeWelded from "./wpilib/2025-reefscape-welded.json";
import { rebuiltDrawing } from "./rebuiltDrawing";
import type { DrawingRect } from "./rebuiltDrawing";
import { uploadedFieldId, validateUploadedField } from "../../../electron/uploadedField";
import type { UploadedField } from "../../../electron/uploadedField";

/** WPILib field definition: image corner calibration, field size and the official AprilTag layout. */
type WpilibField = {
  name: string;
  "field-image": { top: number; left: number; bottom: number; right: number };
  "field-dimensions": { length: number; width: number };
  "field-tags": { ID: number; pose: { translation: { x: number; y: number; z: number }; rotation: { quaternion: { W: number; X: number; Y: number; Z: number } } } }[];
};

/** `z` is the height of the tag's center and `yaw` the direction its face looks; every 2026 tag is vertical. */
export type FieldTag = { id: number; x: number; y: number; z: number; yaw: number };
export type FieldLayout = {
  id: string;
  label: string;
  length: number;
  width: number;
  /** Either the calibrated WPILib image or a simplified drawing from the official dimensions. */
  image?: { href: string; pixelWidth: number; pixelHeight: number; top: number; left: number; bottom: number; right: number; rotate180: boolean };
  drawing?: DrawingRect[];
  tags: FieldTag[];
};

// Pixel sizes of the WPILib PNGs; `npm run check:fields` verifies them against the files.
const rebuiltPng = { href: rebuiltImage, pixelWidth: 4196, pixelHeight: 2035 };
const reefscapePng = { href: reefscapeImage, pixelWidth: 4000, pixelHeight: 1927 };

function layout(id: string, label: string, field: WpilibField, backdrop: Pick<FieldLayout, "image" | "drawing">): FieldLayout {
  return {
    id,
    label,
    length: field["field-dimensions"].length,
    width: field["field-dimensions"].width,
    ...backdrop,
    tags: field["field-tags"].map(({ ID, pose: { translation, rotation: { quaternion: q } } }) => ({
      id: ID,
      x: translation.x,
      y: translation.y,
      z: translation.z,
      yaw: Math.atan2(2 * (q.W * q.Z + q.X * q.Y), 1 - 2 * (q.Y * q.Y + q.Z * q.Z)) * 180 / Math.PI
    }))
  };
}

// Welded perimeter only: it matches the official drawings, Championship fields and the robot's
// AprilTagFields.k2026RebuiltWelded. AndyMark fields differ by about 2 cm.
// The 2026 image is drawn from the scoring table side with red on the left, as in FE-2026. REBUILT is
// rotationally symmetric, so turning it 180° about the field center gives the blue-origin view without
// moving any geometry.
export const fieldLayouts: FieldLayout[] = [
  layout("2026-rebuilt-simplified", "2026 REBUILT (Simplified)", rebuiltWelded, { drawing: rebuiltDrawing }),
  layout("2026-rebuilt", "2026 REBUILT (Field image)", rebuiltWelded, { image: { ...rebuiltPng, ...rebuiltWelded["field-image"], rotate180: true } }),
  layout("2025-reefscape", "2025 REEFSCAPE (Field image)", reefscapeWelded, { image: { ...reefscapePng, ...reefscapeWelded["field-image"], rotate180: false } })
];

export const noFieldLayout = "none";
const storageKey = "powerlib.fieldLayout.v1";
const listeners = new Set<() => void>();
let uploadedField: FieldLayout | null = null;
let loadingUpload: Promise<void> | undefined;

function asLayout(field: UploadedField): FieldLayout {
  return { id: uploadedFieldId, label: field.label, length: field.length, width: field.width,
    image: { ...field.image, top: 0, left: 0, bottom: field.image.pixelHeight, right: field.image.pixelWidth }, tags: [] };
}

export function getUploadedField() { return uploadedField; }
export function getFieldLayout() {
  return fieldLayouts.find(candidate => candidate.id === currentId) ?? (currentId === uploadedFieldId ? uploadedField : null);
}

function notify() {
  window.powerlib?.setFieldLayoutMenu?.(currentId, uploadedField !== null);
  listeners.forEach(listener => listener());
}

export function loadUploadedField(): Promise<void> {
  return loadingUpload ??= (async () => {
    if (!window.powerlib?.readUploadedField) return;
    const field = await window.powerlib.readUploadedField();
    uploadedField = field ? asLayout(validateUploadedField(field)) : null;
    if (!uploadedField && currentId === uploadedFieldId) setFieldLayoutId(noFieldLayout);
    else notify();
  })();
}

export async function saveFieldUpload(field: UploadedField) {
  if (!window.powerlib?.saveUploadedField) throw Error("Saving uploaded fields requires the Power Tool app.");
  // Let startup finish before replacing its result, including recovery from an unreadable old upload.
  await loadUploadedField().catch(() => {});
  const saved = await window.powerlib.saveUploadedField(validateUploadedField(field));
  uploadedField = asLayout(validateUploadedField(saved));
  setFieldLayoutId(uploadedFieldId);
}

export async function removeFieldUpload() {
  if (!window.powerlib?.removeUploadedField) throw Error("Removing uploaded fields requires the Power Tool app.");
  await loadUploadedField().catch(() => {});
  await window.powerlib.removeUploadedField();
  uploadedField = null;
  if (currentId === uploadedFieldId) setFieldLayoutId(noFieldLayout);
  else notify();
}

function readStoredId() {
  try {
    const id = localStorage.getItem(storageKey);
    return id === uploadedFieldId || fieldLayouts.some(candidate => candidate.id === id) ? id! : noFieldLayout;
  } catch {
    return noFieldLayout;
  }
}

let currentId = readStoredId();

export function getFieldLayoutId() {
  return currentId;
}

/** Selects a layout from the View menu; unknown ids fall back to the plain grid. */
export function setFieldLayoutId(id: string) {
  currentId = (id === uploadedFieldId && uploadedField) || fieldLayouts.some(candidate => candidate.id === id) ? id : noFieldLayout;
  try { localStorage.setItem(storageKey, currentId); } catch { /* Keep the session choice if storage is unavailable. */ }
  notify();
}

/** Calls `listener` when the View → Field Layout choice changes; returns the unsubscribe. */
export function subscribeFieldLayout(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) window.removeEventListener("storage", onStorage);
  };
}

function onStorage(event: StorageEvent) {
  if (event.key !== storageKey && event.key !== null) return;
  currentId = readStoredId();
  notify();
}
