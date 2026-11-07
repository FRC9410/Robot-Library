import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { constantsBarrelPath, digest, sourceFormatMarker, SourceProject, recoverSourceTransactions, withProjectLock } from "./project.js";
import { readSubsystemProject } from "./service.js";
import { writeSubsystems } from "./subsystems.js";
import { readVisionDraft, readLocalizationDraft, writeVision, writeLocalization, writeSwerve, swervePaths, localizationNames } from "./scalars.js";
import { readStates, writeStates } from "./states.js";
import { readConstantsProject, writeConstantsProject, type ConstantRow } from "../constantsFiles.js";
import { writeCharacterization, writeTunableRegistry } from "./integrations.js";
import type { GeneratedSubsystem } from "./configTypes.js";
import { normalizeVisionConfig, validateVisionConfig } from "../visionConfig.js";
import { validateLocalizationConfig } from "../localizationConfig.js";
import { literalValue } from "./source.js";

export type MigrationChange = {
  id: string; target: "subsystem" | "swerve" | "vision" | "localization" | "constant" | "state-add" | "state-remove";
  owner: string; field: string; javaValue: unknown; savedValue: unknown; source: string; unsupported?: string; destructive?: boolean;
};
type LegacyFile = { path: string; relative: string; source: string; document: any };
const clone = <T>(value: T): T => structuredClone(value);
const key = (value: string) => value.replace(/[^a-z0-9]/gi, "").toLowerCase();
const clean = (value: any): any => Array.isArray(value) ? value.map(clean) : value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([name]) => !name.startsWith("source")).sort(([left], [right]) => left.localeCompare(right)).map(([name, item]) => [name, clean(item)])) : value;
function equivalent(left: unknown, right: unknown) {
  if (left === right || left == null && right === "" || right == null && left === "") return true;
  if (typeof left === "string" && typeof right === "string") {
    try { return literalValue(left, { start: 0, end: left.length }) === literalValue(right, { start: 0, end: right.length }); } catch { /* Compare literal expression text below. */ }
  }
  return JSON.stringify(clean(left)) === JSON.stringify(clean(right));
}
function get(value: any, field: string) { return field ? field.split(".").reduce((current, name) => current?.[name], value) : value; }
function set(value: any, field: string, next: unknown) {
  const pieces = field.split(".");
  let current = value;
  for (const piece of pieces.slice(0, -1)) current = current[piece] ??= {};
  current[pieces.at(-1)!] = clone(next);
}

async function legacyFiles(root: string) {
  const files: LegacyFile[] = [];
  for (const directory of ["power-tool/generated", "", "power-tool", "powerlib-dashboard"]) for (const name of ["powerlib-subsystems.json", "powerlib-constants.json"]) {
    const relative = directory ? `${directory}/${name}` : name;
    const absolute = path.join(root, relative);
    let source: string;
    try { source = await fs.readFile(absolute, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") continue; throw error; }
    let document;
    try { document = JSON.parse(source.replace(/^\uFEFF/, "")); } catch { throw Error(`Legacy configuration is malformed: ${relative}. Preserve and repair it before migration.`); }
    if (!document || typeof document !== "object" || Array.isArray(document)) throw Error(`Invalid legacy configuration: ${relative}.`);
    files.push({ path: absolute, relative, source, document });
  }
  return files;
}

async function preview(project: SourceProject) {
  const files = await legacyFiles(project.root);
  const current = await readSubsystemProject(project);
  const constants = await readConstantsProject(project);
  const failures: Partial<Record<MigrationChange["target"], string>> = {};
  const failed = (target: MigrationChange["target"], error: unknown) => { failures[target] = error instanceof Error ? error.message : String(error); return null; };
  const states = await readStates(project).then(result => result.config).catch(error => failed("state-add", error));
  failures["state-remove"] = failures["state-add"];
  const vision = await readVisionDraft(project).then(result => result.vision).catch(error => failed("vision", error));
  const localization = await readLocalizationDraft(project).then(result => result.config).catch(error => failed("localization", error));
  const changes: MigrationChange[] = [];
  const add = (file: LegacyFile, target: MigrationChange["target"], owner: string, field: string, before: unknown, after: unknown, unsupported?: string, destructive = false) => {
    unsupported ??= failures[target];
    if (target === "subsystem") unsupported ??= current.subsystems.find(item => item.id === owner)?.sourceError;
    if (target === "swerve" && get(current.swerve, field) === undefined) unsupported ??= "This field has no readable Java literal binding. Edit its expression in Java.";
    if (!unsupported && equivalent(before, after)) return;
    changes.push({ id: digest(`${file.relative}:${target}:${owner}:${field}`), target, owner, field, javaValue: before, savedValue: after, source: file.relative, unsupported, destructive });
  };
  const compare = (file: LegacyFile, target: MigrationChange["target"], owner: string, before: any, after: any, prefix = "") => {
    for (const [name, value] of Object.entries(after ?? {})) {
      if (name.startsWith("source") || name === "id") continue;
      if (target === "subsystem" && !prefix && name === "torqueFF" && Number(value) === 0 && before?.torqueFF === undefined && ["absolutePosition", "relativePosition"].includes(before?.type)) continue;
      const field = prefix ? `${prefix}.${name}` : name;
      if (value && typeof value === "object" && !Array.isArray(value)) compare(file, target, owner, before?.[name], value, field);
      else {
        const supported = target !== "subsystem" || /^(?:name|type|focEnabled|torqueFF|statorCurrentLimitAmps|motors|pid\.k[PIDGSVA]|ratios\.(?:sensorToMechanism|rotorToSensor)|(?:slowMotionMagic|motionMagic)\.(?:cruiseVelocity|acceleration)|cancoder\.(?:id|magnetOffset|discontinuityPoint)|absolutePosition\.(?:units|default)|relativePosition\.(?:units|homePosition|forwardSoftLimit|reverseSoftLimit|slowThreshold|tolerance|stopVoltage))$/.test(field);
        add(file, target, owner, field, before?.[name], value, supported ? undefined : "This legacy setting has no supported Java binding; its original is retained in the backup.");
      }
    }
  };
  for (const file of files) {
    if (file.relative.endsWith("powerlib-subsystems.json")) {
      if (file.document.subsystems !== undefined && !Array.isArray(file.document.subsystems)) throw Error(`Invalid subsystem list in ${file.relative}.`);
      for (const subsystem of file.document.subsystems ?? []) {
        const known = current.subsystems.find(item => item.id === subsystem.id || key(item.name ?? "") === key(subsystem.name ?? ""));
        const desired = clone(subsystem);
        if (desired.position && !desired.absolutePosition) desired.absolutePosition = desired.position;
        delete desired.position;
        if (!known) add(file, "subsystem", String(desired.id ?? desired.name), "", undefined, desired);
        else {
          if (key(known.name ?? "") === key(desired.name ?? "")) desired.name = known.name;
          compare(file, "subsystem", known.id!, known, desired);
        }
      }
      if (file.document.swerve) for (const [, [group, field]] of Object.entries(swervePaths)) {
        const candidate = file.document.swerve[group]?.[field];
        if (candidate !== undefined) add(file, "swerve", "Swerve", `${group}.${field}`, (current.swerve as any)[group]?.[field], candidate);
      }
      if (file.document.vision) compare(file, "vision", "Vision", vision, normalizeVisionConfig(file.document.vision));
      if (file.document.localization) compare(file, "localization", "Vision", localization, file.document.localization);
      if (file.document.states !== undefined && !Array.isArray(file.document.states)) throw Error(`Invalid state list in ${file.relative}.`);
      for (const name of file.document.states ?? []) if (name !== "IDLE" && !states?.states.includes(name)) add(file, "state-add", name, "", undefined, name);
      for (const name of file.document.stateHandlerDeletions ?? []) if ((!states || states.states.includes(name)) && name !== "IDLE") add(file, "state-remove", name, "", name, null, undefined, true);
    } else {
      if (file.document.version !== 1 || !file.document.files || typeof file.document.files !== "object") throw Error(`Invalid constants configuration: ${file.relative}.`);
      for (const [id, group] of Object.entries(file.document.files as Record<string, { constants: ConstantRow[] }>)) {
        if (!Array.isArray(group.constants)) throw Error(`Invalid constants list ${id}.`);
        const matching = id.startsWith("subsystem:") ? current.subsystems.find(item => item.id === id.slice(10)) : null;
        const fileId = matching ? `subsystem:${matching.sourceClass}` : id;
        const target = constants.find(item => item.id === fileId);
        for (const row of group.constants) {
          if (fileId === "robot:Vision" && localizationNames.includes(row.name)) continue;
          const original = target?.constants.find(item => item.name === row.name);
          add(file, "constant", fileId, row.name, original?.value, row.value,
            !target ? "The Java constants class is missing." : target.error ? target.error : original && original.type !== row.type ? "The saved Java type differs from source." : !original && !row.custom ? "The required source declaration is missing." : undefined);
        }
      }
    }
  }
  // Source hashes cover every reference used to validate destructive operations.
  const hashes: string[] = [];
  for (const relative of await project.files()) hashes.push(`${relative}:${digest(await project.read(relative))}`);
  return { files, current, constants, states, vision, localization, changes,
    revision: digest([...hashes, ...files.map(file => `${file.relative}:${digest(file.source)}`)].join("\n")) };
}

export function readLegacyMigration(root: string) {
  return withProjectLock(root, async () => {
    await recoverSourceTransactions(root);
    if (!(await legacyFiles(root)).length) return { revision: digest(""), files: [] as string[], changes: [] as MigrationChange[] };
    const report = await preview(new SourceProject(root));
    return { revision: report.revision, files: report.files.map(file => file.relative), changes: report.changes };
  });
}

export function applyLegacyMigration(root: string, revision: string, selected: string[], confirmDeletes = false) {
  return withProjectLock(root, async () => {
    await recoverSourceTransactions(root);
    const project = new SourceProject(root);
    const report = await preview(project);
    if (report.revision !== revision) throw Error("Source or legacy configuration changed during review. Reload the migration before continuing.");
    const choices = selected.map(id => {
      const change = report.changes.find(item => item.id === id);
      if (!change || change.unsupported) throw Error("An unsupported migration change was selected.");
      if (change.destructive && !confirmDeletes) throw Error("Confirm deletion of the selected edited state files before continuing.");
      return change;
    });
    const unique = new Map<string, unknown>();
    for (const choice of choices) {
      const key = `${choice.target}:${choice.owner}:${choice.field}`;
      if (unique.has(key) && !equivalent(unique.get(key), choice.savedValue)) throw Error(`Multiple legacy files disagree about ${choice.owner} ${choice.field}. Select one saved value.`);
      unique.set(key, choice.savedValue);
    }
    const subsystems = clone(report.current.subsystems);
    const swerve = clone(report.current.swerve);
    const vision = clone(report.vision);
    const localization = clone(report.localization);
    const constants = clone(report.constants);
    const states = [...(report.states?.states ?? [])];
    const removed: string[] = [];
    const changedConstants = new Set<string>();
    for (const choice of choices) {
      if (choice.target === "subsystem") {
        let item = subsystems.find(item => item.id === choice.owner);
        if (!item && !choice.field) { item = clone(choice.savedValue as GeneratedSubsystem); subsystems.push(item); }
        else if (item) set(item, choice.field, choice.savedValue);
      } else if (choice.target === "swerve") set(swerve, choice.field, choice.savedValue);
      else if (choice.target === "vision") set(vision, choice.field, choice.savedValue);
      else if (choice.target === "localization") set(localization, choice.field, choice.savedValue);
      else if (choice.target === "state-add") states.splice(states.length - 1, 0, choice.owner);
      else if (choice.target === "state-remove") { const index = states.indexOf(choice.owner); if (index >= 0) states.splice(index, 1); removed.push(choice.owner); }
      else {
        const target = constants.find(file => file.id === choice.owner)!;
        const original = target.constants.find(row => row.name === choice.field);
        if (original) original.value = String(choice.savedValue);
        else {
          const document = report.files.find(file => file.relative === choice.source)!.document;
          const group = Object.entries(document.files as Record<string, { constants: ConstantRow[] }>).find(([id]) => id === choice.owner || id.startsWith("subsystem:") && report.current.subsystems.some(item => `subsystem:${item.sourceClass}` === choice.owner && item.id === id.slice(10)));
          const stored = group?.[1].constants.find(row => row.name === choice.field);
          if (!stored) throw Error(`Missing legacy constant ${choice.field}.`);
          target.constants.push({ ...stored, originalName: null });
        }
        changedConstants.add(choice.owner);
      }
    }
    if (choices.some(change => change.target === "subsystem")) { await writeSubsystems(project, subsystems); await writeCharacterization(project); }
    if (choices.some(change => change.target === "swerve")) await writeSwerve(project, swerve);
    for (const id of changedConstants) { const file = constants.find(item => item.id === id)!; await writeConstantsProject(project, id, file.source, file.constants); }
    if (choices.some(change => change.target === "vision")) { validateVisionConfig(vision); await writeVision(project, vision); }
    if (choices.some(change => change.target === "localization")) { validateLocalizationConfig(localization); await writeLocalization(project, localization); }
    if (report.states) await writeStates(project, { states, deleteHandlers: removed });
    let barrel = await project.read(constantsBarrelPath);
    if (!barrel.includes(sourceFormatMarker)) barrel = barrel.replace(/(package\s+frc\.robot\s*;)/, `$1\n\n${sourceFormatMarker}`);
    await project.set(constantsBarrelPath, barrel);
    await writeTunableRegistry(project);
    const backup = path.join(root, "build", "power-tool-migration", randomUUID());
    await fs.mkdir(backup, { recursive: true });
    for (const file of report.files) {
      if (await fs.readFile(file.path, "utf8") !== file.source) throw Error(`Legacy file changed: ${file.relative}.`);
      const target = path.join(backup, "legacy", file.relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.source, "utf8");
    }
    for (const [relative, contents] of project.originals) if (contents !== null) {
      const target = path.join(backup, "source", relative);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, contents, "utf8");
    }
    const changed = await project.commit();
    for (const file of report.files) {
      if (await fs.readFile(file.path, "utf8") !== file.source) throw Error(`Java was migrated, but ${file.relative} changed externally. Its backup is at ${backup}; preserve and review that file.`);
      await fs.unlink(file.path);
    }
    return { backup, changed, applied: choices.length, archived: report.files.map(file => file.relative) };
  });
}
