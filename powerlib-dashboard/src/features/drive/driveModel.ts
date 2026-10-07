import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import template from "./drive-template.json";

export { template };
export type DriveKey = keyof typeof template.topics;
export type DriveCamera = { id: string; name: string; urls: string[]; connected?: boolean };
export type AutoChooser = { path: string; name: string; options: string[]; active?: string; selected?: string; default?: string; controllable: boolean };

export function streamUrl(value: string): string | undefined {
  try {
    const url = new URL(value.replace(/^mjp(?:e)?g:/i, ""));
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}

export function discoverCameras(topics: NtTopicSnapshot[]): DriveCamera[] {
  const cameras: DriveCamera[] = [];
  for (const topic of topics) {
    const match = /^\/CameraPublisher\/(.+)\/streams$/.exec(topic.name);
    if (!match || !Array.isArray(topic.value)) continue;
    const urls = [...new Set(topic.value.filter((v): v is string => typeof v === "string")
      .map(streamUrl).filter((v): v is string => !!v))];
    if (!urls.length) continue;
    const connected = topics.find(t => t.name === `/CameraPublisher/${match[1]}/connected`)?.value;
    cameras.push({ id: match[1], name: match[1], urls, connected: typeof connected === "boolean" ? connected : undefined });
  }
  // Limelights may not publish CameraPublisher streams. Only infer their conventional
  // MJPEG address from an explicitly named Limelight with a published heartbeat.
  for (const topic of topics) {
    const match = /^\/(limelight(?:-[a-z0-9-]+)?)\/(?:hb|heartbeat)$/.exec(topic.name);
    if (!match || typeof topic.value !== "number" || cameras.some(c => c.id === match[1])) continue;
    cameras.push({ id: match[1], name: match[1], urls: [`http://${match[1]}.local:5800/`] });
  }
  return cameras.sort((a, b) => a.name.localeCompare(b.name));
}

// AutoBuilder owns alliance filtering and publishes the exact available options.
export const powerLibAutoChooserPath = "/SmartDashboard/Auto Chooser";
export function getPowerLibAutoChooser(topics: NtTopicSnapshot[]): AutoChooser | undefined {
  const path = powerLibAutoChooserPath;
  const get = (key: string) => topics.find(topic => topic.name === `${path}/${key}`)?.value;
  const options = get("options");
  if (get(".type") !== "String Chooser" || !Array.isArray(options)
      || !options.every(v => typeof v === "string") || !options.length) return undefined;
  const text = (key: string) => typeof get(key) === "string" ? get(key) as string : undefined;
  return { path, name: "Auto Chooser", options: [...new Set(options as string[])],
    active: text("active"), selected: text("selected"), default: text("default"), controllable: get(".controllable") !== false };
}

export function driveModel(topics: NtTopicSnapshot[], connected: boolean, now: number) {
  const byName = new Map(topics.map(topic => [topic.name, topic]));
  const topic = (key: DriveKey) => template.topics[key].map(name => byName.get(name)).find(Boolean);
  const value = (key: DriveKey) => topic(key)?.value;
  const number = (key: DriveKey) => typeof value(key) === "number" && Number.isFinite(value(key)) ? value(key) as number : undefined;
  const boolean = (key: DriveKey) => typeof value(key) === "boolean" ? value(key) as boolean : undefined;
  const text = (key: DriveKey) => typeof value(key) === "string" ? value(key) as string : undefined;
  const heartbeat = topic("heartbeat");
  const live = connected && heartbeat?.receivedAt !== undefined && now - heartbeat.receivedAt < 1200;
  const moduleMap = new Map<string, boolean | undefined>();
  for (const prefix of template.modulePrefixes) {
    for (const entry of topics) {
      if (!entry.name.startsWith(prefix) || !entry.name.endsWith("/Connected")) continue;
      const name = entry.name.slice(prefix.length, -"/Connected".length);
      if (!name || name.includes("/") || moduleMap.has(name)) continue;
      moduleMap.set(name, live && typeof entry.value === "boolean" ? entry.value : undefined);
    }
  }
  const moduleOrder = ["FL", "FR", "BL", "BR"];
  const modules = [...moduleMap].map(([name, connected]) => ({ name, connected })).sort((a, b) => {
    const index = (name: string) => moduleOrder.includes(name) ? moduleOrder.indexOf(name) : moduleOrder.length;
    return index(a.name) - index(b.name) || a.name.localeCompare(b.name);
  });
  const healthSignals = [...(topic("gyro") ? [boolean("gyro")] : []), ...modules.map(module => module.connected)];
  const health = !live ? "unknown" : boolean("poseValid") === false || boolean("speedsValid") === false
    || healthSignals.some(value => value === false) ? "fault"
    : healthSignals.length && healthSignals.every(value => value === true) ? "healthy" : "unknown";
  let pose: { x: number; y: number; heading: number } | undefined;
  const [x, y, heading] = [number("x"), number("y"), number("heading")];
  if (x !== undefined && y !== undefined && heading !== undefined && boolean("poseValid") !== false) pose = { x, y, heading };
  if (!pose && boolean("poseValid") !== false) {
    const fieldPose = byName.get("/SmartDashboard/Field/Robot")?.value;
    if (Array.isArray(fieldPose) && fieldPose.length === 3 && fieldPose.every(v => typeof v === "number" && Number.isFinite(v))) {
      pose = { x: fieldPose[0] as number, y: fieldPose[1] as number, heading: fieldPose[2] as number };
    }
    const struct = byName.get("/Robot/Pose");
    if (!pose && struct?.type === "struct:Pose2d" && struct.value instanceof ArrayBuffer && struct.value.byteLength === 24) {
      const data = new DataView(struct.value);
      const values = [data.getFloat64(0, true), data.getFloat64(8, true), data.getFloat64(16, true) * 180 / Math.PI];
      if (values.every(Number.isFinite)) pose = { x: values[0], y: values[1], heading: values[2] };
    }
  }
  // Without the helper, stationary legacy pose data has no reliable loop heartbeat.
  // Show it as an unverified pose; never use it to unlock autonomous selection.
  const poseFresh = live || (connected && !heartbeat && [topic("x"), byName.get("/Robot/Pose"), byName.get("/SmartDashboard/Field/Robot")]
    .some(t => t?.receivedAt !== undefined && now - t.receivedAt < 1200));
  return { topic, number, boolean, text, live, modules, health, pose: poseFresh ? pose : undefined,
    poseSupported: !!topic("x") || byName.has("/Robot/Pose") || byName.has("/SmartDashboard/Field/Robot"),
    canSelectAuto: live && boolean("enabled") === false };
}

export function formatTime(seconds: number | undefined): string {
  if (seconds === undefined || seconds < 0) return "—:—";
  const rounded = Math.ceil(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}
