import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { ConstantRow, ConstantsFile } from "../constants/types";
import { constantValueForEditor, constantValueFromEditor } from "../constants/types";
import { getWritableTopicType, isTunableTopic, parseDraftValue, topicValueToDraft } from "../networktables/tuningUtils";
import type { GeneratedSubsystem } from "../subsystems/types";
import { stringifyValue } from "../subsystems/subsystemUtils";

export type TuningGroup = { key: string; owner: string; kind: "subsystem" | "command" };
export type RobotCard = TuningGroup & {
  name: string;
  type: string;
  metrics: { label: string; value: string }[];
  tunableCount: number;
  constantsFile?: ConstantsFile;
};

function topicKey(name: string) {
  return name.split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1)).join("");
}

export function formatLabel(value: string) {
  return value.split("/").map(segment => /^k[A-Z]$/.test(segment) ? segment
    : segment.replace(/_/g, " ").replace(/([a-z0-9])([A-Z])/g, "$1 $2")).join(" / ");
}

export function formatValue(value: NtTopicSnapshot["value"]) {
  return typeof value === "number" ? String(Number(value.toFixed(4))) : stringifyValue(value);
}

export function parseTuningGroup(name: string): (TuningGroup & { variable: string }) | null {
  const match = /^\/PowerLib\/(Subsystems|Commands)\/([^/]+)\/Variables\/(.+)$/.exec(name);
  if (!match) return null;
  const kind = match[1] === "Subsystems" ? "subsystem" : "command";
  return { key: `${kind}:${match[2]}`, owner: match[2], kind, variable: match[3] };
}

export function groupTunables(topics: NtTopicSnapshot[]) {
  const groups = new Map<string, NtTopicSnapshot[]>();
  for (const topic of topics) {
    const group = parseTuningGroup(topic.name);
    if (!group || !isTunableTopic(topic)) continue;
    const variables = groups.get(group.key) ?? [];
    variables.push(topic);
    groups.set(group.key, variables);
  }
  for (const variables of groups.values()) variables.sort((a, b) => a.name.localeCompare(b.name));
  return groups;
}

export type TuningValue = {
  id: string;
  label: string;
  baseline: string;
  topic?: NtTopicSnapshot;
  constant?: ConstantRow;
};

function constantForTopic(topic: NtTopicSnapshot, file?: ConstantsFile) {
  const variable = parseTuningGroup(topic.name)?.variable;
  if (!file || !variable) return undefined;
  let constantName = variable.startsWith("Custom/") ? variable.slice("Custom/".length) : "";
  if (!constantName && file.id === "robot:Swerve") {
    constantName = variable.split("/").map(segment => segment === "Requests" ? "REQUEST"
      : /^k[A-Z]$/.test(segment) ? segment.toUpperCase()
        : segment.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()).join("_");
  }
  return file.constants.find(row => row.name === constantName);
}

/** Live and saved values share one list; a published constant replaces its saved-value row. */
export function createTuningValues(topics: NtTopicSnapshot[], file?: ConstantsFile): TuningValue[] {
  const values = new Map<string, TuningValue>();
  if (file && !file.error) for (const constant of file.constants) {
    const id = `${file.id}:${constant.name}`;
    values.set(id, { id, label: formatLabel(constant.name), baseline: constantValueForEditor(constant), constant });
  }
  for (const topic of topics) {
    const constant = constantForTopic(topic, file);
    const id = constant ? `${file!.id}:${constant.name}` : topic.name;
    values.set(id, { id, label: constant ? formatLabel(constant.name)
      : formatLabel(parseTuningGroup(topic.name)!.variable), baseline: topicValueToDraft(topic.value), topic, constant });
  }
  return [...values.values()].sort((a, b) => a.label.localeCompare(b.label));
}

export function parseTuningValue(value: TuningValue, draft: string) {
  // A live custom integer/float still has to fit its declared Java type.
  const saved = value.constant ? constantValueFromEditor(draft, value.constant.type) : undefined;
  const type = value.topic ? getWritableTopicType(value.topic)! : undefined;
  return { saved, type, live: type ? parseDraftValue(type, draft) : undefined };
}

/** Merge project configuration and live discovery, then append groups without subsystem data. */
export function createRobotCards(subsystems: GeneratedSubsystem[], data: NtTopicSnapshot[],
  tunables: NtTopicSnapshot[], files: ConstantsFile[]): RobotCard[] {
  const cards = new Map<string, RobotCard>();
  const makeCard = (owner: string, name: string, type: string, kind: TuningGroup["kind"] = "subsystem"): RobotCard =>
    ({ key: `${kind}:${owner}`, owner, kind, name, type, metrics: [], tunableCount: 0 });
  for (const [index, subsystem] of subsystems.entries()) {
    const name = subsystem.name || subsystem.id || `Subsystem ${index + 1}`;
    const card = makeCard(topicKey(name), name, subsystem.type || "subsystem");
    cards.set(card.key, card);
  }
  for (const topic of data) {
    const match = /^\/PowerLib\/Subsystems\/([^/]+)\/Data\/(.+)$/.exec(topic.name)
      ?? /^\/PowerLib\/Data\/([^/]+)\/(.+)$/.exec(topic.name);
    if (!match || /^(Connected|AppliedVolts)$/i.test(match[2])) continue;
    // PowerLib publishes drivetrain readings under Drive and tunables under Swerve.
    const owner = match[1] === "Drive" ? "Swerve" : match[1];
    const key = `subsystem:${owner}`;
    const card = cards.get(key) ?? makeCard(owner, owner === "Swerve" ? "Drivetrain" : formatLabel(owner), "subsystem");
    card.metrics.push({ label: formatLabel(match[2]), value: formatValue(topic.value) });
    cards.set(key, card);
  }
  // A constants file belongs on an existing mechanism card when the owner matches.
  for (const file of files) {
    const owner = file.kind === "robot" ? file.name : topicKey(file.name);
    const key = `subsystem:${owner}`;
    const card = cards.get(key) ?? makeCard(owner, owner === "Swerve" ? "Drivetrain" : formatLabel(file.name),
      owner === "Swerve" ? "drivetrain" : file.kind === "robot" ? "constants" : "subsystem");
    card.constantsFile = file;
    cards.set(key, card);
  }
  const groups = groupTunables(tunables);
  for (const [key, variables] of groups) {
    const group = parseTuningGroup(variables[0].name)!;
    const card = cards.get(key) ?? makeCard(group.owner, formatLabel(group.owner),
      group.kind === "command" ? "command" : "constants", group.kind);
    cards.set(key, card);
  }
  const metricOrder = (label: string) => {
    const index = ["Velocity", "Position", "Setpoint"].findIndex(prefix => label.startsWith(prefix));
    return index === -1 ? 3 : index;
  };
  for (const card of cards.values()) {
    card.tunableCount = createTuningValues(groups.get(card.key) ?? [], card.constantsFile).length;
    card.metrics.sort((a, b) => metricOrder(a.label) - metricOrder(b.label) || a.label.localeCompare(b.label));
  }
  const all = [...cards.values()];
  const isSubsystem = (card: RobotCard) => card.type !== "constants" && card.type !== "command";
  return [...all.filter(isSubsystem), ...all.filter(card => !isSubsystem(card)).sort((a, b) => a.name.localeCompare(b.name))];
}
