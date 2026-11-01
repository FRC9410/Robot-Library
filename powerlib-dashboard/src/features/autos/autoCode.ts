// Writes GeneratedAutos.java for File → Update Code, which covers every tab.
import { template } from "../drive/driveModel";
import { fieldLayouts, getFieldLayoutId } from "../field/fieldLayouts";
import { generateAutosJava, hasErrors, parseAutoDocument, validateAutos } from "./autoModel";
import type { AutoProject } from "./autoModel";

/** The field the Auto Builder uses: the View → Field Layout choice, else the Drive crew tools size. */
export function autoFieldSize() {
  const layout = fieldLayouts.find(candidate => candidate.id === getFieldLayoutId());
  if (layout) return { length: layout.length, width: layout.width };
  const fallback = { length: template.field.lengthMeters, width: template.field.widthMeters };
  try {
    const value = JSON.parse(localStorage.getItem("powerlib.driveDisplay.v1") || "{}");
    return { length: Number.isFinite(value.length) && value.length > 0 ? value.length : fallback.length,
      width: Number.isFinite(value.width) && value.width > 0 ? value.width : fallback.width };
  } catch {
    return fallback;
  }
}

/** What the generator needs to know about the robot project, from what Power Tool read from it. */
export function autoProject(state: { states: string[]; driveCommandInstalled: boolean | null; robotAutosStrings?: string[]; checks?: string[] },
  field = autoFieldSize()): AutoProject {
  return { states: state.states, driveCommandInstalled: state.driveCommandInstalled, field, handWrittenNames: state.robotAutosStrings ?? [], checks: state.checks };
}

// The Auto Builder autosaves after a short pause; Update Code flushes it first.
let pendingSave: (() => Promise<void>) | null = null;
export function setPendingAutoSave(flush: (() => Promise<void>) | null) { pendingSave = flush; }

/** Returns a short result message, or null when the project has no autos to write. */
export async function writeGeneratedAutos(): Promise<string | null> {
  const api = window.powerlib;
  if (!api?.readAutos) return null;
  await pendingSave?.();
  const state = await api.readAutos();
  const document = parseAutoDocument(state.document);
  if (!document.autos.length && state.robotAutosHooked !== false) return null;
  const project = autoProject(state);
  const issues = validateAutos(document, project);
  if (hasErrors(issues)) {
    const first = issues.find(issue => issue.severity === "error")!;
    const auto = document.autos.find(candidate => candidate.id === first.autoId);
    throw new Error(`Autos not written: ${auto?.name ? `"${auto.name}": ` : ""}${first.message}`);
  }
  const result = await api.updateAutoCode(document, generateAutosJava(document, project));
  window.dispatchEvent(new Event("powerlib:autos-written"));
  return `Wrote ${document.autos.length} auto${document.autos.length === 1 ? "" : "s"} to GeneratedAutos.java${result.hookAdded ? " and registered them in RobotAutos.java" : ""}.`;
}
