import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generatedJsonPath } from "./projectPaths.js";

const customStart = "// POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE";
const customEnd = "// POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE";
const reservedNames = new Set(["canbus", "generatedtunable", "led", "location", "oi", "robotcontainer", "statemachine", "swerve", "tuner", "vision"]);
const keywords = new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record yield sealed permits".split(" "));

export type ConstantRow = {
  originalName: string | null;
  name: string;
  type: string;
  value: string;
  custom: boolean;
  tunable: boolean;
};

export type ConstantsFile = {
  id: string;
  name: string;
  kind: "subsystem" | "robot";
  path: string;
  exists: boolean;
  source: string;
  constants: ConstantRow[];
  error?: string;
};

type Declaration = ConstantRow & { start: number; end: number };
type ConstantsTarget = Pick<ConstantsFile, "id" | "name" | "kind" | "path"> & { storageKey: string };
type StoredConstant = Pick<ConstantRow, "name" | "type" | "value" | "custom" | "tunable">;
type ConstantsConfiguration = { version: 1; files: Record<string, { constants: StoredConstant[] }> };

async function readConfiguration(robotRoot: string): Promise<ConstantsConfiguration> {
  try {
    const result = JSON.parse((await fs.readFile(await generatedJsonPath(robotRoot, "powerlib-constants.json"), "utf8")).replace(/^\uFEFF/, ""));
    if (result.version !== 1 || !result.files || typeof result.files !== "object" || Array.isArray(result.files)) throw new Error("Invalid powerlib-constants.json configuration.");
    return result;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { version: 1, files: {} };
    throw error;
  }
}

function applyConfiguration(source: string, target: ConstantsTarget, constants: StoredConstant[]) {
  let content = source;
  const parsed = declarations(source);
  for (const original of [...parsed].reverse()) {
    if (original.custom || isNativeSwerveTunable(target, original.name)) continue;
    const row = constants.find((candidate) => !candidate.custom && candidate.name === original.name);
    if (!row) continue;
    if (row.type !== original.type) throw new Error(`The Java type of ${row.name} changed. Refresh its saved configuration.`);
    const replacement = row.value === original.value && row.tunable === original.tunable
      ? content.slice(original.start, original.end)
      : formatDeclaration({ ...row, originalName: row.name }, target);
    content = content.slice(0, original.start) + replacement + content.slice(original.end);
  }
  let range = customRange(content);
  if (!range) {
    const end = maskJava(content).lastIndexOf("}");
    if (end < 0) throw new Error("Missing constants class closing brace.");
    content = content.slice(0, end) + `  ${customStart}\n  ${customEnd}\n` + content.slice(end);
    range = customRange(content)!;
  }
  const custom = constants.filter((row) => row.custom).map((row) => `  ${formatDeclaration({ ...row, originalName: row.name }, target)}`).join("\n");
  return content.slice(0, range.start) + `\n${custom}${custom ? "\n" : ""}  ` + content.slice(range.end);
}

// Mask comments and strings without changing offsets, so expressions can contain delimiters.
function maskJava(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    (match) => match.replace(/[^\r\n]/g, " "));
}

function customRange(source: string) {
  const start = source.indexOf(customStart);
  const end = source.indexOf(customEnd);
  if (start < 0 && end < 0) return null;
  if (start < 0 || end < start || source.indexOf(customStart, start + 1) >= 0 || source.indexOf(customEnd, end + 1) >= 0) {
    throw new Error("Custom constants markers are incomplete or duplicated. Repair the file before saving.");
  }
  return { start: start + customStart.length, end };
}

function declarations(source: string): Declaration[] {
  const masked = maskJava(source);
  const range = customRange(source);
  const result: Declaration[] = [];
  const pattern = /(?:(@(?:frc\.powerlib\.tuning\.)?TunableConstant)\s+)?\bpublic\s+static\s+(?:final|volatile)\s+([\w.$<>?,\s\[\]]+?)\s+([A-Za-z_$][\w$]*)\s*=/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(masked))) {
    // Only constants directly in this class, never fields of nested classes.
    const depth = [...masked.slice(0, match.index)].reduce((n, char) => n + (char === "{" ? 1 : char === "}" ? -1 : 0), 0);
    if (depth !== 1) continue;
    let end = pattern.lastIndex;
    let nesting = 0;
    for (; end < masked.length; end++) {
      const char = masked[end];
      if ("([{".includes(char)) nesting++;
      if (")]}".includes(char)) nesting--;
      if (char === ";" && nesting === 0) break;
      if (nesting < 0) throw new Error(`Could not read constant ${match[3]}.`);
    }
    if (end === masked.length) throw new Error(`Missing semicolon for constant ${match[3]}.`);
    result.push({ originalName: match[3], name: match[3], type: match[2].trim(), tunable: Boolean(match[1]),
      value: source.slice(pattern.lastIndex, end).trim(), custom: Boolean(range && match.index >= range.start && end < range.end), start: match.index, end: end + 1 });
    pattern.lastIndex = end + 1;
  }
  return result;
}

function pascalName(name: string) {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[^A-Za-z0-9]+/).filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1)).join("");
}

async function targets(robotRoot: string) {
  let document: { subsystems?: Array<{ id?: string; name?: string }> } = {};
  try {
    document = JSON.parse(await fs.readFile(await generatedJsonPath(robotRoot, "powerlib-subsystems.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const directory = path.join(robotRoot, "src", "main", "java", "frc", "robot", "constants");
  const result: ConstantsTarget[] = ["Vision", "StateMachine", "OI", "RobotContainer", "Swerve"].map((name) => ({ id: `robot:${name}`, storageKey: `robot:${name}`, name, kind: "robot", path: path.join(directory, `${name}Constants.java`) }));
  const seen = new Set<string>();
  for (const subsystem of document.subsystems ?? []) {
    const name = pascalName(subsystem.name ?? "");
    if (!/^[A-Za-z_$][\w$]*$/.test(name) || reservedNames.has(name.toLowerCase()) || seen.has(name.toLowerCase())) {
      throw new Error(`Invalid, reserved, or duplicate subsystem constants name: ${subsystem.name ?? "(missing)"}.`);
    }
    seen.add(name.toLowerCase());
    result.push({ id: `subsystem:${name}`, storageKey: `subsystem:${subsystem.id || name[0].toLowerCase() + name.slice(1)}`, name: subsystem.name ?? name, kind: "subsystem", path: path.join(directory, `${name}Constants.java`) });
  }
  return result;
}

async function readTarget(target: ConstantsTarget, configuration?: ConstantsConfiguration, swerve?: Record<string, Record<string, unknown>>): Promise<ConstantsFile> {
  let source = "";
  try {
    source = await fs.readFile(target.path, "utf8");
    const saved = configuration?.files[target.storageKey];
    if (saved) {
      if (!Array.isArray(saved.constants)) throw new Error("Invalid saved constants list.");
      source = applyConfiguration(source, target, saved.constants);
    }
    if (target.id === "robot:Swerve" && swerve) {
      for (const row of [...declarations(source)].reverse()) {
        const mapping = swervePaths[row.name];
        const value = mapping ? swerve[mapping[0]]?.[mapping[1]] : undefined;
        if (value === undefined) continue;
        const literal = String(value);
        if (!Number.isFinite(Number(value))) throw new Error(`Invalid Swerve default ${row.name}.`);
        const replacement = formatDeclaration({ ...row, value: literal, tunable: true }, target);
        source = source.slice(0, row.start) + replacement + source.slice(row.end);
      }
    }
    const parsed = declarations(source);
    if (target.kind === "subsystem" && !customRange(source)) throw new Error("Run Update Code to create the custom constants section.");
    return { ...target, exists: true, source, constants: parsed.filter((row) => target.kind === "robot" || row.custom).map(({ start: _start, end: _end, ...row }) => ({ ...row,
      tunable: row.tunable || isNativeSwerveTunable(target, row.name)
    })) };
  } catch (error) {
    const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
    return { ...target, exists: !missing, source, constants: [], error: missing
      ? target.kind === "subsystem" ? "Run Update Code to generate this constants file." : "Run the PowerLib installer to install this constants file."
      : error instanceof Error ? error.message : "Could not read constants." };
  }
}

export async function readConstantsFiles(robotRoot: string) {
  const configuration = await readConfiguration(robotRoot);
  let swerve: Record<string, Record<string, unknown>> | undefined;
  try { swerve = JSON.parse(await fs.readFile(await generatedJsonPath(robotRoot, "powerlib-subsystems.json"), "utf8")).swerve; }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  return Promise.all((await targets(robotRoot)).map((target) => readTarget(target, configuration, swerve)));
}

function validateRow(row: ConstantRow, original?: Declaration) {
  if (!row || !/^[A-Za-z_$][\w$]*$/.test(row.name) || keywords.has(row.name)) throw new Error("Constant names must be valid Java identifiers.");
  if (typeof row.type !== "string" || !/^[A-Za-z_$][\w.$]*(?:\s*<\s*[\w.$?,<>\s]+>)?(?:\s*\[\])*\s*$/.test(row.type)) throw new Error(`Invalid Java type for ${row.name}.`);
  if (typeof row.value !== "string" || !row.value.trim()) throw new Error(`Enter a value for ${row.name}.`);
  if (typeof row.tunable !== "boolean") throw new Error(`Choose whether ${row.name} is tunable.`);
  if (row.tunable && !isNumericType(row.type)) throw new Error(`Only numeric constants can be tunable: ${row.name}.`);
  if (!original || row.type !== original.type || row.value !== original.value) {
    if (isNumericType(row.type)) {
      const literal = row.value.trim().replace(/[fFLlDd]$/, "");
      const number = Number(literal);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(literal) || !Number.isFinite(number)) throw new Error(`${row.name} requires a finite number.`);
      const type = row.type.trim().replace(/^java\.lang\./, "");
      const ranges: Record<string, [number, number]> = { byte: [-128, 127], Byte: [-128, 127], short: [-32768, 32767], Short: [-32768, 32767], int: [-2147483648, 2147483647], Integer: [-2147483648, 2147483647], long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], Long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] };
      if (ranges[type] && (!Number.isInteger(number) || number < ranges[type][0] || number > ranges[type][1])) throw new Error(`${row.name} requires a whole number within the ${type} range.`);
      if ((type === "float" || type === "Float") && !Number.isFinite(Math.fround(number))) throw new Error(`${row.name} is outside the float range.`);
      if ((type === "long" || type === "Long") && !/[lL]$/.test(row.value.trim())) row.value = `${number}L`;
      if (type === "float" || type === "Float") row.value = `${Math.fround(number)}f`;
      if (type === "double" || type === "Double") {
        const literal = String(number);
        row.value = Number.isInteger(number) && !/[eE]/.test(literal) ? `${literal}.0` : literal;
      }
      if (["byte", "Byte", "short", "Short", "int", "Integer"].includes(type)) row.value = String(number);
    }
    if (["boolean", "Boolean", "java.lang.Boolean"].includes(row.type) && !/^(true|false)$/.test(row.value)) throw new Error(`${row.name} requires true or false.`);
    if (["String", "java.lang.String"].includes(row.type) && !/^"(?:\\(?:[btnfr"'\\]|u[0-9a-fA-F]{4})|[^"\\\r\n])*"$/.test(row.value)) throw new Error(`${row.name} requires a string value.`);
  }
  const masked = maskJava(row.value);
  if (/["']/.test(masked) || masked.includes("/*")) throw new Error(`Unterminated string or comment for ${row.name}.`);
  const stack: string[] = [];
  for (const char of masked) {
    if (char === ";") throw new Error(`${row.name} must contain a Java expression without a semicolon.`);
    if ("([{".includes(char)) stack.push(char);
    if (")]}".includes(char) && stack.pop() !== ({ ")": "(", "]": "[", "}": "{" } as Record<string, string>)[char]) throw new Error(`Unbalanced expression for ${row.name}.`);
  }
  if (stack.length) throw new Error(`Unbalanced expression for ${row.name}.`);
  // A trailing line comment would comment out the generated semicolon.
  const tokens = row.value.match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g) ?? [];
  if (tokens.some((token) => token.startsWith("//") && row.value.endsWith(token))) throw new Error(`Remove the trailing line comment from ${row.name}.`);
}

const swervePaths: Record<string, [string, string]> = {
  DRIVER_MAX_SPEED_COEFFICIENT: ["driver", "maxSpeedCoefficient"], DRIVER_VELOCITY_SCALE: ["driver", "velocityScale"],
  DRIVER_MAX_ANGULAR_RATE_RADIANS_PER_SECOND: ["driver", "maxAngularRateRadiansPerSecond"], DRIVER_JOYSTICK_DEADBAND: ["driver", "joystickDeadband"], DRIVER_SKEW_COMPENSATION: ["driver", "skewCompensation"],
  REQUEST_MAX_ANGULAR_RATE_RADIANS_PER_SECOND: ["requests", "maxAngularRateRadiansPerSecond"], REQUEST_TRANSLATION_DEADBAND_METERS_PER_SECOND: ["requests", "translationDeadbandMetersPerSecond"], REQUEST_ROTATIONAL_DEADBAND_RADIANS_PER_SECOND: ["requests", "rotationalDeadbandRadiansPerSecond"],
  DRIVE_TO_POINT_MAX_ANGULAR_RATE_RADIANS_PER_SECOND: ["driveToPoint", "maxAngularRateRadiansPerSecond"], DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT: ["driveToPoint", "maxSpeedCoefficient"], DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT: ["driveToPoint", "slowSpeedCoefficient"], DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT: ["driveToPoint", "staticFrictionConstant"],
  HEADING_KP: ["heading", "kP"], HEADING_KI: ["heading", "kI"], HEADING_KD: ["heading", "kD"]
};

function isNumericType(type: string) {
  return /^(?:byte|short|int|long|float|double|(?:java\.lang\.)?(?:Byte|Short|Integer|Long|Float|Double))$/.test(type.trim());
}

function isNativeSwerveTunable(target: ConstantsTarget, name: string) {
  return target.id === "robot:Swerve" && Object.hasOwn(swervePaths, name);
}

function formatDeclaration(row: ConstantRow, target: ConstantsTarget) {
  const tunable = row.tunable && !isNativeSwerveTunable(target, row.name);
  const annotation = tunable ? "@frc.powerlib.tuning.TunableConstant\n  " : "";
  return `${annotation}public static ${tunable ? "volatile" : "final"} ${row.type.trim()} ${row.name} = ${row.value.trim()};`;
}

async function replaceFile(filePath: string, content: string) {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, "utf8");
    await fs.rename(temporaryPath, filePath);
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

// Serialize saves so two windows cannot both pass the stale-source check before writing.
let pendingSave: Promise<unknown> = Promise.resolve();
export function saveConstantsFile(robotRoot: string, id: string, expectedSource: string, rows: ConstantRow[]) {
  const result = pendingSave.then(() => writeConstantsFile(robotRoot, id, expectedSource, rows));
  pendingSave = result.catch(() => {});
  return result;
}

async function writeConstantsFile(robotRoot: string, id: string, expectedSource: string, rows: ConstantRow[]) {
  const allTargets = await targets(robotRoot);
  const target = allTargets.find((candidate) => candidate.id === id);
  if (!target) throw new Error("This constants file is not editable in Power Tool.");
  const configuration = await readConfiguration(robotRoot);
  const file = (await readConstantsFiles(robotRoot)).find((candidate) => candidate.id === id)!;
  if (file.error) throw new Error(file.error);
  const comparable = (source: string) => {
    return JSON.stringify(declarations(source)
      .filter((row) => (target.kind === "robot" || row.custom) && !isNativeSwerveTunable(target, row.name))
      .map(({ name, type, value, custom }) => ({ name, type, value, custom })));
  };
  if (comparable(file.source) !== comparable(expectedSource)) throw new Error("This file changed since it was loaded. Refresh before saving.");
  if (!Array.isArray(rows)) throw new Error("Invalid constants list.");
  const parsed = declarations(expectedSource);
  const editable = parsed.filter((row) => target.kind === "robot" || row.custom);
  const originals = new Map(editable.map((row) => [row.name, row]));
  rows = rows.map((row) => {
    if (!row || typeof row.name !== "string" || typeof row.type !== "string") throw new Error("Invalid constant row.");
    const original = row.originalName === null ? undefined : originals.get(row.originalName);
    const name = !original || row.name !== original.name ? row.name.replace(/\s/g, "_").toUpperCase() : row.name;
    if ((!original || row.type !== original.type) && !["String", "boolean", "int", "double"].includes(row.type)) throw new Error("Choose String, boolean, int, or double.");
    return { ...row, name, tunable: isNumericType(row.type) };
  });
  const names = new Set(parsed.filter((row) => !editable.includes(row)).map((row) => row.name));
  const usedOriginals = new Set<string>();
  for (const row of rows) {
    validateRow(row, row.originalName === null ? undefined : originals.get(row.originalName));
    if (names.has(row.name)) throw new Error(`Duplicate constant name: ${row.name}.`);
    names.add(row.name);
    if (row.originalName !== null) {
      const original = originals.get(row.originalName);
      if (!original || usedOriginals.has(row.originalName)) throw new Error("Unknown or duplicate original constant.");
      usedOriginals.add(row.originalName);
      if (!original.custom && (row.name !== original.name || row.type !== original.type)) throw new Error(`The name and type of ${original.name} are required by robot code.`);
      if (isNativeSwerveTunable(target, original.name) && !row.tunable) throw new Error(`${original.name} is already managed by Swerve tuning.`);
    }
  }
  for (const original of editable) {
    if (!original.custom && !usedOriginals.has(original.name)) throw new Error(`${original.name} is required by robot code and cannot be deleted.`);
  }
  let content = expectedSource;
  for (const original of [...editable].reverse()) {
    const row = rows.find((candidate) => candidate.originalName === original.name);
    const replacement = row ? row.name === original.name && row.type === original.type && row.value === original.value && row.tunable === (original.tunable || isNativeSwerveTunable(target, original.name))
      ? content.slice(original.start, original.end)
      : formatDeclaration(row, target) : "";
    content = content.slice(0, original.start) + replacement + content.slice(original.end);
  }
  const additions = rows.filter((row) => row.originalName === null);
  if (additions.length) {
    let range = customRange(content);
    if (!range) {
      const end = maskJava(content).lastIndexOf("}");
      if (end < 0) throw new Error("Missing constants class closing brace.");
      content = content.slice(0, end) + `  ${customStart}\n  ${customEnd}\n` + content.slice(end);
      range = customRange(content)!;
    }
    const endLine = content.lastIndexOf("\n", range.end) + 1;
    content = content.slice(0, endLine) + additions.map((row) => `  ${formatDeclaration(row, target)}\n`).join("") + content.slice(endLine);
  }
  let jsonPath: string | undefined;
  let previousJson: string | undefined;
  let nextJson: string | undefined;
  if (target.id === "robot:Swerve") {
    jsonPath = await generatedJsonPath(robotRoot, "powerlib-subsystems.json");
    try { previousJson = await fs.readFile(jsonPath, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const document = JSON.parse(previousJson ?? '{"subsystems":[]}');
    document.swerve ??= {};
    let defaultsChanged = false;
    for (const row of rows) {
      if (!row.originalName || !swervePaths[row.originalName]) continue;
      const original = parsed.find((candidate) => candidate.name === row.originalName);
      if (Number(row.value) === Number(original?.value)) continue;
      const current = declarations(file.source).find((candidate) => candidate.name === row.originalName);
      if (Number(current?.value) !== Number(original?.value)) throw new Error(`${row.name} changed since it was loaded. Refresh before saving.`);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(row.value.trim()) || !Number.isFinite(Number(row.value))) throw new Error(`${row.name} requires a finite number.`);
      const [group, key] = swervePaths[row.originalName];
      document.swerve[group] ??= {};
      document.swerve[group][key] = Number(row.value);
      defaultsChanged = true;
    }
    if (defaultsChanged) nextJson = `${JSON.stringify(document, null, 2)}\n`;
  }
  if (jsonPath && nextJson) await replaceFile(jsonPath, nextJson);
  try {
    // Import existing Java constants once; subsequent reads and generation use this configuration.
    for (const candidate of allTargets) {
      if (configuration.files[candidate.storageKey]) continue;
      const imported = await readTarget(candidate);
      if (imported.error) continue;
      configuration.files[candidate.storageKey] = { constants: imported.constants
        .filter((row) => !isNativeSwerveTunable(candidate, row.name))
        .map(({ name, type, value, custom }) => ({ name, type, value, custom, tunable: isNumericType(type) })) };
    }
    configuration.files[target.storageKey] = { constants: declarations(content)
      .filter((row) => (target.kind === "robot" || row.custom) && !isNativeSwerveTunable(target, row.name))
      .map(({ name, type, value, custom }) => ({ name, type, value, custom, tunable: isNumericType(type) })) };
    await replaceFile(await generatedJsonPath(robotRoot, "powerlib-constants.json"), `${JSON.stringify(configuration, null, 2)}\n`);
  } catch (error) {
    if (jsonPath && nextJson) {
      if (previousJson === undefined) await fs.unlink(jsonPath); else await replaceFile(jsonPath, previousJson);
    }
    throw error;
  }
  return (await readConstantsFiles(robotRoot)).find((candidate) => candidate.id === id)!;
}
