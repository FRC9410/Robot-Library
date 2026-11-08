import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { checkGeneratedCommands } from "./auto-command-check.mjs";

const project = fileURLToPath(new URL("..", import.meta.url));
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-auto-check-"));
const sourceFixture = process.env.POWERLIB_AUTO_FIXTURE || path.resolve(project, "../build/generated-robot-check");
const load = async (name, relative) => {
  const outfile = path.join(fixture, `${name}.mjs`);
  await build({ entryPoints: [path.join(project, relative)], bundle: true, platform: "node", format: "esm", outfile });
  return import(pathToFileURL(outfile).href);
};
const files = await load("files", "electron/autoFiles.ts");
const model = await load("model", "electron/autoModel.ts");
const docs = await load("documents", "electron/autoDocuments.ts");
const root = path.join(fixture, "robot");
await fs.cp(path.join(sourceFixture, "src/main/java"), path.join(root, "src/main/java"), { recursive: true });
const robotFile = relative => path.join(root, "src/main/java/frc/robot", relative);
const autoPath = path.join(root, "power-tool/generated/powerlib-autos.json");
const generatedPath = robotFile("autos/GeneratedAutos.java");
const registrationPath = robotFile("autos/RobotAutos.java");
const sourceSnapshot = async () => {
  const entries = [];
  const walk = async directory => {
    for (const item of await fs.readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, item.name);
      if (item.isDirectory()) await walk(absolute);
      else if (item.name.endsWith(".java")) entries.push([path.relative(root, absolute), await fs.readFile(absolute, "utf8")]);
    }
  };
  await walk(path.join(root, "src/main/java"));
  return new Map(entries.sort(([a], [b]) => a.localeCompare(b)));
};

try {
  await fs.writeFile(robotFile("autos/HandwrittenAutos.java"), `package frc.robot.autos;
public final class HandwrittenAutos {
  public static void register(frc.powerlib.auto.AutoBuilder builder) {
    builder.addAuto("Team route", edu.wpi.first.wpilibj2.command.Commands::none);
  }
}
`);
  assert.deepEqual(files.parseRobotStates('class StateMachine { enum RobotState { READY(1, 2), IDLE; RobotState(int... ignored) {} } }'), ["READY", "IDLE"]);
  const sampleHook = 'class RobotAutos { public static void register(AutoBuilder builder, StateMachine machine) { /* GeneratedAutos.register(builder, machine); */ String text="GeneratedAutos.register(builder, machine);"; } }';
  const hooked = files.addGeneratedAutosHook(sampleHook);
  assert.ok(hooked.includes("{\n    GeneratedAutos.register(builder, machine);"));
  assert.equal(files.addGeneratedAutosHook(hooked), hooked);

  let state = await files.readAutoFiles(root);
  assert.equal(state.error, null);
  assert.deepEqual(state.document.autos, []);
  assert.ok(state.handWrittenNames.includes("Team route"), "Names in helper classes are protected");
  const baseline = await sourceSnapshot();
  const originalRegistration = await fs.readFile(registrationPath, "utf8");
  const context = { states: state.states, field: { length: 16.541, width: 8.069 }, driveCommandInstalled: true, handWrittenNames: state.handWrittenNames };
  const auto = model.createAuto('Phase 3 "quoted" café');
  auto.isDefault = true;
  auto.clearRequestsAtEnd = false; // Legacy settings cannot opt out of the current policy.
  const drive = (x, y) => ({ ...model.createStep("drive", context), x, y, heading: 0 });
  auto.steps = [drive(1.5, 2), { ...drive(3.5, 2), executeState: state.states[0], waitForState: state.states[0], stateTimeoutSeconds: 1.5,
    endHeadingTolerance: 7 }, { ...model.createStep("wait", context), seconds: 0.25 }];
  const legacy = structuredClone({ ...model.emptyDocument(), version: 2, autos: [auto] });
  for (const step of legacy.autos[0].steps) { delete step.endHeadingTolerance; delete step.executeState; delete step.waitForState; delete step.stateTimeoutSeconds; }
  assert.equal(docs.readAutoDocument(legacy).autos[0].steps[1].endHeadingTolerance, null, "Older documents keep heading completion disabled");
  assert.equal(docs.readAutoDocument({ ...legacy, version: 3 }).autos[0].steps[1].executeState, null, "Older documents have no point state actions");
  const legacySteps = [model.createStep("requestState", context), ...legacy.autos[0].steps, model.createStep("waitForState", context)];
  assert.deepEqual(docs.readAutoDocument({ ...legacy, autos: [{ ...legacy.autos[0], steps: legacySteps }] }).autos[0].steps.map(step => step.type), legacySteps.map(step => step.type), "Legacy standalone states keep their original order and meaning");
  for (const invalid of [0, -1, 181, Number.NaN, Infinity]) {
    const bad = structuredClone({ ...model.emptyDocument(), autos: [auto] });
    bad.autos[0].steps[1].endHeadingTolerance = invalid;
    assert.ok(model.hasErrors(model.validateAutos(bad, context)), "Invalid heading tolerance blocks generation");
  }
  for (const changes of [{ executeState: "DOES_NOT_EXIST" }, { waitForState: "DOES_NOT_EXIST" }]) {
    const bad = structuredClone({ ...model.emptyDocument(), autos: [auto] }); Object.assign(bad.autos[0].steps[1], changes);
    assert.ok(model.hasErrors(model.validateAutos(bad, context)), "Invalid point actions block generation");
  }
  for (const [executeState, waitForState] of [[null, null], [state.states[0], null], [null, state.states[0]]]) {
    const sample = { ...model.emptyDocument(), autos: [{ ...model.createAuto("Optional actions"), steps: [{ ...drive(2, 2), executeState, waitForState }] }] };
    const code = model.generateAutosJava(sample, context);
    assert.equal(code.includes("new RequestState("), executeState !== null);
    assert.equal(code.includes("Commands.waitUntil("), waitForState !== null);
  }
  const blue = { ...model.createAuto("Blue wait"), alliance: "Blue", steps: [model.createStep("wait", context)] };
  let document = { ...model.emptyDocument(), futureMetadata: { preserved: true }, autos: [{ ...auto, futureFlag: "keep" }, blue] };
  state = await files.saveAutoFiles(root, document, state.revision);
  assert.deepEqual(await sourceSnapshot(), baseline, "Saving the authoring document never generates Java");
  assert.deepEqual(state.document.futureMetadata, { preserved: true });
  assert.equal(state.document.autos[0].futureFlag, "keep");
  assert.equal(state.document.autos[0].isDefault, false, "Legacy defaults are removed");
  assert.equal(state.document.autos[0].clearRequestsAtEnd, true, "Legacy cleanup opt-out is removed");
  assert.equal(state.document.autos[0].steps[1].endHeadingTolerance, 7, "Heading completion persists");
  assert.equal(state.document.autos[0].steps[1].executeState, state.states[0]);
  assert.equal(state.document.autos[0].steps[1].waitForState, state.states[0]);
  assert.equal(state.document.autos[0].steps[1].stateTimeoutSeconds, null, "Previously saved point timeouts are disabled");
  const oldWait = { ...model.createStep("waitForState", context), timeoutSeconds: 0.01 };
  assert.equal(docs.readAutoDocument({ ...model.emptyDocument(), autos: [{ ...auto, steps: [oldWait] }] }).autos[0].steps[0].timeoutSeconds, null, "Previously saved standalone state timeouts are disabled");
  assert.ok(!model.generateAutosJava({ ...model.emptyDocument(), autos: [{ ...auto, steps: [oldWait] }] }, context).includes('.withTimeout('), "Raw legacy settings cannot re-enable state timeouts");
  const savedRaw = await fs.readFile(autoPath, "utf8");
  await assert.rejects(() => files.saveAutoFiles(root, document, "stale"), /changed since/);
  assert.equal(await fs.readFile(autoPath, "utf8"), savedRaw);
  await assert.rejects(() => files.generateAutoCode(root, state.revision, "stale", context.field), /Robot source changed/);

  const result = await files.generateAutoCode(root, state.revision, state.sourceRevision, context.field);
  assert.equal(await fs.readFile(registrationPath, "utf8"), files.addGeneratedAutosHook(originalRegistration));
  const after = await sourceSnapshot();
  assert.deepEqual([...after].filter(([name, value]) => baseline.get(name) !== value).map(([name]) => name.replaceAll("\\", "/")),
    ["src/main/java/frc/robot/autos/GeneratedAutos.java", ...(result.hookAdded ? ["src/main/java/frc/robot/autos/RobotAutos.java"] : [])].sort());
  let java = await fs.readFile(generatedPath, "utf8");
  assert.ok(java.includes('.finallyDo(interrupted -> robot.clearRequest(OWNER))'), "Cancellation clears owned state requests");
  assert.ok(!java.includes('setDefaultAuto'), "Generated autos never replace None as the default");
  assert.equal(java.match(/\.finallyDo\(interrupted -> robot.clearRequest\(OWNER\)\)/g)?.length, 2, "Every routine always cleans up, including routines without requests");
  assert.ok(!model.generateAutosJava(document, context).includes('setDefaultAuto'), "Generator ignores legacy default flags even without parsing");
  assert.ok(java.includes('Alliance.Blue, () ->'), "Chooser alliance metadata is preserved");
  assert.ok(java.includes('Commands.waitUntil(() -> robot.getActualState()'), "Wait uses actual state");
  assert.ok(!java.includes('.withTimeout('), "Point state waits never time out, including with legacy settings");
  assert.equal(java.match(/\.withHeadingTolerance\(/g)?.length, 1, "Only opted-in legs wait for heading");
  assert.ok(java.includes('.withHeadingTolerance(Rotation2d.fromDegrees(7.0))'));
  assert.ok(java.includes('if (RobotBase.isSimulation()) robot.drivetrain.resetPose(start);'));
  state = result.state;
  await files.generateAutoCode(root, state.revision, state.sourceRevision, context.field);
  assert.equal(await fs.readFile(generatedPath, "utf8"), java, "Repeated generation is byte-stable");

  const duplicate = structuredClone(document); duplicate.autos[0].name = "Team route";
  state = await files.saveAutoFiles(root, duplicate, state.revision);
  await assert.rejects(() => files.generateAutoCode(root, state.revision, state.sourceRevision, context.field), /already uses the name/);
  assert.equal(await fs.readFile(generatedPath, "utf8"), java);
  duplicate.autos[0].name = "None";
  assert.ok(model.hasErrors(model.validateAutos(duplicate, context)));
  duplicate.autos[0].name = document.autos[1].name;
  assert.ok(model.hasErrors(model.validateAutos(duplicate, context)));
  const badState = structuredClone(document); badState.autos[0].steps[1].executeState = "DOES_NOT_EXIST";
  assert.ok(model.hasErrors(model.validateAutos(badState, context)));
  for (const bad of [
    { ...document, version: 99 }, { ...document, autos: [{ ...auto, steps: [{ id: "unknown", type: "future" }] }] },
    { ...document, autos: [{ ...auto, symmetry: { flipX: true, flipY: false } }] },
    { ...document, autos: [{ ...auto, steps: [{ ...auto.steps[0], x: null }] }] },
    { ...document, autos: [{ ...auto, steps: [{ ...auto.steps[0], endHeadingTolerance: "7" }] }] },
    { ...document, autos: [{ ...auto, steps: [{ ...auto.steps[0], executeState: 123 }] }] },
    { ...document, autos: [{ ...auto, steps: [{ ...auto.steps[0], stateTimeoutSeconds: "1" }] }] },
    { ...document, autos: [{ ...auto, steps: [auto.steps[0], auto.steps[0]] }] }
  ]) assert.throws(() => docs.readAutoDocument(bad));

  for (const contents of ["{ broken", JSON.stringify({ ...document, version: 99 }), JSON.stringify({ ...document, autos: [{ ...auto, steps: [{ id: "future", type: "future" }] }] })]) {
    await fs.writeFile(autoPath, contents);
    const protectedState = await files.readAutoFiles(root);
    assert.ok(protectedState.error); assert.equal(protectedState.document, null);
    await assert.rejects(() => files.saveAutoFiles(root, document, protectedState.revision));
    assert.equal(await fs.readFile(autoPath, "utf8"), contents);
    assert.equal(await fs.readFile(generatedPath, "utf8"), java);
  }
  await fs.writeFile(autoPath, savedRaw); state = await files.readAutoFiles(root);
  await fs.writeFile(generatedPath, "package frc.robot.autos; public class GeneratedAutos {}\n");
  state = await files.readAutoFiles(root);
  await assert.rejects(() => files.generateAutoCode(root, state.revision, state.sourceRevision, context.field), /handwritten code/);
  await fs.writeFile(generatedPath, java);

  // Force a failed second write; the shared source transaction must restore the first file.
  await fs.writeFile(registrationPath, originalRegistration.replace(/\s*GeneratedAutos\.register\([^;]+;/g, ""));
  state = await files.readAutoFiles(root);
  document = structuredClone(document); document.autos[0].name = "Rollback check";
  state = await files.saveAutoFiles(root, document, state.revision);
  const beforeFailure = await sourceSnapshot();
  const rename = fs.rename;
  let injected = false;
  fs.rename = async (from, to) => {
    if (/[\\/]RobotAutos\.java$/.test(String(to))) { injected = true; throw Error("Injected registration failure"); }
    return rename(from, to);
  };
  try { await assert.rejects(() => files.generateAutoCode(root, state.revision, state.sourceRevision, context.field), /Injected registration failure/); }
  finally { fs.rename = rename; }
  assert.ok(injected); assert.deepEqual(await sourceSnapshot(), beforeFailure, "Failed generation rolls back both Java files");
  state = await files.readAutoFiles(root);
  state = (await files.generateAutoCode(root, state.revision, state.sourceRevision, context.field)).state;

  if (!process.argv.includes("--skip-compile")) {
    const javaHome = process.env.POWERLIB_JAVA_HOME || path.join(process.env.PUBLIC || "C:/Users/Public", "wpilib/2026/jdk");
    const jarsDirectory = path.resolve(project, "../build/library-checks/dependencies");
    const jars = (await fs.readdir(jarsDirectory)).filter(name => name.endsWith(".jar")).map(name => path.join(jarsDirectory, name));
    const classes = path.join(fixture, "classes"); await fs.mkdir(classes);
    const sources = [...(await sourceSnapshot()).keys()].map(name => path.join(root, name));
    const argumentsFile = path.join(fixture, "javac.args");
    await fs.writeFile(argumentsFile, ["-encoding", "UTF-8", "-cp", jars.join(path.delimiter), "-d", classes, ...sources]
      .map(value => JSON.stringify(value.replaceAll("\\", "/"))).join("\n"));
    const compiled = spawnSync(path.join(javaHome, "bin", process.platform === "win32" ? "javac.exe" : "javac"), [`@${argumentsFile}`], { encoding: "utf8" });
    assert.equal(compiled.status, 0, compiled.stderr || compiled.error?.message);
    console.log("Generated autos compile with the complete robot source and real WPILib/vendor dependencies.");
    await checkGeneratedCommands({ fixture, root, classes, jars, javaHome, states: state.states, autoName: state.document.autos[0].name,
      native: path.resolve(project, "../build/library-checks/native") });
  }
  state = await files.saveAutoFiles(root, model.emptyDocument(), state.revision);
  await files.generateAutoCode(root, state.revision, state.sourceRevision, context.field);
  assert.ok((await fs.readFile(generatedPath, "utf8")).includes("No autos yet"));
  assert.equal((await fs.readFile(registrationPath, "utf8")).match(/GeneratedAutos\.register\(/g).length, 1);
  console.log("Auto editor checks passed: round-trip/metadata, source preservation, stale saves, version/step protection, name/state validation, Java generation, idempotent hook, failure rollback, and empty-document cleanup.");
  console.log("Fixture: " + fixture);
} catch (error) {
  console.error(error.message); console.error(String(error.stack).slice(0, 2000)); process.exitCode = 1;
}
