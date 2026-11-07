import { constantsBarrelPath, constantsDirectory, dashboardPath, digest, robotSource, sourceFormatMarker, stateMachinePath, type SourceProject } from "./project.js";
import { javaFields, markerBlock, maskJava, replaceSpans, type Replacement } from "./source.js";
import { bindingLiteral, configName, decodeSubsystem, mechanismClasses, nestedValue, pascalName, renderSubsystem } from "./subsystemSource.js";
import type { GeneratedSubsystem } from "./configTypes.js";

export type SubsystemRecord = { data: GeneratedSubsystem; file: string; className: string; config: string; field: string; alias: string; registration: { start: number; end: number }; source: string; bindings: ReturnType<typeof decodeSubsystem>["bindings"] };

export async function subsystemRecords(project: SourceProject): Promise<SubsystemRecord[]> {
  const machine = await project.read(stateMachinePath, true);
  if (!machine) return [];
  const mask = maskJava(machine);
  const barrel = await project.read(constantsBarrelPath, true);
  const aliases = new Map([...maskJava(barrel).matchAll(/\bclass\s+(\w+)\s+extends\s+frc\.robot\.constants\.(\w+)Constants\s*\{/g)].map(match => [match[1], match[2]]));
  const pattern = /\bpublic\s+final\s+(?:frc\.powerlib\.subsystems\.)?(VelocityTorqueSubsystem|VelocitySubsystem|AbsolutePositionSubsystem|RelativePositionSubsystem)\s+(\w+)\s*=\s*new\s+(?:frc\.powerlib\.subsystems\.)?\1\s*\(\s*(?:frc\.robot\.)?Constants\.(\w+)\.(\w+)\s*\)\s*;/g;
  const output: SubsystemRecord[] = [];
  const unsupported = (field: string, kind: string, message: string, start: number, end: number) => {
    output.push({ data: { id: field, name: field, type: kind, sourceRevision: digest(machine), sourceError: `${stateMachinePath}: ${message}` }, file: "", className: field, config: "", field, alias: "", source: machine, bindings: new Map(), registration: { start, end } });
  };
  for (const match of mask.matchAll(pattern)) {
    const className = aliases.get(match[3]);
    const kind = Object.keys(mechanismClasses).find(key => mechanismClasses[key] === match[1])!;
    if (!className) { unsupported(match[2], kind, `Cannot resolve Constants.${match[3]} to a robot constants class.`, match.index!, match.index! + match[0].length); continue; }
    const file = `${constantsDirectory}/${className}Constants.java`;
    const source = await project.read(file, true);
    if (!source) { unsupported(match[2], kind, `Missing ${file}.`, match.index!, match.index! + match[0].length); continue; }
    const id = /\/\/ POWERLIB SUBSYSTEM ID:\s*([^\r\n]+)/.exec(source)?.[1].trim() ?? match[2];
    let decoded: ReturnType<typeof decodeSubsystem>;
    try { decoded = decodeSubsystem(source, match[4], kind); }
    catch (error) { decoded = { data: { name: className, type: kind, sourceError: `${file}: ${error instanceof Error ? error.message : String(error)}` }, bindings: new Map() }; }
    const data = { ...decoded.data, id, sourceClass: className, sourceField: match[2], sourceConfig: match[4], sourceRevision: digest(source) };
    output.push({ data, file, className, config: match[4], field: match[2], alias: match[3], source, bindings: decoded.bindings, registration: { start: match.index!, end: match.index! + match[0].length } });
  }
  for (const match of mask.matchAll(/^\s*(?:(?:public|private|protected|final|static)\s+)*(?:frc\.powerlib\.subsystems\.)?(VelocityTorqueSubsystem|VelocitySubsystem|AbsolutePositionSubsystem|RelativePositionSubsystem)\s+(\w+)\s*=/gm)) {
    if (output.some(record => record.field === match[2])) continue;
    const kind = Object.keys(mechanismClasses).find(key => mechanismClasses[key] === match[1])!;
    unsupported(match[2], kind, `${match[2]} uses a custom registration expression. Edit its configuration in Java.`, match.index!, match.index! + match[0].length);
  }
  for (const file of await project.files(constantsDirectory)) {
    if (output.some(record => record.file === file)) continue;
    const source = await project.read(file);
    const id = /\/\/ POWERLIB SUBSYSTEM ID:\s*([^\r\n]+)/.exec(source)?.[1].trim();
    if (!id) continue;
    const className = /\bclass\s+(\w+)Constants\b/.exec(maskJava(source))?.[1];
    if (!className) continue;
    output.push({ data: { id, name: className, sourceClass: className, sourceRevision: digest(source), sourceError: `${file} is not registered in StateMachine. Register it in Java before editing it here.` },
      file, source, className, config: "", field: "", alias: "", bindings: new Map(), registration: { start: 0, end: 0 } });
  }
  if (new Set(output.map(record => record.data.id)).size !== output.length) throw Error("Duplicate subsystem IDs in Java source.");
  return output;
}

function validateSubsystem(data: GeneratedSubsystem) {
  if (!data.name?.trim() || !/^[A-Za-z][\w-]{0,127}$/.test(data.id ?? "") || !mechanismClasses[data.type ?? ""]) throw Error("Subsystem name, valid stable ID and supported type are required.");
  if (!data.motors?.length || data.motors.filter(motor => motor.role === "leader").length !== 1 || data.motors[0].role !== "leader") throw Error("A subsystem must start with exactly one leader motor.");
  for (const motor of data.motors) {
    if (!Number.isInteger(motor.id) || motor.id! < 0 || motor.id! > 62) throw Error("CAN IDs must be integers from 0 to 62.");
    if (!["X60", "X44"].includes(motor.motorType ?? "X60") || !["Brake", "Coast"].includes(motor.neutralMode ?? "Brake")) throw Error("Unsupported motor configuration.");
  }
  for (const value of [data.ratios?.sensorToMechanism, data.ratios?.rotorToSensor]) if (!Number.isFinite(Number(value)) || !Number(value) || Math.abs(Number(value)) > 1000) throw Error("Ratios must be nonzero finite values from -1000 to 1000.");
  for (const group of [data.motionMagic, data.slowMotionMagic]) for (const value of Object.values(group ?? {})) if (value !== null && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw Error("Motion settings must be finite and nonnegative.");
  if (data.cancoder && (!Number.isInteger(data.cancoder.id) || data.cancoder.id! < 0 || data.cancoder.id! > 62)) throw Error("Invalid CANcoder ID.");
  if (data.statorCurrentLimitAmps !== "" && data.statorCurrentLimitAmps != null && Number(data.statorCurrentLimitAmps) <= 0) throw Error("Stator current limit must be positive when supplied.");
  if (data.relativePosition) {
    const values = data.relativePosition;
    if (Number(values.reverseSoftLimit) > Number(values.forwardSoftLimit) || Number(values.homePosition) < Number(values.reverseSoftLimit) || Number(values.homePosition) > Number(values.forwardSoftLimit) || Number(values.tolerance) <= 0) throw Error("Relative position limits, home position and tolerance are inconsistent.");
  }
}

function same(left: unknown, right: unknown) { return (left === "" && right == null) || (right === "" && left == null) || left === right; }

async function editExisting(project: SourceProject, record: SubsystemRecord, data: GeneratedSubsystem) {
  await project.assertRevision(record.file, data.sourceRevision);
  const structural = record.data.type !== data.type || record.data.motors?.length !== data.motors?.length
    || (record.data.type === "velocity" || record.data.type === "velocityTorque") && record.data.statorCurrentLimitAmps === undefined && data.statorCurrentLimitAmps !== undefined;
  if (!structural) {
    const changes: Replacement[] = [];
    let missing = false;
    const desired = renderSubsystem(data, record.className, record.config);
    const decodedDesired = decodeSubsystem(desired.source, record.config, data.type!);
    for (const [key, binding] of decodedDesired.bindings) {
      const value = nestedValue(data, key);
      const before = nestedValue(record.data, key);
      if (same(value, before)) continue;
      const existing = record.bindings.get(key);
      if (!existing) { missing = true; break; }
      const range = existing.expression;
      for (const [otherKey, other] of record.bindings) {
        if (otherKey !== key && other.expression.start === range.start && other.expression.end === range.end && !same(nestedValue(data, otherKey), value)) {
          throw Error(`${key} and ${otherKey} share a Java initializer. Split that binding in Java before editing them independently.`);
        }
      }
      changes.push({ ...range, text: bindingLiteral(value, binding.type) });
    }
    if (!missing) { await project.set(record.file, replaceSpans(record.source, changes)); return; }
  }
  const oldShape = renderSubsystem(record.data, record.className, record.config);
  const nextShape = renderSubsystem(data, record.className, record.config);
  const managed = new Set(oldShape.declarations.map(item => item.name));
  const fields = javaFields(record.source);
  // Reconstruct only the owned declarations. All custom fields, methods and text remain in place.
  const edits: Replacement[] = [];
  for (const field of fields.filter(item => managed.has(item.name))) {
    const next = nextShape.declarations.find(item => item.name === field.name);
    const old = oldShape.declarations.find(item => item.name === field.name)!;
    if (field.type !== old.type) throw Error(`Structural edit of custom declaration ${field.name} is read-only.`);
    if (!next) edits.push({ start: field.start, end: field.end, text: "" });
    else {
      if (field.value !== next.value) edits.push({ ...field.expression, text: next.value });
      if (field.type !== next.type) {
        const prefix = maskJava(record.source).slice(field.start, field.expression.start);
        const nameIndex = prefix.lastIndexOf(field.name);
        const typeEnd = prefix.slice(0, nameIndex).trimEnd().length;
        edits.push({ start: field.start + typeEnd - field.type.length, end: field.start + typeEnd, text: next.type });
      }
    }
  }
  if (fields.filter(item => managed.has(item.name)).length !== managed.size) throw Error("This subsystem has a custom constructor layout. Edit its structural changes in Java.");
  let source = replaceSpans(record.source, edits);
  const additions = nextShape.declarations.filter(item => !managed.has(item.name));
  if (additions.some(item => fields.some(field => field.name === item.name))) throw Error("A new motor field conflicts with a custom constant.");
  if (additions.length) {
    const at = javaFields(source).find(field => field.name === record.config)!.start;
    source = source.slice(0, at) + additions.map(item => `public static final ${item.type} ${item.name} = ${item.value};\n  `).join("") + source.slice(at);
  }
  for (const name of nextShape.imports) if (!new RegExp(`import\\s+${name.replaceAll(".", "\\.")}\\s*;`).test(source)) {
    const at = source.indexOf(";") + 1;
    source = source.slice(0, at) + `\nimport ${name};` + source.slice(at);
  }
  for (const removed of oldShape.declarations.filter(item => !nextShape.declarations.some(next => next.name === item.name))) {
    for (const relative of await project.files()) {
      const code = maskJava(relative === record.file ? source : await project.read(relative));
      const pattern = relative === record.file ? new RegExp(`\\b${removed.name}\\b`) : new RegExp(`\\b(?:${record.className}Constants|Constants\\.${record.alias})\\s*\\.\\s*${removed.name}\\b`);
      if (pattern.test(code)) throw Error(`Cannot remove ${removed.name}: ${relative} still references it.`);
    }
  }
  await project.set(record.file, source);
}

function ensureConstantsBlock(source: string) {
  if (source.includes("// POWERLIB GENERATED CONSTANTS START")) return source;
  const end = maskJava(source).lastIndexOf("}");
  if (end < 0) throw Error("Invalid Constants.java class.");
  return source.slice(0, end) + "  // POWERLIB GENERATED CONSTANTS START - DO NOT DELETE\n  // POWERLIB GENERATED CONSTANTS END - DO NOT DELETE\n" + source.slice(end);
}

export async function writeSubsystems(project: SourceProject, data: GeneratedSubsystem[], confirmedDeletes: string[] = []) {
  if (!Array.isArray(data)) throw Error("Subsystems must be a list.");
  const previous = await subsystemRecords(project);
  const ids = new Set<string>();
  const names = new Set<string>();
  const can = new Set<number>();
  for (const config of data) {
    if (!config || typeof config.id !== "string" || ids.has(config.id)) throw Error("Subsystem IDs must be unique.");
    ids.add(config.id);
    if (config.sourceError) continue;
    validateSubsystem(config);
    if (names.has(config.name!.toLowerCase())) throw Error("Subsystem names must be unique.");
    names.add(config.name!.toLowerCase());
    for (const id of [...config.motors!.map(motor => motor.id!), ...(config.cancoder ? [config.cancoder.id!] : [])]) {
      if (can.has(id)) throw Error(`CAN ID ${id} is used more than once.`);
      can.add(id);
    }
  }
  const removed = previous.filter(record => !ids.has(record.data.id!));
  for (const record of removed) if (record.data.sourceError) throw Error(record.data.sourceError);
  for (const record of removed) if (!confirmedDeletes.includes(record.data.id!)) throw Error(`Confirm deletion of ${record.data.name} and its source files.`);
  let machine = await project.read(stateMachinePath);
  const registryEdits: Replacement[] = [];
  let barrel = ensureConstantsBlock(await project.read(constantsBarrelPath));
  const newEntries: string[] = [];
  const newAliases: string[] = [];
  for (const config of data) {
    const record = previous.find(item => item.data.id === config.id);
    if (record) {
      if (record.data.sourceError) {
        if (JSON.stringify(config) !== JSON.stringify(record.data)) throw Error(record.data.sourceError);
        continue;
      }
      await editExisting(project, record, config);
      if (record.data.type !== config.type) registryEdits.push({ ...record.registration, text: machine.slice(record.registration.start, record.registration.end)
        .replace(new RegExp(`(?:frc\\.powerlib\\.subsystems\\.)?${mechanismClasses[record.data.type!]}`, "g"), `frc.powerlib.subsystems.${mechanismClasses[config.type!]}`) });
      continue;
    }
    const className = pascalName(config.name!);
    if (!/^[A-Za-z][\w]*$/.test(className) || /^(?:CanBus|GeneratedTunable|LED|Location|OI|RobotContainer|StateMachine|Swerve|Tuner|Vision)$/i.test(className)) throw Error("Invalid or reserved subsystem class name.");
    const field = className[0].toLowerCase() + className.slice(1);
    if (new RegExp(`\\b${field}\\b`).test(maskJava(machine))) throw Error(`StateMachine already has a ${field} member.`);
    const relative = `${constantsDirectory}/${className}Constants.java`;
    if (await project.read(relative, true)) throw Error(`${className}Constants.java already exists.`);
    const configField = configName(className);
    await project.set(relative, renderSubsystem(config, className, configField).source);
    newEntries.push(`  public final frc.powerlib.subsystems.${mechanismClasses[config.type!]} ${field} = new frc.powerlib.subsystems.${mechanismClasses[config.type!]}(Constants.${className}.${configField});`);
    newAliases.push(`  public static final class ${className} extends frc.robot.constants.${className}Constants {}`);
  }
  registryEdits.push(...removed.filter(record => record.registration.end).map(record => ({ ...record.registration, text: "" })));
  machine = replaceSpans(machine, registryEdits);
  if (removed.length) {
    // Remove only recognized registrations and aliases before checking other references.
    for (const record of removed) barrel = barrel.replace(new RegExp(`^\\s*public static final class ${record.alias} extends frc\\.robot\\.constants\\.${record.className}Constants \\{\\}\\s*$`, "gm"), "");
    for (const file of await project.files()) {
      if (removed.some(record => record.file === file || file.endsWith(`/${record.className}Characterization.java`))) continue;
      const content = file === stateMachinePath ? machine : file === constantsBarrelPath ? barrel : await project.read(file);
      const source = maskJava(file === dashboardPath ? markerBlock(content, "CHARACTERIZATION", "") : content);
      for (const record of removed) if (new RegExp(`\\b(?:${record.className}Constants|Constants\\.${record.alias}|stateMachine\\.${record.field})\\b`).test(source)) throw Error(`Cannot delete ${record.data.name}: ${file} still references it.`);
    }
    for (const record of removed) { await project.set(record.file, null); await project.set(`${robotSource}/characterization/${record.className}Characterization.java`, null); }
  }
  if (newEntries.length) {
    const start = machine.indexOf("// POWERLIB GENERATED SUBSYSTEMS START - DO NOT DELETE") + "// POWERLIB GENERATED SUBSYSTEMS START - DO NOT DELETE".length;
    const end = machine.indexOf("// POWERLIB GENERATED SUBSYSTEMS END - DO NOT DELETE");
    machine = markerBlock(machine, "SUBSYSTEMS", machine.slice(start, end).trimEnd().replace(/^\r?\n/, "") + "\n" + newEntries.join("\n"));
  }
  if (newAliases.length) {
    const start = barrel.indexOf("// POWERLIB GENERATED CONSTANTS START - DO NOT DELETE") + "// POWERLIB GENERATED CONSTANTS START - DO NOT DELETE".length;
    const end = barrel.indexOf("// POWERLIB GENERATED CONSTANTS END - DO NOT DELETE");
    barrel = markerBlock(barrel, "CONSTANTS", barrel.slice(start, end).trimEnd().replace(/^\r?\n/, "") + "\n" + newAliases.join("\n"));
  }
  if (!barrel.includes(sourceFormatMarker)) barrel = barrel.replace(/(package\s+frc\.robot\s*;)/, `$1\n\n${sourceFormatMarker}`);
  await project.set(stateMachinePath, machine);
  await project.set(constantsBarrelPath, barrel);
}
