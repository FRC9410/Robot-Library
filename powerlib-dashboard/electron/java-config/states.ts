import { digest, robotSource, stateMachinePath, type SourceProject } from "./project.js";
import { closing, maskJava, replaceSpans, splitExpressions, stripComments, type Span } from "./source.js";
import { validateStateConfig, type StateConfig } from "../stateConfig.js";

export const stateClass = (name: string) => name.split("_").map(part => part[0] + part.slice(1).toLowerCase()).join("") + "State";
const directory = `${robotSource}/subsystems/states`;

export function newStateSource(name: string) {
  return `package frc.robot.subsystems.states;

// POWERLIB STATE: ${name}
import frc.powerlib.statemachine.State;
import frc.robot.subsystems.StateMachine;
import frc.robot.subsystems.StateMachine.RobotState;

public class ${stateClass(name)} implements State<RobotState, StateMachine> {
  @Override
  public boolean match(RobotState requestedState, StateMachine stateMachine) {
    return requestedState == RobotState.${name};
  }

  @Override
  public void execute(RobotState requestedState, StateMachine stateMachine) {
    // TODO: implement ${name} actions and readiness conditions.
    stateMachine.setActualState(RobotState.${name});
  }
}
`;
}

function stateStructure(source: string) {
  const mask = maskJava(source);
  const declaration = /\benum\s+RobotState\s*\{/.exec(mask);
  if (!declaration) throw Error("Could not read StateMachine.RobotState.");
  const open = declaration.index + declaration[0].length - 1;
  const end = closing(mask, open);
  const enumRange = { start: open + 1, end };
  const names = splitExpressions(source, enumRange).map(range => stripComments(source.slice(range.start, range.end)).trim().replace(/;$/, ""));
  if (names.some(name => !/^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/.test(name))) throw Error("RobotState contains custom enum logic. Its state list is read-only.");
  const registration = /\bList\s*<\s*(?:frc\.powerlib\.statemachine\.)?State\s*<\s*RobotState\s*,\s*StateMachine\s*>\s*>\s+states\s*=\s*(?:java\.util\.)?List\s*\.\s*of\s*\(/.exec(mask);
  if (!registration) throw Error("StateMachine.states uses an unsupported registration expression; keep a List.of(...) registry to edit states in Power Tool.");
  const registryOpen = registration.index + registration[0].length - 1;
  const registryRange = { start: registryOpen + 1, end: closing(mask, registryOpen) };
  const entries = splitExpressions(source, registryRange).map(range => {
    const expression = source.slice(range.start, range.end);
    const clean = maskJava(expression).trim();
    const constructor = /^new\s+(?:frc\.robot\.subsystems\.states\.)?([\w$]+)\s*\(/.exec(clean);
    let className = constructor?.[1];
    if (!className && /^(?:this\.)?[A-Za-z_$][\w$]*$/.test(clean)) {
      const field = clean.replace(/^this\./, "");
      className = new RegExp(`\\b(?:frc\\.robot\\.subsystems\\.states\\.)?([\\w$]+)\\s+${field}\\s*=`).exec(mask)?.[1];
    }
    if (!className) throw Error(`Unsupported state registration: ${expression}`);
    return { expression, className };
  });
  return { names, enumRange, registryRange, entries };
}

async function handlerCoverage(project: SourceProject, names: string[], entries: ReturnType<typeof stateStructure>["entries"]) {
  const covered = new Set<string>();
  const diagnostics: string[] = [];
  let opaque = false;
  for (const entry of entries) {
    const canonical = names.find(name => stateClass(name) === entry.className);
    const contents = await project.read(`${directory}/${entry.className}.java`, true);
    if (canonical) { covered.add(canonical); if (!contents) diagnostics.push(`Missing ${entry.className}.java.`); continue; }
    const mask = maskJava(contents);
    const method = /\bboolean\s+match\s*\([^)]*\)\s*\{/.exec(mask);
    const references = method ? [...mask.slice(method.index + method[0].length, closing(mask, method.index + method[0].length - 1)).matchAll(/\bRobotState\s*\.\s*([A-Z][A-Z0-9_]*)\b/g)].map(match => match[1]) : [];
    if (!references.length) opaque = true;
    for (const name of references) covered.add(name);
  }
  for (const name of names) if (!covered.has(name)) diagnostics.push(`${name} has no identifiable registered handler${opaque ? "; preserve the custom registry and adjust it in Java" : ""}.`);
  return { covered, opaque, diagnostics };
}

export async function readStates(project: SourceProject) {
  const source = await project.read(stateMachinePath);
  const structure = stateStructure(source);
  const states = [...structure.names.filter(name => name !== "IDLE"), "IDLE"];
  validateStateConfig({ states });
  const coverage = await handlerCoverage(project, states, structure.entries);
  return { path: stateMachinePath, config: { states, sourceRevision: digest(source) }, revision: digest(source), diagnostics: coverage.diagnostics, repairable: !coverage.opaque };
}

async function checkReferences(project: SourceProject, removed: string[], removedFiles: Set<string>, structure: ReturnType<typeof stateStructure>) {
  for (const file of await project.files()) {
    if (removedFiles.has(file)) continue;
    let source = await project.read(file);
    if (file === stateMachinePath) source = replaceSpans(source, [structure.enumRange, structure.registryRange].map(range => ({ ...range, text: "" })));
    let mask = maskJava(source);
    for (const name of removed) {
      const className = stateClass(name);
      if (file === stateMachinePath) mask = mask.replace(new RegExp(`^import frc\\.robot\\.subsystems\\.states\\.${className};\\s*$`, "gm"), "");
      if (new RegExp(`\\b(?:RobotState\\s*\\.\\s*|case\\s+(?:[A-Z0-9_]+\\s*,\\s*)*)${name}\\b`).test(mask)
        || new RegExp(`\\b${className}\\b`).test(mask)) throw Error(`Cannot remove ${name}: ${file} still references it. Update those Java references first.`);
    }
  }
}

async function renameState(project: SourceProject, before: string, after: string) {
  const oldClass = stateClass(before);
  const nextClass = stateClass(after);
  const oldFile = `${directory}/${oldClass}.java`;
  const nextFile = `${directory}/${nextClass}.java`;
  if (oldFile !== nextFile && oldFile.toLowerCase() === nextFile.toLowerCase()) throw Error("This rename changes only the handler filename casing. Choose a distinct state name.");
  if (oldFile.toLowerCase() !== nextFile.toLowerCase() && await project.read(nextFile, true)) throw Error(`${nextClass}.java already exists.`);
  for (const relative of await project.files()) {
    const source = await project.read(relative);
    const mask = maskJava(source);
    if (new RegExp(`\\bcase\\s+(?:[A-Z0-9_]+\\s*,\\s*)*${before}\\b`).test(mask)) throw Error(`Rename ${before} in the IDE first: ${relative} contains an unqualified switch case.`);
    const edits: Array<Span & { text: string }> = [];
    for (const match of mask.matchAll(new RegExp(`\\bRobotState\\s*\\.\\s*${before}\\b`, "g"))) edits.push({ start: match.index!, end: match.index! + match[0].length, text: `RobotState.${after}` });
    const localClass = relative === stateMachinePath || relative === oldFile || /\bpackage\s+frc\.robot\.subsystems\.states\s*;/.test(mask)
      || new RegExp(`import\\s+frc\\.robot\\.subsystems\\.states\\.${oldClass}\\s*;`).test(mask);
    const pattern = localClass ? new RegExp(`\\b${oldClass}\\b`, "g") : new RegExp(`\\bfrc\\.robot\\.subsystems\\.states\\.${oldClass}\\b`, "g");
    for (const match of mask.matchAll(pattern)) edits.push({ start: match.index!, end: match.index! + match[0].length, text: localClass ? nextClass : `frc.robot.subsystems.states.${nextClass}` });
    if (edits.length) await project.set(relative, replaceSpans(source, edits));
  }
  if (oldFile !== nextFile && await project.read(oldFile, true)) {
    const contents = await project.read(oldFile);
    await project.set(oldFile, null);
    await project.set(nextFile, contents);
  }
}

export async function writeStates(project: SourceProject, config: StateConfig & { renameHandlers?: Record<string, string> }, revision?: string) {
  const desired = [...config.states.filter(name => name !== "IDLE"), "IDLE"];
  validateStateConfig({ ...config, states: desired });
  await project.assertRevision(stateMachinePath, revision ?? config.sourceRevision);
  let source = await project.read(stateMachinePath);
  const initial = stateStructure(source);
  const renames = config.renameHandlers ?? {};
  for (const [before, after] of Object.entries(renames)) {
    if (!initial.names.includes(before) || before === "IDLE" || !desired.includes(after) || desired.includes(before)) throw Error("Invalid state rename.");
    await renameState(project, before, after);
  }
  source = await project.read(stateMachinePath);
  const structure = stateStructure(source);
  const removed = initial.names.filter(name => !desired.includes(name) && !(name in renames));
  const removedFiles = new Set(removed.map(name => `${directory}/${stateClass(name)}.java`));
  for (const name of removed) {
    if (name === "IDLE" || !(config.deleteHandlers ?? []).includes(name)) throw Error(`Confirm deletion of ${name} and its Java file in Config.`);
    if (desired.some(next => stateClass(next).toLowerCase() === stateClass(name).toLowerCase())) throw Error("State names conflict on a case-insensitive filesystem.");
  }
  await checkReferences(project, removed, removedFiles, structure);
  const entries = structure.entries.filter(entry => !removed.some(name => stateClass(name) === entry.className) && entry.className !== "IdleState");
  const idle = structure.entries.filter(entry => entry.className === "IdleState");
  if (idle.length > 1) throw Error("IdleState is registered more than once.");
  const coverage = await handlerCoverage(project, desired, structure.entries);
  for (const name of desired) {
    const className = stateClass(name);
    const canonical = structure.entries.some(entry => entry.className === className);
    // Do not add an unconditional starter behind a handwritten guard for an existing state.
    if (name !== "IDLE" && !canonical && (coverage.covered.has(name) || coverage.opaque && initial.names.includes(name))) continue;
    const relative = `${directory}/${className}.java`;
    if (!await project.read(relative, true)) await project.set(relative, newStateSource(name));
    if (name !== "IDLE" && !entries.some(entry => entry.className === className)) entries.push({ className, expression: `new frc.robot.subsystems.states.${className}()` });
  }
  const expressions = [...entries.map(entry => entry.expression), idle[0]?.expression ?? "new frc.robot.subsystems.states.IdleState()"];
  source = replaceSpans(source, [
    { ...structure.enumRange, text: `\n    ${desired.join(",\n    ")}\n  ` },
    { ...structure.registryRange, text: `\n          ${expressions.map(expression => /\/\/[^\r\n]*$/.test(expression) ? expression + "\n" : expression).join(",\n          ")}` }
  ]);
  for (const name of removed) source = source.replace(new RegExp(`^import frc\\.robot\\.subsystems\\.states\\.${stateClass(name)};\\r?\\n`, "gm"), "");
  source = source.replace(/activeState\s*=\s*states\.get\(0\)/, "activeState = states.get(states.size() - 1)").replace(/private boolean requestsChanged\s*;/, "private boolean requestsChanged = true;");
  await project.set(stateMachinePath, source);
  for (const relative of removedFiles) await project.set(relative, null);
}
