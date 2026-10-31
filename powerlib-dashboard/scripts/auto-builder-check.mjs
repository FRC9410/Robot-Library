import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const load = async (relative) => {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))], bundle: true, write: false,
    format: "esm", platform: "node", packages: "external" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
};
const model = await load("../src/features/autos/autoModel.ts");
const replay = await load("../src/features/autos/autoReplay.ts");
const files = await load("../electron/autoFiles.ts");

const field = { length: 16.54, width: 8.07 };
const project = { states: ["IDLE", "INTAKE", "SHOOT"], driveCommandInstalled: true, field };
const limits = { maxVelocity: 3, maxAcceleration: 3, endDistanceTolerance: 0.05, endVelocityTolerance: 0.1 };
const auto = {
  id: "a", name: "Blue \"3\" piece", alliance: "Blue", isDefault: true, clearRequestsAtEnd: true, symmetry: { flipX: false, flipY: false },
  steps: [
    { id: "1", type: "requestState", state: "INTAKE" },
    { id: "2", type: "drive", x: 2, y: 3.5, heading: 90, subpoints: [], ...limits, maxVelocity: 2.5 },
    { id: "3", type: "waitForState", state: "SHOOT", timeoutSeconds: 1.5, replaySeconds: 0.5 },
    { id: "4", type: "wait", seconds: 0 }
  ]
};
const document = { version: 1, autos: [auto, { id: "b", name: "Shoot only", alliance: null, isDefault: false, clearRequestsAtEnd: true,
  symmetry: { flipX: false, flipY: false }, steps: [{ id: "5", type: "waitForState", state: "IDLE", timeoutSeconds: null, replaySeconds: 0.5 }] }] };

// Code generation: drive legs use DriveToPose with their own DriveConstraints, so no AutoBuilder factory is needed.
assert.deepEqual(model.validateAutos(document, project), []);
const java = model.generateAutosJava(document, project);
assert.ok(java.startsWith(model.generatedAutosHeader), "Generated source must start with the ownership header");
assert.match(java, /autoBuilder\.setDefaultAuto\(new Auto\("Blue \\"3\\" piece"\)/);
assert.match(java, /\.withAlliance\(Alliance\.Blue\)/);
assert.match(java, /\.addCommand\(\(\) -> new RequestState\(RobotState\.INTAKE, OWNER, robot\)\)/);
assert.match(java, /\.addCommand\(\(\) -> new DriveToPose\(robot\.drivetrain, new Pose2d\(2\.0, 3\.5, Rotation2d\.fromDegrees\(90\.0\)\), new DriveConstraints\(2\.5, 3\.0, 0\.05, 0\.1\)\)\)/);
assert.doesNotMatch(java, /addDriveToPoint/);
assert.match(java, /Commands\.waitUntil\(\(\) -> robot\.getActualState\(\) == RobotState\.SHOOT\)\.withTimeout\(1\.5\)/);
assert.match(java, /Commands\.waitSeconds\(0\.0\)/);
assert.equal((java.match(/robot\.clearRequest\(OWNER\)/g) ?? []).length, 1, "Only autos that request states clear requests");
assert.match(java, /autoBuilder\.addAuto\(new Auto\("Shoot only"\)\n        \.addCommand\(\(\) -> Commands\.waitUntil\(\(\) -> robot\.getActualState\(\) == RobotState\.IDLE\)\)\);/);
assert.ok(java.indexOf("RequestState(RobotState.INTAKE") < java.indexOf("DriveToPose("), "Steps keep their order");
assert.match(model.generateAutosJava(model.emptyDocument(), project), /No autos yet/);

// Symmetry: flips are involutions, and a mirrored copy is registered for the other alliance.
const point = { x: 2, y: 1, heading: 30 };
assert.deepEqual(model.flipPoint(point, { flipX: true, flipY: false }, field), { x: 14.54, y: 1, heading: 150 });
assert.deepEqual(model.flipPoint(point, { flipX: false, flipY: true }, field), { x: 2, y: 7.07, heading: -30 });
assert.deepEqual(model.flipPoint(point, { flipX: true, flipY: true }, field), { x: 14.54, y: 7.07, heading: -150 });
for (const flips of [{ flipX: true, flipY: false }, { flipX: false, flipY: true }, { flipX: true, flipY: true }]) {
  assert.deepEqual(model.flipPoint(model.flipPoint(point, flips, field), flips, field), point);
}
const mirroredDoc = { version: 1, autos: [{ ...auto, isDefault: false, symmetry: { flipX: true, flipY: false } }] };
const mirror = model.mirroredAuto(mirroredDoc.autos[0], field);
assert.equal(mirror.name, "Blue \"3\" piece (Red)");
assert.equal(mirror.alliance, "Red");
assert.equal(mirror.steps[1].x, 14.54);
assert.equal(mirror.steps[1].heading, 90);
assert.equal(mirror.steps[1].maxVelocity, 2.5, "Mirrors keep each leg's limits");
const mirroredJava = model.generateAutosJava(mirroredDoc, project);
assert.match(mirroredJava, /new Auto\("Blue \\"3\\" piece \(Red\)"\)\n        \.withAlliance\(Alliance\.Red\)/);
assert.match(mirroredJava, /new Pose2d\(14\.54, 3\.5, Rotation2d\.fromDegrees\(90\.0\)\)/);
assert.equal(model.mirroredAuto({ ...auto, alliance: null, symmetry: { flipX: false, flipY: true } }, field).name, "Blue \"3\" piece (mirrored)");
assert.equal(model.mirroredAuto(auto, field), null);

// Validation mirrors the robot's own checks.
const messages = (doc, overrides = {}) => model.validateAutos(doc, { ...project, ...overrides }).map(issue => `${issue.severity}: ${issue.message}`);
const withAuto = (patch) => ({ version: 1, autos: [{ ...auto, ...patch }] });
const drive = (patch) => ({ id: "x", type: "drive", x: 1, y: 1, heading: 0, subpoints: [], ...limits, ...patch });
assert.ok(messages(withAuto({ name: " " })).some(text => text.startsWith("error: Give this auto a name")));
assert.ok(messages(withAuto({ name: "None" })).some(text => text.includes("reserved")));
assert.ok(messages({ version: 1, autos: [auto, { ...auto, id: "c" }] }).some(text => text.includes("Another auto")));
assert.ok(messages({ version: 1, autos: [auto, { ...auto, id: "c", name: "Other" }] }).some(text => text.includes("Only one auto can be the default")));
assert.ok(messages({ version: 1, autos: [{ ...auto, isDefault: false, symmetry: { flipX: true, flipY: false } }, { ...auto, id: "c", isDefault: false, name: "Blue \"3\" piece (Red)" }] })
  .some(text => text.includes("mirrored copy's name")));
assert.ok(messages(document, { driveCommandInstalled: false }).some(text => text.includes("missing the DriveToPose command")));
assert.deepEqual(messages(document, { driveCommandInstalled: null }), [], "Unknown installs do not block code generation");
assert.ok(messages(withAuto({ steps: [drive({ x: 20 })] })).includes("warning: This point is outside the field."));
assert.ok(messages(withAuto({ steps: [drive({ x: Number.NaN })] })).some(text => text.startsWith("error: Enter a finite")));
for (const key of ["maxVelocity", "maxAcceleration", "endDistanceTolerance", "endVelocityTolerance"]) {
  assert.ok(messages(withAuto({ steps: [drive({ [key]: 0 })] })).some(text => text.includes("must be a positive number")), key);
}
assert.ok(messages(withAuto({ steps: [{ id: "x", type: "requestState", state: "GONE" }] })).some(text => text.includes("RobotState.GONE does not exist")));
assert.ok(messages(withAuto({ steps: [{ id: "x", type: "waitForState", state: "IDLE", timeoutSeconds: 0, replaySeconds: 0 }] })).some(text => text.includes("timeout")));
assert.ok(messages(withAuto({ steps: [{ id: "x", type: "wait", seconds: -1 }] })).some(text => text.includes("non-negative")));
assert.throws(() => model.generateAutosJava(withAuto({ name: "" }), project), /Fix the auto errors/);

// Saved documents round-trip; older documents get default limits and no symmetry.
const parsed = model.parseAutoDocument(JSON.parse(JSON.stringify({ ...document, autos: [{ ...auto, steps: [...auto.steps, { type: "teleport" }] }] })));
assert.deepEqual(parsed.autos[0], auto);
const legacy = model.parseAutoDocument({ autos: [{ id: "l", name: "Old", steps: [{ id: "d", type: "drive", x: 1, y: 2, heading: 0 },
  { id: "w", type: "waitForState", state: "IDLE", timeoutSeconds: null }] }] });
assert.deepEqual(legacy.autos[0].steps[0], { id: "d", type: "drive", x: 1, y: 2, heading: 0, subpoints: [], ...model.defaultConstraints });
assert.equal(legacy.autos[0].steps[1].replaySeconds, 0.5);
assert.deepEqual(legacy.autos[0].symmetry, { flipX: false, flipY: false });
assert.deepEqual(model.parseAutoDocument(null), model.emptyDocument());
assert.deepEqual(model.requestedStateAtSteps(auto), ["INTAKE", "INTAKE", "INTAKE", "INTAKE"]);
assert.equal(model.normalizeHeading(270), -90);
assert.equal(model.normalizeHeading(-180), 180);

// Replay uses the robot controller's math: DriveToPoseControllerTest expects 99 cycles for this leg.
const leg = replay.simulateLeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 0 }, limits);
assert.equal(leg.cycles, 99);
assert.ok(leg.finished && Math.abs(leg.position.x - 3) <= 0.05);
const corner = replay.simulateLeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 3, y: 0 }, { ...limits, endDistanceTolerance: 0.5, endVelocityTolerance: 3 });
assert.ok(Math.hypot(corner.velocity.x, corner.velocity.y) > 1, "Loose tolerances release the leg while moving");
let peak = 0;
let previous = corner.velocity;
replay.simulateLeg(corner.position, corner.velocity, { x: 3, y: 3 }, limits, (_, velocity) => {
  peak = Math.max(peak, Math.hypot(velocity.x - previous.x, velocity.y - previous.y) / replay.loopPeriodSeconds);
  previous = velocity;
});
assert.ok(peak <= 3 + 1e-6, "Blending into the next leg respects max acceleration");

const route = { ...auto, steps: [drive({ id: "p1", x: 1, y: 1 }), { id: "r", type: "requestState", state: "INTAKE" },
  drive({ id: "p2", x: 4, y: 1 }), { id: "w", type: "wait", seconds: 0.5 }, drive({ id: "p3", x: 4, y: 3, heading: 90 })] };
const played = replay.replayAuto(route);
assert.deepEqual(played.segments.map(segment => segment.stepId), ["p1", "r", "p2", "w", "p3", "clear"]);
assert.ok(played.segments.every((segment, index) => index === 0 || segment.start === played.segments[index - 1].end), "Segments are contiguous");
assert.ok(played.segments.every(segment => segment.end - segment.start >= replay.loopPeriodSeconds - 1e-9), "Every command takes a cycle");
const wait = played.segments.find(segment => segment.stepId === "w");
assert.ok(Math.abs(wait.end - wait.start - 0.5) < 1e-9);
assert.equal(played.segments.find(segment => segment.stepId === "p2").state, "INTAKE");
assert.deepEqual(played.unfinishedStepIds, []);
const last = replay.frameAt(played, played.duration);
assert.ok(Math.hypot(last.x - 4, last.y - 3) <= 0.05);
assert.equal(last.heading, 90, "Heading reaches the target by the end");
assert.equal(replay.frameAt(played, 0).x, 1, "Replay starts at point 1");
assert.equal(replay.segmentAt(played, 0).stepId, "p1");
assert.deepEqual(replay.replayAuto({ ...auto, steps: [{ id: "w", type: "wait", seconds: 1 }] }).frames, []);

// Subpoints: state requests partway along a drive leg (DriveToPose.atProgress).
const sub = (id, progress, state) => ({ id, progress, state });
const subAuto = { ...auto, isDefault: false, steps: [drive({ id: "q1", x: 1, y: 1 }),
  drive({ id: "q2", x: 4, y: 1, subpoints: [sub("late", 0.8, "SHOOT"), sub("early", 0.25, "INTAKE")] }),
  drive({ id: "q3", x: 4, y: 3, endDistanceTolerance: 0.5, endVelocityTolerance: 3, subpoints: [sub("skipped", 0.95, "IDLE")] })] };
const subDoc = { version: 1, autos: [subAuto] };
assert.deepEqual(model.validateAutos(subDoc, project), []);
const subJava = model.generateAutosJava(subDoc, project);
assert.match(subJava, /new DriveToPose\(robot\.drivetrain, new Pose2d\(4\.0, 1\.0, Rotation2d\.fromDegrees\(0\.0\)\), new DriveConstraints\(3\.0, 3\.0, 0\.05, 0\.1\)\)\n {12}\.atProgress\(0\.25, \(\) -> robot\.requestState\(RobotState\.INTAKE, OWNER\)\)\n {12}\.atProgress\(0\.8, \(\) -> robot\.requestState\(RobotState\.SHOOT, OWNER\)\)\)/,
  "Subpoints are generated in progress order");
assert.match(subJava, /robot\.clearRequest\(OWNER\)/, "Subpoint requests are cleared at the end too");
assert.deepEqual(model.requestedStateAtSteps(subAuto), [null, null, "SHOOT"], "A leg's own subpoints apply after it starts");
assert.ok(messages(withAuto({ steps: [drive({ subpoints: [sub("s", 1.2, "INTAKE")] })] })).some(text => text.includes("between 0% and 100%")));
assert.ok(messages(withAuto({ steps: [drive({ subpoints: [sub("s", 0.5, "GONE")] })] })).some(text => text.includes("RobotState.GONE")));
assert.ok(messages(withAuto({ steps: [drive({ subpoints: [sub("s", 0.5, "")] })] })).some(text => text.includes("Choose a state for each subpoint")));
assert.deepEqual(model.mirroredAuto({ ...subAuto, symmetry: { flipX: true, flipY: false } }, field).steps[1].subpoints, subAuto.steps[1].subpoints,
  "Mirrored copies keep subpoints, which are fractions of the leg");
const reparsed = model.parseAutoDocument(JSON.parse(JSON.stringify(subDoc)));
assert.deepEqual(reparsed.autos[0].steps[1].subpoints, subAuto.steps[1].subpoints);

// Same values as LegSubpointsTest.progressProjectsOntoTheLeg.
const p = (x, y) => ({ x, y });
assert.equal(replay.legProgress(p(1, 1), p(1, 1), p(5, 1)), 0);
assert.equal(replay.legProgress(p(1, 1), p(3, 2), p(5, 1)), 0.5);
assert.equal(replay.legProgress(p(1, 1), p(7, 1), p(5, 1)), 1);
assert.equal(replay.legProgress(p(1, 1), p(0, 1), p(5, 1)), 0);
assert.equal(replay.legProgress(p(5, 1), p(5, 1), p(5, 1)), 1);

const subReplay = replay.replayAuto(subAuto);
const changes = subReplay.stateChanges.filter(change => change.subpointId);
assert.deepEqual(changes.map(change => change.subpointId), ["early", "late", "skipped"]);
const legTwo = subReplay.segments.find(segment => segment.stepId === "q2");
const early = changes[0], late = changes[1], skipped = changes[2];
assert.ok(early.t > legTwo.start && late.t > early.t && late.t < legTwo.end, "Subpoints fire during their leg, in order");
const earlyFrame = replay.frameAt(subReplay, early.t);
assert.ok(Math.abs((earlyFrame.x - 1) / 3 - 0.25) < 0.05, "A subpoint fires near its fraction of the leg");
assert.equal(skipped.t, subReplay.segments.find(segment => segment.stepId === "q3").end, "Subpoints past a loose finish run when the leg ends");
assert.equal(replay.stateAt(subReplay, early.t - 0.01), null);
assert.equal(replay.stateAt(subReplay, early.t), "INTAKE");
assert.equal(replay.stateAt(subReplay, late.t), "SHOOT");
assert.equal(replay.stateAt(subReplay, subReplay.duration), null, "End-of-auto clear");

// Names used in RobotAutos.java would make AutoBuilder throw on duplicates at robot startup.
assert.deepEqual(files.parseStringLiterals('// "Commented"\nnew Route("Red Left", RED);\nlog("say \\"hi\\"");\n/* "Block" */'), ["Red Left", "say \"hi\""]);
assert.ok(messages(document, { handWrittenNames: ["Shoot only"] }).includes(
  "error: RobotAutos.java already uses the name \"Shoot only\". Duplicate auto names stop robot code at startup; rename this auto."));
assert.ok(messages(mirroredDoc, { handWrittenNames: ["Blue \"3\" piece (Red)"] }).some(text => text.includes("already uses the name")),
  "Mirrored copies are checked too");

// Project parsing reads the robot files the installer creates.
const root = fileURLToPath(new URL("../../templates/replacements/src/main/java/frc/robot/", import.meta.url));
const read = (file) => fs.readFile(path.join(root, file), "utf8");
assert.deepEqual(files.parseRobotStates(await read("subsystems/StateMachine.java")), ["IDLE"]);
assert.deepEqual(files.parseRobotStates("enum RobotState {\n  // IDLE_OLD,\n  IDLE(\"x\"), INTAKE,\n  SHOOT;\n  RobotState() {} }"), ["IDLE", "INTAKE", "SHOOT"]);
assert.match(await read("RobotContainer.java"), /new AutoBuilder\(pose -> new DriveToPose\(stateMachine\.drivetrain, pose\)\)/,
  "Hand-written autos get the DriveToPose factory");
const robotAutos = await read("autos/RobotAutos.java");
assert.ok(files.hasGeneratedAutosHook(robotAutos), "The RobotAutos template registers generated autos");
const legacyAutos = "public final class RobotAutos {\r\n  public static void register(AutoBuilder builder, StateMachine sm) {\r\n    // GeneratedAutos.register(builder, sm);\r\n  }\r\n}\r\n";
const hooked = files.addGeneratedAutosHook(legacyAutos);
assert.ok(hooked.includes("{\r\n    GeneratedAutos.register(builder, sm);\r\n    // GeneratedAutos"), "Hook uses the file's parameter names and line endings");
assert.equal(files.addGeneratedAutosHook(hooked), hooked);
assert.throws(() => files.addGeneratedAutosHook("class RobotAutos {}"), /Could not find RobotAutos\.register/);

// Update code writes the JSON and Java, adds the hook once, and never replaces a hand-written GeneratedAutos.
const robotRoot = await fs.mkdtemp(path.join(os.tmpdir(), "powerlib-autos-"));
try {
  const autosDirectory = path.join(robotRoot, "src", "main", "java", "frc", "robot", "autos");
  await fs.mkdir(autosDirectory, { recursive: true });
  await fs.writeFile(path.join(autosDirectory, "RobotAutos.java"), legacyAutos);
  assert.equal((await files.readAutoFiles(robotRoot)).driveCommandInstalled, false);
  const result = await files.updateAutoCode(robotRoot, document, java);
  assert.equal(result.hookAdded, true);
  assert.equal(await fs.readFile(path.join(autosDirectory, "GeneratedAutos.java"), "utf8"), java);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(robotRoot, "power-tool", "generated", "powerlib-autos.json"), "utf8")), document);
  assert.equal((await files.updateAutoCode(robotRoot, document, java)).hookAdded, false);
  assert.equal(result.state.robotAutosHooked, true);
  for (const file of ["src/main/java/frc/robot/commands/DriveToPose.java", "src/main/java/frc/powerlib/auto/DriveConstraints.java"]) {
    await fs.mkdir(path.dirname(path.join(robotRoot, file)), { recursive: true });
    await fs.writeFile(path.join(robotRoot, file), "// installed\n");
  }
  assert.equal((await files.readAutoFiles(robotRoot)).driveCommandInstalled, true);
  await assert.rejects(files.updateAutoCode(robotRoot, document, "class GeneratedAutos {}"), /Invalid generated auto source/);
  await fs.writeFile(path.join(autosDirectory, "GeneratedAutos.java"), "public final class GeneratedAutos {}\n");
  await assert.rejects(files.updateAutoCode(robotRoot, document, java), /was not written by Power Tool/);
} finally {
  await fs.rm(robotRoot, { recursive: true, force: true });
}

console.log("Auto builder checks passed.");
