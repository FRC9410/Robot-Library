import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { readAutoDocument } from "./autoDocuments.js";
import { emptyDocument, generateAutosJava, generatedAutosHeader, hasErrors, validateAutos, type AutoDocument, type AutoProject } from "./autoModel.js";
import { digest, robotSource, sourceOperation, stateMachinePath, type SourceProject } from "./java-config/project.js";
import { closing, maskJava, splitExpressions, stripComments } from "./java-config/source.js";

export const generatedAutoPath = `${robotSource}/autos/GeneratedAutos.java`;
const robotAutosPath = `${robotSource}/autos/RobotAutos.java`;
const robotChecksPath = `${robotSource}/helpers/RobotChecks.java`;
const jsonRelative = "power-tool/generated/powerlib-autos.json";
const maxBytes = 8 * 1024 * 1024;

async function jsonPath(root: string) {
  const filename = path.resolve(root, jsonRelative);
  for (let current = filename; current !== path.resolve(root); current = path.dirname(current)) {
    const info = await fs.lstat(current).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (info?.isSymbolicLink()) throw Error("Auto documents cannot be saved through symbolic links.");
  }
  return filename;
}

async function readJson(root: string) {
  const filename = await jsonPath(root);
  try {
    if ((await fs.stat(filename)).size > maxBytes) throw Error("Auto document exceeds 8 MB.");
    return await fs.readFile(filename, "utf8");
  } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export function parseRobotStates(source: string) {
  const mask = maskJava(source);
  const match = /\benum\s+RobotState\s*\{/.exec(mask);
  if (!match) return [];
  const opening = match.index + match[0].length - 1;
  let end = closing(mask, opening);
  for (let index = opening + 1; index < end; index++) {
    if ("([{".includes(mask[index])) index = closing(mask, index);
    else if (mask[index] === ";") { end = index; break; }
  }
  return splitExpressions(source, { start: opening + 1, end })
    .map(range => /^\s*([A-Za-z_$][\w$]*)/.exec(mask.slice(range.start, range.end))?.[1]).filter((name): name is string => !!name);
}

/** Signatures/fields declared directly on a class, excluding method bodies and nested classes. */
function classMembers(source: string, name: "StateMachine" | "RobotChecks") {
  const mask = maskJava(source);
  const declaration = new RegExp(`\\bclass\\s+${name}\\b[^{}]*\\{`).exec(mask);
  if (!declaration) return "";
  const opening = declaration.index + declaration[0].length - 1;
  const end = closing(mask, opening);
  let body = "";
  for (let at = opening + 1; at < end; at++) {
    if (mask[at] === "{") { at = closing(mask, at); body += ";"; }
    else body += mask[at];
  }
  return body;
}

/** Only public no-argument boolean instance methods in the dedicated checks bucket. */
export function parseRobotChecks(source: string) {
  const body = classMembers(source, "RobotChecks");
  return [...new Set([...body.matchAll(/(?:^|(?<=[;}]))\s*(?:@[\w.]+\s*)*public\s+(?:(?:final|synchronized)\s+)*boolean\s+([A-Za-z_$][\w$]*)\s*\(\s*\)\s*;/g)].map(match => match[1]))];
}

function strings(source: string) {
  return [...stripComments(source).matchAll(/"((?:\\.|[^"\\])*)"/g)].map(match => {
    try { return JSON.parse(`"${match[1]}"`) as string; } catch { return match[1]; }
  });
}

/** The registration must be executable code inside the actual register method, never a comment/string. */
export function addGeneratedAutosHook(source: string) {
  const mask = maskJava(source);
  const signature = /\bpublic\s+static\s+void\s+register\s*\(\s*(?:final\s+)?(?:frc\.powerlib\.auto\.)?AutoBuilder\s+([A-Za-z_$][\w$]*)\s*,\s*(?:final\s+)?(?:frc\.robot\.subsystems\.)?StateMachine\s+([A-Za-z_$][\w$]*)\s*\)\s*\{/.exec(mask);
  if (!signature) throw Error("Could not find RobotAutos.register(AutoBuilder, StateMachine). Add its registration in Java before generating autos.");
  const opening = signature.index + signature[0].length - 1;
  const body = mask.slice(opening + 1, closing(mask, opening));
  if (/\bGeneratedAutos\s*\.\s*register\s*\(/.test(body)) return source;
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return `${source.slice(0, opening + 1)}${newline}    GeneratedAutos.register(${signature[1]}, ${signature[2]});${source.slice(opening + 1)}`;
}

async function metadata(project: SourceProject) {
  const machine = await project.read(stateMachinePath, true);
  const checks = await project.read(robotChecksPath, true);
  const checksConnected = /(?:^|(?<=[;}]))\s*public\s+(?:final\s+)?(?:frc\.robot\.helpers\.)?RobotChecks\s+checks\s*[=;]/.test(classMembers(machine, "StateMachine"));
  const robotAutos = await project.read(robotAutosPath, true);
  const generatedSource = await project.read(generatedAutoPath, true);
  const drive = await project.read(`${robotSource}/commands/DriveToPose.java`, true);
  const handWrittenNames: string[] = [];
  for (const relative of await project.files()) {
    if (relative === generatedAutoPath) continue;
    const source = await project.read(relative);
    // This conservative inventory also catches helper classes such as the P2 demo autos.
    if (/\b(?:addAuto|setDefaultAuto|new\s+Auto)\b/.test(maskJava(source))) handWrittenNames.push(...strings(source));
  }
  const constraints = await fs.access(path.join(project.root, "src/main/java/frc/powerlib/auto/DriveConstraints.java")).then(() => true, () => false);
  const sources = new Map(project.originals);
  for (const [relative, value] of project.edits) sources.set(relative, value);
  const sourceRevision = digest(JSON.stringify([...sources].sort(([a], [b]) => a.localeCompare(b))));
  return { states: parseRobotStates(machine), checks: checksConnected ? parseRobotChecks(checks) : [], driveCommandInstalled: !!drive && constraints,
    handWrittenNames: [...new Set(handWrittenNames)], sourceRevision, generatedSource,
    robotAutosInstalled: !!robotAutos, robotAutosHooked: !!robotAutos && addGeneratedAutosHook(robotAutos) === robotAutos };
}

export type AutoFilesState = Awaited<ReturnType<typeof readAutoFiles>>;

async function state(project: SourceProject) {
  const info = await metadata(project);
  const raw = await readJson(project.root);
  let document: AutoDocument | null = null;
  let error: string | null = null;
  try { document = raw === null ? emptyDocument() : readAutoDocument(JSON.parse(raw.replace(/^\uFEFF/, ""))); }
  catch (caught) { error = caught instanceof Error ? caught.message : "Could not read the auto document."; }
  return { ...info, path: path.join(project.root, jsonRelative), document, revision: digest(raw ?? ""), error };
}

export function readAutoFiles(root: string) { return sourceOperation(root, state); }

function checkRevision(raw: string | null, expected: unknown) {
  if (typeof expected !== "string" || expected !== digest(raw ?? "")) throw Error("The auto document changed since it was loaded. Your draft has been kept; reload to review the external changes.");
  // Check the saved version/structure independently of anything the renderer sent.
  if (raw !== null) readAutoDocument(JSON.parse(raw.replace(/^\uFEFF/, "")));
}

export function saveAutoFiles(root: string, value: unknown, revision: unknown) {
  return sourceOperation(root, async project => {
    const raw = await readJson(root); checkRevision(raw, revision);
    const document = readAutoDocument(value);
    const previous = await state(project);
    const json = JSON.stringify(document, null, 2) + "\n";
    if (Buffer.byteLength(json, "utf8") > maxBytes) throw Error("Auto document exceeds 8 MB.");
    const filename = await jsonPath(root);
    await fs.mkdir(path.dirname(filename), { recursive: true });
    const temporary = `${filename}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, json);
      if (await readJson(root) !== raw) throw Error("The auto document changed during this save. Your draft has been kept.");
      await fs.rename(temporary, filename);
    } finally { await fs.rm(temporary, { force: true }); }
    // No fallible source discovery after the atomic write: a rejected save must not have committed JSON.
    return { ...previous, document, revision: digest(json), error: null };
  });
}

export async function generateAutoCode(root: string, revision: unknown, sourceRevision: unknown, field: unknown) {
  const dimensions = field as AutoProject["field"] | null;
  if (!dimensions || ![dimensions.length, dimensions.width].every(value => typeof value === "number" && Number.isFinite(value) && value > 0)) throw Error("Choose valid field dimensions before generating autos.");
  return sourceOperation(root, async project => {
    const raw = await readJson(root); checkRevision(raw, revision);
    const current = await state(project);
    if (current.error || !current.document) throw Error(current.error ?? "Could not read autos.");
    if (sourceRevision !== current.sourceRevision) throw Error("Robot source changed since it was loaded. Reload the editor before generating Java; your draft has been kept.");
    if (!current.robotAutosInstalled) throw Error("Install RobotAutos.java before generating autos.");
    if (!current.driveCommandInstalled) throw Error("Install the Phase 2 drive commands before generating autos.");
    const issues = validateAutos(current.document, { ...current, field: dimensions });
    if (hasErrors(issues)) throw Error(issues.find(issue => issue.severity === "error")!.message);
    const javaSource = generateAutosJava(current.document, { ...current, field: dimensions });
    if (current.generatedSource && !current.generatedSource.startsWith(generatedAutosHeader)) throw Error("GeneratedAutos.java contains handwritten code. Rename it before generating autos.");
    const before = await project.read(robotAutosPath);
    const hooked = addGeneratedAutosHook(before);
    await project.set(generatedAutoPath, javaSource);
    if (hooked !== before) await project.set(robotAutosPath, hooked);
    const updated = await state(project);
    if (await readJson(root) !== raw) throw Error("The auto document changed during generation. Reload before trying again.");
    return { generatedPath: path.join(root, generatedAutoPath), hookAdded: before !== hooked, state: updated };
  });
}
