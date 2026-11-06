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
const snap = await load("../src/features/autos/autoSnap.ts");
const replay = await load("../src/features/autos/autoReplay.ts");
const files = await load("../electron/autoFiles.ts");
const actual = await load("../src/features/autos/autoActual.ts");
const prematch = await load("../src/features/drive/preMatch.ts");
const speed = await load("../src/features/autos/autoLimits.ts");
const sight = await load("../src/features/autos/autoVision.ts");
const obstacles = await load("../src/features/field/fieldObstacles.ts");
const collisions = await load("../src/features/autos/autoCollisions.ts");
const edits = await load("../src/features/autos/autoEdits.ts");
const routing = await load("../src/features/autos/autoRoute.ts");
const keys = await load("../src/features/autos/autoKeys.ts");
const columns = await load("../src/features/autos/autoColumns.ts");
const dragging = await load("../src/features/autos/fieldDrag.ts");
const rows = await load("../src/features/autos/stepListRows.ts");
const drawing = await load("../src/features/field/rebuiltDrawing.ts");

const field = { length: 16.54, width: 8.07 };
const project = { states: ["IDLE", "INTAKE", "SHOOT"], driveCommandInstalled: true, field };
const limits = { maxVelocity: 3, maxAcceleration: 3, endDistanceTolerance: 0.05, endVelocityTolerance: 0.1 };
const turnNow = { turn: { mode: "now" }, maxTurnRate: null, pointId: null };
const auto = {
  id: "a", name: "Blue \"3\" piece", alliance: "Blue", isDefault: true, clearRequestsAtEnd: true, symmetry: { flipX: false, flipY: false },
  steps: [
    { id: "1", type: "requestState", state: "INTAKE" },
    { id: "2", type: "drive", x: 2, y: 3.5, heading: 90, subpoints: [], ...turnNow, ...limits, maxVelocity: 2.5 },
    { id: "3", type: "waitForState", state: "SHOOT", timeoutSeconds: 1.5, replaySeconds: 0.5 },
    { id: "4", type: "wait", seconds: 0 }
  ]
};
const drive = (patch) => ({ id: "x", type: "drive", x: 1, y: 1, heading: 0, subpoints: [], ...turnNow, ...limits, ...patch });
const document = { version: 1, points: [], autos: [auto, { id: "b", name: "Shoot only", alliance: null, isDefault: false, clearRequestsAtEnd: true,
  symmetry: { flipX: false, flipY: false }, steps: [{ id: "5", type: "waitForState", state: "IDLE", timeoutSeconds: null, replaySeconds: 0.5 }] }] };

// Code generation: drive legs use DriveToPose with their own DriveConstraints, so no AutoBuilder factory is needed.
assert.deepEqual(model.validateAutos(document, project), []);
const java = model.generateAutosJava(document, project);
assert.ok(java.startsWith(model.generatedAutosHeader), "Generated source must start with the ownership header");
assert.match(java, /autoBuilder\.setDefaultAuto\(new Auto\("Blue \\"3\\" piece"\)/);
assert.match(java, /\.withAlliance\(Alliance\.Blue\)/);
// A request right before a move joins that move as it starts, so the robot never stops for it.
assert.doesNotMatch(java, /new RequestState\(RobotState\.INTAKE/);
assert.match(java, /\.addCommand\(\(\) -> new DriveToPose\(robot\.drivetrain, new Pose2d\(2\.0, 3\.5, Rotation2d\.fromDegrees\(90\.0\)\), new DriveConstraints\(2\.5, 3\.0, 0\.05, 0\.1\)\)\n {12}\.atProgress\(0\.0, \(\) -> robot\.requestState\(RobotState\.INTAKE, OWNER\)\)\)/);
// A request before a wait stays its own step.
const waitFirst = model.generateAutosJava({ version: 1, points: [], autos: [{ ...auto, steps: [{ id: "q", type: "requestState", state: "SHOOT" }, { id: "w", type: "wait", seconds: 1 }] }] }, project);
assert.match(waitFirst, /\.addCommand\(\(\) -> new RequestState\(RobotState\.SHOOT, OWNER, robot\)\)/);
assert.doesNotMatch(java, /addDriveToPoint/);
// Simulation has no vision, so autos with a drive step start the simulated robot at point 1.
assert.match(java, /\.withAlliance\(Alliance\.Blue\)\n {8}\.addCommand\(\(\) -> startInSimulation\(robot, new Pose2d\(2\.0, 3\.5, Rotation2d\.fromDegrees\(90\.0\)\)\)\)/);
assert.match(java, /if \(RobotBase\.isSimulation\(\)\) robot\.drivetrain\.resetPose\(start\);/);
assert.equal((java.match(/\.addCommand\(\(\) -> startInSimulation/g) ?? []).length, 1, "Autos without a drive step get no start pose");
assert.match(java, /Commands\.waitUntil\(\(\) -> robot\.getActualState\(\) == RobotState\.SHOOT\)\.withTimeout\(1\.5\)/);
assert.match(java, /Commands\.waitSeconds\(0\.0\)/);
assert.equal((java.match(/robot\.clearRequest\(OWNER\)/g) ?? []).length, 1, "Only autos that request states clear requests");
assert.match(java, /autoBuilder\.addAuto\(new Auto\("Shoot only"\)\n        \.addCommand\(\(\) -> Commands\.waitUntil\(\(\) -> robot\.getActualState\(\) == RobotState\.IDLE\)\)\);/);
assert.ok(java.indexOf("DriveToPose(") < java.indexOf("RobotState.SHOOT"), "Steps keep their order");
assert.match(model.generateAutosJava(model.emptyDocument(), project), /No autos yet/);

// Symmetry: flips are involutions, and a mirrored copy is registered for the other alliance.
const point = { x: 2, y: 1, heading: 30 };
assert.deepEqual(model.flipPoint(point, { flipX: true, flipY: false }, field), { x: 14.54, y: 1, heading: 150 });
assert.deepEqual(model.flipPoint(point, { flipX: false, flipY: true }, field), { x: 2, y: 7.07, heading: -30 });
assert.deepEqual(model.flipPoint(point, { flipX: true, flipY: true }, field), { x: 14.54, y: 7.07, heading: -150 });
for (const flips of [{ flipX: true, flipY: false }, { flipX: false, flipY: true }, { flipX: true, flipY: true }]) {
  assert.deepEqual(model.flipPoint(model.flipPoint(point, flips, field), flips, field), point);
}
const mirroredDoc = { version: 1, points: [], autos: [{ ...auto, isDefault: false, symmetry: { flipX: true, flipY: false } }] };
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
const withAuto = (patch) => ({ version: 1, points: [], autos: [{ ...auto, ...patch }] });
assert.ok(messages(withAuto({ name: " " })).some(text => text.startsWith("error: Give this auto a name")));
assert.ok(messages(withAuto({ name: "None" })).some(text => text.includes("reserved")));
assert.ok(messages({ version: 1, points: [], autos: [auto, { ...auto, id: "c" }] }).some(text => text.includes("Another auto")));
assert.ok(messages({ version: 1, points: [], autos: [auto, { ...auto, id: "c", name: "Other" }] }).some(text => text.includes("Only one auto can be the default")));
assert.ok(messages({ version: 1, points: [], autos: [{ ...auto, isDefault: false, symmetry: { flipX: true, flipY: false } }, { ...auto, id: "c", isDefault: false, name: "Blue \"3\" piece (Red)" }] })
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
assert.deepEqual(legacy.autos[0].steps[0], { id: "d", type: "drive", x: 1, y: 2, heading: 0, subpoints: [], ...turnNow, ...model.defaultConstraints });
assert.deepEqual(legacy.points, [], "Older documents have no named points");
assert.equal(legacy.autos[0].steps[1].replaySeconds, 0.5);
assert.deepEqual(legacy.autos[0].symmetry, { flipX: false, flipY: false });
assert.deepEqual(model.parseAutoDocument(null), model.emptyDocument());
assert.equal(model.emptyDocument().periodSeconds, 20, "REBUILT autonomous is 20 s");
assert.equal(model.parseAutoDocument({ autos: [], periodSeconds: 15 }).periodSeconds, 15, "A saved period is kept");
assert.equal(model.parseAutoDocument({ autos: [], periodSeconds: -3 }).periodSeconds, 20, "An invalid period falls back to 20 s");
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
assert.ok(played.segments.every(segment => segment.stepId === "r" || segment.end - segment.start >= replay.loopPeriodSeconds - 1e-9), "Every command takes a cycle");
assert.equal(played.segments.find(segment => segment.stepId === "r").end, played.segments.find(segment => segment.stepId === "r").start,
  "A request that joins the next move takes no time");

// A request between two loose legs must not stop the robot: the corner is the same curve as without it.
const loose = { endDistanceTolerance: 0.6, endVelocityTolerance: 3 };
const cornerAuto = (withRequest) => replay.replayAuto({ ...auto, clearRequestsAtEnd: false, steps: [drive({ id: "c1", x: 1, y: 1 }),
  drive({ id: "c2", x: 5, y: 1, ...loose }), ...(withRequest ? [{ id: "cr", type: "requestState", state: "INTAKE" }] : []),
  drive({ id: "c3", x: 5, y: 5, heading: 90 })] });
const plain = cornerAuto(false), withRequest = cornerAuto(true);
assert.equal(withRequest.duration, plain.duration, "The request adds no time");
assert.deepEqual(withRequest.frames.map(frame => [frame.x, frame.y]), plain.frames.map(frame => [frame.x, frame.y]), "Same curved path with the request");
const exitSpeed = withRequest.frames.find(frame => frame.t >= withRequest.segments.find(segment => segment.stepId === "c2").end - 1e-9).speed;
assert.ok(exitSpeed > 1, "The robot is still moving when the request is made");
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
const subDoc = { version: 1, points: [], autos: [subAuto] };
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

// Turning during a leg (DriveToPose.turningAfter / facing / withMaxTurnRate), same rules as LegHeading.java.
const turnAuto = (turnStep) => ({ ...auto, isDefault: false, clearRequestsAtEnd: false, steps: [drive({ id: "t1", x: 1, y: 1 }), turnStep] });
const laterStep = drive({ id: "t2", x: 5, y: 1, heading: 90, turn: { mode: "later", startProgress: 0.5 } });
const faceStep = drive({ id: "t2", x: 5, y: 1, heading: 0, turn: { mode: "face", x: 3, y: 5, pointId: null } });
const turnJava = model.generateAutosJava({ version: 1, points: [], autos: [{ ...turnAuto(laterStep), steps: [...turnAuto(laterStep).steps,
  drive({ id: "t3", x: 6, y: 2, maxTurnRate: 90, subpoints: [sub("s", 0.5, "SHOOT")] }), { ...faceStep, id: "t4" }] }] }, project);
assert.match(turnJava, /new Pose2d\(5\.0, 1\.0, Rotation2d\.fromDegrees\(90\.0\)\), new DriveConstraints\(3\.0, 3\.0, 0\.05, 0\.1\)\)\n {12}\.turningAfter\(0\.5\)\)/);
assert.match(turnJava, /\.withMaxTurnRate\(Math\.toRadians\(90\.0\)\)\n {12}\.atProgress\(0\.5, /, "Turn options come before subpoints");
assert.match(turnJava, /new Pose2d\(5\.0, 1\.0, Rotation2d\.fromDegrees\(116\.57\)\), new DriveConstraints\(3\.0, 3\.0, 0\.05, 0\.1\)\)\n {12}\.facing\(new Translation2d\(3\.0, 5\.0\)\)\)/,
  "A leg that faces a point ends facing it");
assert.match(turnJava, /import edu\.wpi\.first\.math\.geometry\.Translation2d;/);
assert.doesNotMatch(java, /Translation2d/, "Autos that never face a spot don't import Translation2d");
assert.equal(model.legEndHeading(faceStep), 116.57);
assert.equal(model.legEndHeading(drive({ heading: 30, turn: { mode: "face", x: 1, y: 1, pointId: null } })), 30, "A face point on the target keeps its heading");
assert.ok(messages(withAuto({ steps: [drive({ turn: { mode: "later", startProgress: 1.5 } })] })).includes("error: The turn must start between 0% and 100% of the leg."));
assert.ok(messages(withAuto({ steps: [drive({ turn: { mode: "face", x: 1.1, y: 1, pointId: null } })] })).some(text => text.startsWith("warning: The point to face is on top")));
assert.ok(messages(withAuto({ steps: [drive({ turn: { mode: "face", x: Number.NaN, y: 1, pointId: null } })] })).includes("error: Enter a finite point to face."));
assert.ok(messages(withAuto({ steps: [drive({ maxTurnRate: 0 })] })).some(text => text.startsWith("error: Max turn rate")));

const headingAt = (played, stepId, fraction) => {
  const segment = played.segments.find(candidate => candidate.stepId === stepId);
  return replay.frameAt(played, segment.start + (segment.end - segment.start) * fraction).heading;
};
const laterReplay = replay.replayAuto(turnAuto(laterStep));
assert.equal(headingAt(laterReplay, "t2", 0.2), 0, "Turning later keeps the starting heading early in the leg");
assert.equal(replay.frameAt(laterReplay, laterReplay.duration).heading, 90);
assert.ok(headingAt(replay.replayAuto(turnAuto({ ...laterStep, turn: { mode: "now" } })), "t2", 0.2) > 45, "Turning now starts right away");
const faceReplay = replay.replayAuto(turnAuto(faceStep));
for (const fraction of [0.5, 0.75]) {
  const segment = faceReplay.segments.find(candidate => candidate.stepId === "t2");
  const frame = replay.frameAt(faceReplay, segment.start + (segment.end - segment.start) * fraction);
  assert.ok(Math.abs(frame.heading - Math.atan2(5 - frame.y, 3 - frame.x) * 180 / Math.PI) < 3, "Facing a point keeps aiming at it while driving");
}
assert.ok(Math.abs(replay.frameAt(faceReplay, faceReplay.duration).heading - 116.57) < 1);
assert.equal(replay.replayAuto({ ...auto, steps: [faceStep] }).frames[0].heading, 116.57, "A first leg that faces a point starts facing it");
const slowTurn = replay.replayAuto(turnAuto({ ...laterStep, turn: { mode: "now" }, maxTurnRate: 30 }));
const turnRates = slowTurn.frames.slice(1).map((frame, index) => Math.abs(frame.heading - slowTurn.frames[index].heading) / (frame.t - slowTurn.frames[index].t || 1));
assert.ok(Math.max(...turnRates) <= 30 + 1e-6, "A leg's max turn rate limits the replay");
assert.ok(headingAt(slowTurn, "t2", 1) < 90, "Legs finish on position, so a slow turn can still be going when the leg ends, like on the robot");

// Named points: saved once, reused across autos, generated as constants.
const hub = { id: "hub", name: "Hub", x: 4.6, y: 4.03, heading: 0 };
const shot = { id: "shot", name: "Shot spot", x: 3, y: 4, heading: 180 };
const unused = { id: "unused", name: "Unused", x: 1, y: 1, heading: 0 };
const pointAuto = (id, name) => ({ ...auto, id, name, isDefault: false, clearRequestsAtEnd: false, steps: [drive({ id: `${id}1`, x: 1, y: 1 }),
  drive({ id: `${id}2`, x: 3, y: 4, heading: 180, pointId: "shot" }),
  drive({ id: `${id}3`, x: 2, y: 6, turn: { mode: "face", x: 4.6, y: 4.03, pointId: "hub" } })] });
const pointDoc = { version: 1, points: [hub, shot, unused], autos: [pointAuto("A", "Left"), pointAuto("B", "Right")] };
assert.deepEqual(model.validateAutos(pointDoc, project), []);
const pointJava = model.generateAutosJava(pointDoc, project);
assert.match(pointJava, /private static final Pose2d HUB = new Pose2d\(4\.6, 4\.03, Rotation2d\.fromDegrees\(0\.0\)\);\n  private static final Pose2d SHOT_SPOT = new Pose2d\(3\.0, 4\.0, Rotation2d\.fromDegrees\(180\.0\)\);/);
assert.doesNotMatch(pointJava, /UNUSED/, "Only points autos use become constants");
assert.equal((pointJava.match(/new DriveToPose\(robot\.drivetrain, SHOT_SPOT, /g) ?? []).length, 2, "Linked steps use the constant");
assert.equal((pointJava.match(/\.facing\(HUB\.getTranslation\(\)\)/g) ?? []).length, 2, "Linked face points use the constant");
const collide = model.generateAutosJava({ ...pointDoc, points: [{ ...hub, name: "3rd hub" }, { ...shot, name: "owner" }] }, project);
assert.match(collide, /Pose2d POINT_3RD_HUB = /);
assert.match(collide, /Pose2d OWNER_2 = /, "Constants never shadow OWNER");
const twins = model.generateAutosJava({ ...pointDoc, points: [{ ...hub, name: "Shot spot" }, shot] }, project);
assert.match(twins, /Pose2d SHOT_SPOT = new Pose2d\(4\.6/);
assert.match(twins, /Pose2d SHOT_SPOT_2 = new Pose2d\(3\.0/);

// Moving a point moves every linked step and face target, in every auto.
const moved = model.setNamedPoint(pointDoc, { ...shot, x: 3.5, heading: 170 });
for (const routine of moved.autos) assert.deepEqual([routine.steps[1].x, routine.steps[1].y, routine.steps[1].heading], [3.5, 4, 170]);
const movedHub = model.setNamedPoint(pointDoc, { ...hub, y: 4.5 });
assert.ok(movedHub.autos.every(routine => routine.steps[2].turn.y === 4.5 && routine.steps[2].y === 6), "Facing steps aim at the moved point");
// Dragging a linked step moves the point, which carries the other autos' steps with it.
const dragged = model.syncNamedPoints({ ...pointDoc, autos: pointDoc.autos.map(routine => routine.id !== "A" ? routine
  : { ...routine, steps: routine.steps.map(step => step.id === "A2" ? { ...step, x: 2.5, y: 4.5 } : step) }) }, "A");
assert.deepEqual(dragged.points.find(point => point.id === "shot"), { ...shot, x: 2.5, y: 4.5 });
assert.deepEqual([dragged.autos[1].steps[1].x, dragged.autos[1].steps[1].y], [2.5, 4.5]);
assert.equal(model.syncNamedPoints(pointDoc, "A"), pointDoc, "Nothing changes when linked steps sit on their points");
const deleted = model.deleteNamedPoint(pointDoc, "shot");
assert.ok(deleted.autos.every(routine => routine.steps[1].pointId === null && routine.steps[1].x === 3), "Deleting a point keeps its steps where they are");
assert.equal(model.deleteNamedPoint(pointDoc, "hub").autos[0].steps[2].turn.pointId, null);
assert.equal(model.uniquePointName(pointDoc), "Point 4");
// Mirrored steps no longer sit on their points, so they are unlinked and use plain poses.
const flipped = model.flipSteps(pointDoc.autos[0].steps, { flipX: true, flipY: false }, field);
assert.ok(flipped.every(step => step.pointId === null && (step.turn.mode !== "face" || step.turn.pointId === null)));
assert.equal(flipped[2].turn.x, 11.94);
// Saved documents keep points; a step linked to a missing point is unlinked and steps follow their points.
const savedPoints = model.parseAutoDocument(JSON.parse(JSON.stringify({ ...pointDoc, points: [{ ...shot, x: 3.2 }, hub, { id: "bad", name: "Bad", x: "?", y: 1 }],
  autos: [{ ...pointDoc.autos[0], steps: [...pointDoc.autos[0].steps, drive({ id: "A4", pointId: "gone" })] }] })));
assert.deepEqual(savedPoints.points.map(point => point.id), ["shot", "hub"], "Points without a usable spot are dropped");
assert.equal(savedPoints.autos[0].steps[1].x, 3.2, "Linked steps follow their point when loaded");
assert.equal(savedPoints.autos[0].steps[3].pointId, null);

// Recorded runs: one per enabled autonomous period, light enough for long runs.
const recorder = new actual.RunRecorder();
const sample = (time, mode, pose, enabled = true) => recorder.update({ time, mode, enabled, autoName: "Left", pose });
assert.deepEqual(sample(0, "TELEOP", { x: 1, y: 1, heading: 0 }), { run: null, ended: false }, "Teleop is not recorded");
assert.deepEqual(sample(10, "AUTO", { x: 1, y: 1, heading: 0 }, false), { run: null, ended: false }, "Disabled autonomous is not recorded");
let recorded = sample(1000, "AUTO", { x: 1, y: 1, heading: 0 }).run;
assert.equal(recorded.autoName, "Left");
assert.equal(sample(1020, "AUTO", { x: 1.005, y: 1, heading: 0.5 }).run.points.length, 1, "Tiny moves are skipped");
assert.equal(sample(1040, "AUTO", undefined).run.points.length, 1, "A missing pose keeps the run going");
recorded = sample(1500, "AUTO", { x: 1.5, y: 1, heading: 10 }).run;
assert.deepEqual(recorded.points.at(-1), { t: 0.5, x: 1.5, y: 1, heading: 10 });
assert.equal(recorded.seconds, 0.5);
const ended = sample(1600, "TELEOP", { x: 1.5, y: 1, heading: 10 });
assert.ok(ended.ended && ended.run.points.length === 2, "The run ends when autonomous does");
assert.deepEqual(sample(1700, "TELEOP", { x: 2, y: 1, heading: 10 }), { run: null, ended: false });
assert.deepEqual(actual.readRuns(), {}, "Without saved runs there is nothing to show");

// Branches: Then and Otherwise sides of steps; the field and replay follow one side, the robot picks with Commands.either.
const branch = (patch) => ({ id: "b", type: "branch", condition: { kind: "state", state: "SHOOT", waitSeconds: 0 }, then: [], otherwise: [], ...patch });
const pause = (id) => ({ id, type: "wait", seconds: 1 });
const shape = (steps) => steps.map(step => step.type === "branch" ? { [step.id]: [shape(step.then), shape(step.otherwise)] } : step.id);
const branchSteps = [
  drive({ id: "s1", x: 1, y: 1 }),
  branch({ then: [{ id: "r1", type: "requestState", state: "INTAKE" }, drive({ id: "t1", x: 3, y: 1 })], otherwise: [drive({ id: "o1", x: 1, y: 3 })] }),
  drive({ id: "s2", x: 4, y: 4 })
];
assert.deepEqual(model.allSteps(branchSteps).map(step => step.id), ["s1", "b", "r1", "t1", "o1", "s2"]);
assert.deepEqual(model.routeSteps(branchSteps).map(step => step.id), ["s1", "b", "r1", "t1", "s2"], "Routes take Then unless told otherwise");
assert.deepEqual(model.routeSteps(branchSteps, { b: "otherwise" }).map(step => step.id), ["s1", "b", "o1", "s2"]);
assert.deepEqual(model.locateStep(branchSteps, "o1"), { list: { branchId: "b", arm: "otherwise" }, index: 0 });
assert.deepEqual(model.locateStep(branchSteps, "s2"), { list: null, index: 2 });
assert.equal(model.mapSteps(branchSteps, step => step), branchSteps, "Mapping that changes nothing keeps the lists");

// Adding, moving and deleting steps inside branches.
assert.deepEqual(shape(model.insertStepsAt(branchSteps, { after: "r1" }, [pause("w")])), ["s1", { b: [["r1", "w", "t1"], ["o1"]] }, "s2"], "New steps go after the selected step, on its side");
assert.deepEqual(shape(model.insertStepsAt(branchSteps, { into: { branchId: "b", arm: "otherwise" } }, [pause("w")])), ["s1", { b: [["r1", "t1"], ["o1", "w"]] }, "s2"]);
assert.deepEqual(shape(model.insertStepsAt(branchSteps, { after: "t1" }, [branch({ id: "b2" })])), ["s1", { b: [["r1", "t1"], ["o1"]] }, { b2: [[], []] }, "s2"], "A branch added inside a branch goes after it");
assert.deepEqual(shape(model.insertStepsAt(branchSteps, { after: null }, [pause("w")])), ["s1", { b: [["r1", "t1"], ["o1"]] }, "s2", "w"]);
assert.deepEqual(shape(model.moveStepsInto(branchSteps, ["s2"], { branchId: "b", arm: "otherwise" }, 0)), ["s1", { b: [["r1", "t1"], ["s2", "o1"]] }]);
assert.deepEqual(shape(model.moveStepsInto(branchSteps, ["o1", "t1"], null, 0)), ["t1", "o1", "s1", { b: [["r1"], []] }, "s2"], "Moved steps keep their run order");
assert.equal(model.moveStepsInto(branchSteps, ["b"], { branchId: "b", arm: "then" }, 0), branchSteps, "A branch can't move into a branch");
assert.deepEqual(shape(model.moveStepsInto(branchSteps, ["b", "t1"], null, 3)), ["s1", "s2", { b: [["r1", "t1"], ["o1"]] }], "Steps inside a moving branch travel with it");
assert.equal(model.moveStepsInto(branchSteps, ["s1"], null, 1), branchSteps, "Dropping a step where it already is changes nothing");
assert.deepEqual(shape(model.shiftSteps(branchSteps, ["t1"], -1)), ["s1", { b: [["t1", "r1"], ["o1"]] }, "s2"]);
assert.equal(model.shiftSteps(branchSteps, ["r1"], -1), branchSteps, "Blocked at the start of its side");
assert.equal(model.shiftSteps(branchSteps, ["r1", "s2"], 1), branchSteps, "Steps in different lists don't move together");
assert.deepEqual(shape(model.filterSteps(branchSteps, step => step.id !== "o1")), ["s1", { b: [["r1", "t1"], []] }, "s2"]);
assert.deepEqual(model.outermostSteps(branchSteps, ["s2", "t1", "b"]).map(step => step.id), ["b", "s2"], "A selected branch carries its steps");

// Code: a branch waits for its condition if asked, then Commands.either runs one side.
const branchDoc = { version: 1, periodSeconds: 20, points: [], cameras: [], autos: [{ ...auto, isDefault: false, steps: [
  drive({ id: "s1", x: 1, y: 1 }),
  branch({ condition: { kind: "state", state: "SHOOT", waitSeconds: 0.5 },
    then: [{ id: "r1", type: "requestState", state: "INTAKE" }, drive({ id: "t1", x: 3, y: 1 }), { id: "r2", type: "requestState", state: "IDLE" }] }),
  branch({ id: "b2", condition: { kind: "timeLeft", seconds: 4 }, then: [drive({ id: "t2", x: 5, y: 5 })] }),
  branch({ id: "b3", condition: { kind: "check", method: "hasFuel", waitSeconds: 0 }, otherwise: [pause("w3")] })
] }] };
const branchProject = { ...project, checks: ["hasFuel"] };
assert.deepEqual(messages(branchDoc, { checks: ["hasFuel"] }), []);
const branchJava = model.generateAutosJava(branchDoc, branchProject);
assert.ok(branchJava.includes(`        .addCommand(() -> Commands.waitUntil(() -> robot.getActualState() == RobotState.SHOOT).withTimeout(0.5))
        .addCommand(() -> Commands.either(
            Commands.sequence(
                new DriveToPose(robot.drivetrain, new Pose2d(3.0, 1.0, Rotation2d.fromDegrees(0.0)), new DriveConstraints(3.0, 3.0, 0.05, 0.1))
                    .atProgress(0.0, () -> robot.requestState(RobotState.INTAKE, OWNER)),
                new RequestState(RobotState.IDLE, OWNER, robot)),
            Commands.none(),
            () -> robot.getActualState() == RobotState.SHOOT))`), "Requests inside a branch still join the move after them");
assert.ok(branchJava.includes(`        .addCommand(() -> Commands.either(
            new DriveToPose(robot.drivetrain, new Pose2d(5.0, 5.0, Rotation2d.fromDegrees(0.0)), new DriveConstraints(3.0, 3.0, 0.05, 0.1)),
            Commands.none(),
            () -> secondsLeft() >= 4.0))`), "A side with one step is that command");
assert.ok(branchJava.includes(`            Commands.none(),
            Commands.waitSeconds(1.0),
            () -> robot.hasFuel()))`), "Robot checks call the StateMachine method");
assert.match(branchJava, /\.withAlliance\(Alliance\.Blue\)\n        \.addCommand\(\(\) -> Commands\.runOnce\(AUTO_TIMER::restart\)\)\n        \.addCommand\(\(\) -> startInSimulation/,
  "Autos that check the time left start the timer first");
assert.match(branchJava, /import edu\.wpi\.first\.wpilibj\.Timer;/);
assert.match(branchJava, /private static final Timer AUTO_TIMER = new Timer\(\);/);
assert.match(branchJava, /private static double secondsLeft\(\) \{\n    return 20\.0 - AUTO_TIMER\.get\(\);\n  \}/);
assert.doesNotMatch(java, /Timer|Commands\.either|secondsLeft/, "Autos without branches don't change");

// Branch problems, and steps inside branches are checked like any other.
const branchIssues = (patch) => messages({ ...branchDoc, autos: [{ ...branchDoc.autos[0], steps: [branch(patch)] }] }, { checks: ["hasFuel"] });
assert.ok(branchIssues({ condition: { kind: "state", state: "JUMP", waitSeconds: 0 }, then: [pause("x")] }).includes("error: RobotState.JUMP does not exist in StateMachine."));
assert.ok(branchIssues({ condition: { kind: "check", method: "hasBall", waitSeconds: 0 }, then: [pause("x")] }).includes("error: StateMachine has no public boolean hasBall() method to check."));
assert.ok(branchIssues({ condition: { kind: "check", method: "", waitSeconds: 0 }, then: [pause("x")] }).includes("error: Choose the robot check."));
assert.ok(branchIssues({ condition: { kind: "state", state: "SHOOT", waitSeconds: -1 }, then: [pause("x")] }).includes("error: The wait must be zero or more seconds."));
assert.ok(branchIssues({ condition: { kind: "timeLeft", seconds: 25 }, then: [pause("x")] }).some(text => text.startsWith("warning: Autonomous lasts 20 s")));
assert.ok(branchIssues({}).includes("warning: This branch has no steps on either side, so it does nothing."));
assert.ok(branchIssues({ then: [branch({ id: "inner", then: [pause("y")] })] }).includes("error: A branch can't hold another branch. Move the inner one out."));
assert.ok(branchIssues({ then: [drive({ id: "n", x: 99 })] }).includes("warning: This point is outside the field."), "Steps inside a branch are checked");
assert.ok(model.requestsStates({ ...auto, steps: [branch({ then: [{ id: "r", type: "requestState", state: "IDLE" }] })] }), "Requests inside a branch are cleared at the end");

// The replay takes the side picked for each branch. One that goes straight into a move costs no time.
const replayOf = (steps, choices) => replay.replayAuto({ ...auto, clearRequestsAtEnd: false, steps }, choices);
const legs = [drive({ id: "a", x: 1, y: 1 }), drive({ id: "m", x: 3, y: 1, endDistanceTolerance: 0.5, endVelocityTolerance: 5 })];
const lastLeg = drive({ id: "c", x: 3, y: 3 });
const timeBranch = branch({ condition: { kind: "timeLeft", seconds: 1 }, then: [lastLeg] });
const branchSeconds = (played) => { const found = played.segments.find(segment => segment.stepId === "b"); return found.end - found.start; };
assert.ok(Math.abs(replayOf([...legs, timeBranch]).duration - replayOf([...legs, lastLeg]).duration) < 1e-9, "The robot keeps moving through a branch");
assert.equal(branchSeconds(replayOf([...legs, timeBranch])), 0);
const skippedSide = replayOf([...legs, timeBranch], { b: "otherwise" });
assert.deepEqual(skippedSide.segments.map(segment => segment.stepId), ["a", "m", "b"]);
assert.ok(Math.abs(branchSeconds(skippedSide) - replay.loopPeriodSeconds) < 1e-9, "An empty side still takes a cycle");
const waiting = branch({ condition: { kind: "state", state: "SHOOT", waitSeconds: 0.5 }, then: [lastLeg] });
assert.ok(Math.abs(branchSeconds(replayOf([...legs, waiting], { b: "otherwise" })) - 0.5) < 1e-6, "On the Otherwise side the wait runs out");
assert.ok(Math.abs(branchSeconds(replayOf([...legs, waiting])) - replay.loopPeriodSeconds) < 1e-6, "On the Then side the condition is already true");

// Mirrors, named points and the saved file reach inside branches.
assert.equal(model.flipSteps(branchSteps, { flipX: true, flipY: false }, field)[1].then[1].x, model.round(field.length - 3, 4), "Mirrored copies flip steps inside branches");
const linkedBranch = model.setNamedPoint({ version: 1, periodSeconds: 20, points: [], autos: [{ ...auto, steps: [branch({ then: [drive({ id: "lp", pointId: "p" })] })] }] },
  { id: "p", name: "P", x: 2, y: 2, heading: 45 });
assert.equal(linkedBranch.autos[0].steps[0].then[0].heading, 45, "Named points move linked steps inside branches");
assert.deepEqual(model.parseAutoDocument(JSON.parse(JSON.stringify(branchDoc))), branchDoc, "Branches round-trip through the saved file");
assert.deepEqual(files.parseRobotChecks("public boolean hasFuel() {}\n// public boolean old() {}\npublic static boolean util() {}\npublic boolean hasRequest(RobotState s) {}\npublic final boolean isAligned( ) {}"),
  ["hasFuel", "isAligned"], "Robot checks are StateMachine's public boolean methods with no arguments");

// Pre-match checks on the Drive tab.
const planned = { project, generatedSource: null, document: { version: 1, periodSeconds: 20, points: [], autos: [
  { ...auto, id: "left", name: "Left", alliance: null, isDefault: false, steps: [drive({ id: "p1", x: 2, y: 6, heading: 90 })] },
  { ...auto, id: "red", name: "Red side", alliance: "Red", isDefault: false, symmetry: { flipX: true, flipY: false }, steps: [drive({ id: "p2", x: 14, y: 2 })] }] } };
const checksFor = (input) => Object.fromEntries(prematch.preMatchChecks({ planned, code: null, ...input }).checks.map(check => [check.id, `${check.status}: ${check.text}`]));
assert.deepEqual(checksFor({ selected: "None", alliance: "Blue" }), { auto: "warning: No auto selected", alliance: "ok: Blue alliance" });
assert.equal(checksFor({ selected: "Left", alliance: "Unknown" }).alliance, "warning: Alliance not set yet; the auto list changes once it is");
assert.equal(checksFor({ selected: "Red side", alliance: "Blue" }).alliance, "warning: This is a Red auto, but the robot is on Blue");
assert.equal(checksFor({ selected: "Left", alliance: "Red", pose: { x: 2, y: 6, heading: 90 } }).alliance, "warning: Point 1 is on the Blue side, but the robot is on Red");
assert.equal(checksFor({ selected: "Red side (Blue)", alliance: "Blue", pose: { x: 2.54, y: 2, heading: 180 } }).start, "ok: On point 1", "Mirrored copies have their own point 1");
assert.equal(checksFor({ selected: "Left", alliance: "Blue", pose: { x: 2.3, y: 6.4, heading: 70 } }).start, "warning: 50 cm and 20° from point 1");
assert.equal(checksFor({ selected: "Left", alliance: "Blue" }).start, "info: No robot position yet to check against point 1");
assert.equal(checksFor({ selected: "Hand-written", alliance: "Blue", pose: { x: 0, y: 0, heading: 0 } }).start, undefined, "Hand-written autos have no point 1 to check");
assert.deepEqual(prematch.preMatchChecks({ selected: "Left", alliance: "Blue", planned, code: null }).start, { x: 2, y: 6, heading: 90 });
assert.equal(prematch.codeCheck(null), null);
assert.equal(prematch.codeCheck(planned).text, "Auto Builder autos aren't in robot code yet (File → Update Code)");
const plannedJava = model.generateAutosJava(planned.document, project);
assert.equal(prematch.codeCheck({ ...planned, generatedSource: plannedJava.replace(/\n/g, "\r\n") }).status, "ok", "Line endings don't matter");
assert.equal(prematch.codeCheck({ ...planned, generatedSource: plannedJava.replace("2.0, 6.0", "2.5, 6.0") }).text, "Auto Builder changed since the last Update Code");

// Speed checks: the drivetrain comes from TunerConstants, with mass, wheel friction and motor from PathPlanner's settings.
const tunerSource = `public class TunerConstants {
    // public static final LinearVelocity kSpeedAt12Volts = MetersPerSecond.of(9);
    public static final LinearVelocity kSpeedAt12Volts = MetersPerSecond.of(5.72);
    private static final Current kSlipCurrent = Amps.of(60);
    private static final double kDriveGearRatio = 5.4;
    private static final Distance kWheelRadius = Inches.of(2);
    private static final Voltage kDriveFrictionVoltage = Volts.of(0.2);
    private static final Distance kFrontLeftXPos = Inches.of(11.5);
    private static final Distance kFrontLeftYPos = Inches.of(10.5);
    private static final Distance kFrontRightXPos = Inches.of(11.5);
    private static final Distance kFrontRightYPos = Inches.of(-10.5);
    private static final Distance kBackLeftXPos = Inches.of(-11.5);
    private static final Distance kBackLeftYPos = Inches.of(10.5);
    private static final Distance kBackRightXPos = Inches.of(-11.5);
    private static final Distance kBackRightYPos = Inches.of(-10.5);
}`;
const pathPlannerSettings = { robotMass: 74.08, wheelCOF: 1.2, driveMotorType: "krakenX60FOC", maxDriveSpeed: 5.45, driveGearing: 5.143, driveWheelRadius: 0.048,
  flModuleX: 0.273, flModuleY: 0.273, frModuleX: 0.273, frModuleY: -0.273, blModuleX: -0.273, blModuleY: 0.273, brModuleX: -0.273, brModuleY: -0.273 };
const drivetrain = files.parseDrivetrain(tunerSource, pathPlannerSettings);
assert.equal(drivetrain.speedAt12Volts, 5.72, "Commented-out constants are ignored");
assert.equal(drivetrain.driveGearRatio, 5.4);
assert.ok(Math.abs(drivetrain.wheelRadius - 0.0508) < 1e-9, "Inches convert to meters");
assert.ok(Math.abs(drivetrain.modules[1].x - 0.2921) < 1e-9 && Math.abs(drivetrain.modules[1].y + 0.2667) < 1e-9);
assert.deepEqual([drivetrain.mass, drivetrain.wheelCOF, drivetrain.motor, drivetrain.frictionVoltage], [74.08, 1.2, "krakenX60FOC", 0.2]);
assert.equal(files.parseDrivetrain("public class TunerConstants {}", pathPlannerSettings), null, "No speed check without the basics");
assert.equal(files.parseDrivetrain(tunerSource, {}).pathPlanner, null);

const robotLimits = speed.drivetrainLimits(drivetrain);
assert.ok(Math.abs(robotLimits.topSpeed - 5.72 * 11.3 / 12) < 1e-9, "Top speed uses a match battery less drive friction");
assert.ok(Math.abs(robotLimits.maxAcceleration - 6.68) < 0.02, `Kraken FOC at 60 A through 5.4:1 on 2 in wheels moves 74 kg at about 6.7 m/s², got ${robotLimits.maxAcceleration}`);
assert.ok(robotLimits.accelerationAt(5) > 3 && robotLimits.accelerationAt(5) < 4.5, "Acceleration fades near top speed");
assert.ok(robotLimits.accelerationAt(robotLimits.topSpeed) < 1e-9);
const noteText = robotLimits.notes.join("\n");
for (const expected of ["Gearing is 5.4:1 in TunerConstants but 5.143:1", "Wheel radius is 5.08 cm", "front left module is at (29.2, 26.7) cm", "Wheel grip disagrees"]) {
  assert.ok(noteText.includes(expected), `Notes mention: ${expected}\n${noteText}`);
}
assert.ok(!noteText.includes("Free speed"), "A 5% difference in free speed isn't worth a note");
assert.match(speed.drivetrainLimits({ ...drivetrain, mass: null, wheelCOF: null }).notes[0], /acceleration isn't checked/);
assert.equal(speed.drivetrainLimits({ ...drivetrain, mass: null, wheelCOF: null }).maxAcceleration, null);

const speedAuto = (steps) => ({ ...auto, clearRequestsAtEnd: false, steps });
const reportFor = (routine) => speed.speedReport(routine, {}, replay.replayAuto(routine), robotLimits);
const easy = reportFor(speedAuto([drive({ id: "e1", x: 1, y: 1 }), drive({ id: "e2", x: 6, y: 3 })]));
assert.deepEqual([easy.issues, easy.strain, easy.extraSeconds], [[], [], 0], "Default limits are well inside this drivetrain");

const fast = reportFor(speedAuto([drive({ id: "f1", x: 1, y: 1 }), drive({ id: "f2", x: 15, y: 1, maxVelocity: 6, maxAcceleration: 9 })]));
assert.deepEqual(fast.issues.map(issue => `${issue.stepId}: ${issue.message.split(" (")[0]}`), [
  "f2: Max velocity 6 m/s is faster than this drivetrain can ever go",
  "f2: Max accel 9 m/s² is more than this drivetrain can do"
]);
assert.ok(fast.extraSeconds > 0.3 && Math.abs(fast.extraByStep.get("f2") - fast.extraSeconds) < 1e-9, `A 6 m/s leg takes longer on the robot, got ${fast.extraSeconds}`);
assert.ok(fast.strain.some(range => range.limit === "speed") && fast.strain.some(range => range.limit === "acceleration"));
const fastIdeal = replay.replayAuto(speedAuto([drive({ id: "f1", x: 1, y: 1 }), drive({ id: "f2", x: 15, y: 1, maxVelocity: 6, maxAcceleration: 9 })]));
assert.ok(fast.strain.every(range => range.start >= 0 && range.end <= fastIdeal.duration + 1e-9 && range.start < range.end), "Strain sits on the ideal timeline");
assert.ok(Math.max(...fast.robot.frames.map(frame => frame.speed)) <= robotLimits.topSpeed + 1e-9);

const almostTop = reportFor(speedAuto([drive({ id: "a1", x: 1, y: 1 }), drive({ id: "a2", x: 15, y: 1, maxVelocity: 5.6, maxAcceleration: 6 })]));
assert.equal(almostTop.issues.length, 1);
assert.match(almostTop.issues[0].message, /tops out near 5\.4 m\/s and gains speed slowly close to it, so this leg takes about 0\.\d\d s longer/);

// Turning at 360°/s adds about 2.5 m/s at a wheel, more than 4.5 m/s of driving leaves.
const turning = reportFor(speedAuto([drive({ id: "t1", x: 1, y: 1 }),
  drive({ id: "t2", x: 14, y: 1, heading: 180, maxVelocity: 4.5, maxAcceleration: 6, maxTurnRate: 360, turn: { mode: "later", startProgress: 0.5 } })]));
assert.deepEqual(turning.issues.map(issue => issue.message.split(",")[0]), ["Turning while driving this fast needs more than 5.4 m/s at a wheel"]);
const strainTime = (limit) => turning.strain.filter(range => range.limit === limit).reduce((sum, range) => sum + range.end - range.start, 0);
assert.ok(strainTime("turn") > strainTime("acceleration") + strainTime("speed"), "Mostly held back by turning (catching up afterward counts as acceleration)");
const turned = turning.robot.frames.at(-1);
assert.ok(Math.abs(turned.heading) > 179.9, "The robot still finishes its turn");

// Tag view: a camera sees a tag only when the tag is whole in the image, square enough, big enough and not blocked.
const visionSource = `public class VisionConstants {
  public static final String[] LIMELIGHT_NAMES = {"limelight-left", "limelight-right"};
  // public static final LimelightVisionConfig OLD = new LimelightVisionConfig(0.01, 9, 0.5);
  public static final LimelightVisionConfig CONFIG = new LimelightVisionConfig(0.07, 5, 0.5);
}`;
assert.deepEqual(files.parseVision(visionSource), { basePositionStdDev: 0.07, maxTagDistance: 5, cameraNames: ["limelight-left", "limelight-right"] });
assert.deepEqual(files.parseVision("public class VisionConstants {}"), null, "No tag view without VisionConstants");
assert.deepEqual(files.parseVision('String[] LIMELIGHT_NAMES = {"limelight"};').cameraNames, ["limelight"], "Names alone are enough to offer cameras");

const camera = (patch = {}) => ({ id: "c1", name: "Front", x: 0, y: 0, z: 0.5, yaw: 0, pitch: 0, hFov: 80, vFov: 56, imageWidth: 1280, enabled: true, ...patch });
const sightLimits = { basePositionStdDev: 0.07, maxTagDistance: 6.25, maxIncidenceDegrees: 60, minTagPixels: 12 };
// A tag 2 m straight ahead at the camera's own height, looking back at it.
const facing = { id: 7, x: 2, y: 0, z: 0.5, yaw: 180 };
const see = (pose, tags, cameras = [camera()], boxes = [], limits = sightLimits) => sight.tagSightings(pose, cameras, tags, boxes, limits);
assert.equal(see({ x: 0, y: 0, heading: 0 }, [facing]).length, 1, "A tag straight ahead is seen");
assert.equal(see({ x: 0, y: 0, heading: 180 }, [facing]).length, 0, "A tag behind the robot is not");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, yaw: 0 }]).length, 0, "A tag facing away is not");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, x: 7 }]).length, 0, "A tag past the robot's distance limit is not");
assert.equal(see({ x: 0, y: 0, heading: 50 }, [facing]).length, 0, "A tag outside the 80 degree field of view is not");
assert.equal(see({ x: 0, y: 0, heading: 35 }, [facing]).length, 1, "A tag inside it is");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, z: 2.2 }]).length, 0, "A tag above the 56 degree field of view is not");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, z: 2.2 }], [camera({ pitch: 45 })]).length, 1, "Pitching the camera up reaches it");
// Mount offsets move the lens: a camera on the left of a robot facing +x sits at +y.
const offset = sight.cameraPose({ x: 1, y: 1, heading: 90 }, camera({ x: 0.3, y: 0.2 }));
assert.ok(Math.abs(offset.x - 0.8) < 1e-9 && Math.abs(offset.y - 1.3) < 1e-9, `Mount turns with the robot, got ${offset.x}, ${offset.y}`);
assert.equal(sight.cameraPose({ x: 0, y: 0, heading: 90 }, camera({ yaw: -30 })).yaw, 60);

// Incidence and pixel size: a tag edge-on, or far enough to shrink below the pixel floor, drops out.
const oblique = see({ x: 0, y: 0, heading: 0 }, [{ id: 8, x: 2, y: 0, z: 0.5, yaw: 245 }]);
assert.equal(oblique.length, 0, "65 degrees off square is past the limit");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ id: 8, x: 2, y: 0, z: 0.5, yaw: 225 }]).length, 1, "45 degrees off square still decodes");
const close = see({ x: 0, y: 0, heading: 0 }, [facing])[0];
assert.ok(Math.abs(close.incidence) < 1e-6 && Math.abs(close.distance - 2) < 1e-9);
assert.ok(close.pixels > 60 && close.pixels < 120, `A 6.5 in tag at 2 m on a 1280 px 80 degree camera is about 100 px, got ${close.pixels}`);
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, x: 6 }], [camera({ imageWidth: 320 })]).length, 0, "A 320 px pipeline loses the tag first");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, x: 6 }]).length, 1, "A 1280 px pipeline still reads it");

// Occlusion: a box between the camera and the tag blocks it; the surface the tag sits on does not.
const wall = { element: "hub", x0: 1, x1: 1.2, y0: -1, y1: 1, z0: 0, z1: 1.3 };
assert.equal(see({ x: 0, y: 0, heading: 0 }, [facing], [camera()], [wall]).length, 0, "A wall in the way blocks the tag");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [{ ...facing, x: 1 }], [camera()], [wall]).length, 1, "A tag on the near face of a box is still seen");
assert.equal(see({ x: 0, y: 0, heading: 0 }, [facing], [camera()], [{ ...wall, z0: 1.2, z1: 2 }]).length, 1, "A box above the sight line blocks nothing");
assert.equal(obstacles.fieldOccluders([{ element: "bump", x: 0, y: 0, length: 1, width: 1 }]).length, 0, "Ramps and zones never block");
const hubBox = obstacles.fieldOccluders(drawing.rebuiltDrawing).filter(box => box.element === "hub");
assert.equal(hubBox.length, 2, "Both hubs block sight lines");
assert.ok(hubBox[0].z1 > 1.124, "The hub reaches past the tags on its faces");

// The real field: standing beside the blue hub, its near tags are usable and its far ones are behind it.
const blueHubTags = [
  { id: 19, x: 5.23, y: 3.68, z: 1.124, yaw: 0 }, { id: 20, x: 5.23, y: 4.03, z: 1.124, yaw: 0 },
  { id: 25, x: 4.02, y: 4.39, z: 1.124, yaw: 180 }, { id: 26, x: 4.02, y: 4.03, z: 1.124, yaw: 180 }
];
const beside = see({ x: 7, y: 3.9, heading: 180 }, blueHubTags, [camera({ z: 0.6, pitch: 10 })], obstacles.fieldOccluders(drawing.rebuiltDrawing));
assert.deepEqual(beside.map(s => s.tagId).sort(), [19, 20], "The hub hides the tags on its far side");

// The fix is the robot's own standard deviation: base * distance^2 / tags, best camera wins.
const fix = sight.visionFix({ x: 7, y: 3.9, heading: 180 }, [camera({ z: 0.6, pitch: 10 })], blueHubTags,
  obstacles.fieldOccluders(drawing.rebuiltDrawing), sightLimits);
assert.equal(fix.tagCount, 2);
assert.ok(Math.abs(fix.stdDev - 0.07 * fix.averageDistance * fix.averageDistance / 2) < 1e-9, "Matches LimelightVision.parseMeasurement");
assert.equal(sight.visionQuality(null), "blind");
assert.deepEqual([sight.visionQuality(0.04), sight.visionQuality(0.1), sight.visionQuality(0.4)], ["good", "fair", "poor"]);
const blindFix = sight.visionFix({ x: 1, y: 1, heading: 0 }, [camera()], blueHubTags, [], sightLimits);
assert.deepEqual([blindFix.tagCount, blindFix.stdDev], [0, null], "No tags means no measurement at all");

// Along a tagRoute: the spans cover the whole replay and the blind time is the stretches with no fix.
const tagAuto = { ...auto, clearRequestsAtEnd: false, steps: [drive({ id: "v1", x: 7, y: 3.9, heading: 180 }), drive({ id: "v2", x: 13, y: 7, heading: 180 })] };
const tagReplay = replay.replayAuto(tagAuto);
const tagRoute = sight.routeVision(tagReplay, [camera({ z: 0.6, pitch: 10 })], blueHubTags, obstacles.fieldOccluders(drawing.rebuiltDrawing), sightLimits);
assert.equal(tagRoute.spans[0].start, 0);
assert.ok(Math.abs(tagRoute.spans.at(-1).end - tagReplay.duration) < 1e-9, "Spans reach the end of the replay");
assert.ok(tagRoute.spans.every((span, index) => index === 0 || span.start === tagRoute.spans[index - 1].end), "Spans join without gaps");
assert.ok(tagRoute.blindSeconds > 0 && tagRoute.longestBlind, "Driving away from the hub loses the tags");
assert.ok(tagRoute.longestBlind.end - tagRoute.longestBlind.start <= tagRoute.blindSeconds + 1e-9);
assert.equal(sight.routeVision(tagReplay, [camera({ enabled: false })], blueHubTags, [], sightLimits).spans.length, 0, "A camera switched off sees nothing");
assert.ok(sight.fixAt(tagRoute, 0).t === 0 && sight.fixAt(tagRoute, 1e6).t <= tagReplay.duration);

// Collisions: the bumper rectangle at its replayed heading against elements that reach the carpet.
const rebuiltBoxes = obstacles.fieldOccluders(drawing.rebuiltDrawing);
const bumpers = { width: 0.914, length: 0.914 };
const legHits = (steps, footprint = bumpers, boxes = rebuiltBoxes) =>
  collisions.collisionIssues(replay.replayAuto({ ...auto, clearRequestsAtEnd: false, steps }), footprint, boxes);
assert.ok(rebuiltBoxes.some(box => box.label === "the blue hub") && rebuiltBoxes.some(box => box.label === "the red trench post"), "Elements are named for warnings");
assert.ok(!collisions.groundObstacles(rebuiltBoxes).some(box => box.element === "trenchBar" || box.element === "towerRung"),
  "Overhead elements, like the bar robots drive under, don't block driving");
const throughHub = legHits([drive({ id: "c1", x: 2, y: 4.03 }), drive({ id: "c2", x: 7, y: 4.03 })]);
assert.deepEqual(throughHub.map(issue => issue.stepId), ["c2"], "Only the leg that drives through the hub is warned about");
assert.match(throughHub[0].message, /may hit the blue hub/);
const lane = drawing.rebuiltDrawing.find(shape => shape.element === "trench" && shape.alliance === "blue" && shape.y === 0);
const laneY = lane.width / 2;
assert.deepEqual(legHits([drive({ id: "t1", x: 2, y: laneY }), drive({ id: "t2", x: 7, y: laneY })]), [],
  "A 36 in robot driving straight down the trench lane fits");
const turnedInLane = legHits([drive({ id: "t1", x: 2, y: laneY, heading: 45 }), drive({ id: "t2", x: 7, y: laneY, heading: 45 })]);
assert.match(turnedInLane[0]?.message ?? "", /the blue trench post/, "Turned 45 degrees in the lane, its corners reach the post");
assert.deepEqual(legHits([drive({ id: "c1", x: 2, y: 4.03 }), drive({ id: "c2", x: 7, y: 4.03 })], bumpers, []), [], "No field layout, no warnings");
const box = { element: "hub", x0: 1, x1: 2, y0: 0, y1: 1, z0: 0, z1: 1 };
assert.equal(collisions.robotOverlaps({ width: 1, length: 1 }, { x: 0.5, y: 0.5, heading: 0 }, box), false, "Touching an edge isn't a hit");
assert.equal(collisions.robotOverlaps({ width: 1, length: 1 }, { x: 0.6, y: 0.5, heading: 0 }, box), true);
assert.equal(collisions.robotOverlaps({ width: 1, length: 1 }, { x: 0.4, y: 0.5, heading: 45 }, box), true, "A turned robot reaches further");

// Saved cameras survive a round trip, and a broken one falls back instead of blinding the view.
const cameraDoc = { version: 1, periodSeconds: 20, points: [], autos: [], cameras: [camera({ id: "left", name: "limelight-left", yaw: 12 })] };
assert.deepEqual(model.parseAutoDocument(JSON.parse(JSON.stringify(cameraDoc))), cameraDoc, "Cameras round-trip through the saved file");
const patched = model.parseAutoDocument({ autos: [], cameras: [{ name: "Odd", hFov: 0, imageWidth: -5, x: "no" }] }).cameras[0];
assert.ok(patched.hFov > 0 && patched.imageWidth > 0 && Number.isFinite(patched.x) && patched.enabled);

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
  assert.equal(result.state.generatedSource, java, "Power Tool reads GeneratedAutos.java back for the pre-match check");
  assert.equal(await fs.readFile(path.join(autosDirectory, "GeneratedAutos.java"), "utf8"), java);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(robotRoot, "power-tool", "generated", "powerlib-autos.json"), "utf8")), document);
  assert.equal((await files.updateAutoCode(robotRoot, document, java)).hookAdded, false);
  assert.equal(result.state.robotAutosHooked, true);
  for (const file of ["src/main/java/frc/robot/commands/DriveToPose.java", "src/main/java/frc/powerlib/auto/DriveConstraints.java"]) {
    await fs.mkdir(path.dirname(path.join(robotRoot, file)), { recursive: true });
    await fs.writeFile(path.join(robotRoot, file), "// installed\n");
  }
  assert.equal((await files.readAutoFiles(robotRoot)).driveCommandInstalled, true);
  assert.equal(result.state.drivetrain, null, "No TunerConstants, no speed checks");
  // CTRE's generator puts TunerConstants in frc/robot/generated; the BOM some editors add is fine.
  for (const [file, text] of [["src/main/java/frc/robot/generated/TunerConstants.java", tunerSource],
    ["src/main/deploy/pathplanner/settings.json", `﻿${JSON.stringify({ ...pathPlannerSettings, robotWidth: 0.8, robotLength: 0.9 })}`]]) {
    await fs.mkdir(path.dirname(path.join(robotRoot, file)), { recursive: true });
    await fs.writeFile(path.join(robotRoot, file), text);
  }
  const withDrivetrain = await files.readAutoFiles(robotRoot);
  assert.deepEqual(withDrivetrain.drivetrain, drivetrain);
  assert.deepEqual(withDrivetrain.robot, { width: 0.8, length: 0.9 });
  await assert.rejects(files.updateAutoCode(robotRoot, document, "class GeneratedAutos {}"), /Invalid generated auto source/);
  await fs.writeFile(path.join(autosDirectory, "GeneratedAutos.java"), "public final class GeneratedAutos {}\n");
  await assert.rejects(files.updateAutoCode(robotRoot, document, java), /was not written by Power Tool/);
} finally {
  await fs.rm(robotRoot, { recursive: true, force: true });
}

// Smart snapping: aligned X/Y, 45° lines from neighbors, and combinations of both.
const targets = { xs: [{ value: 3, label: "X of point 1", at: 2 }], ys: [{ value: 2, label: "Y of point 1", at: 3 }],
  anchors: [{ point: { x: 3, y: 2 }, label: "point 1" }] };
const near = (a, b) => Math.abs(a - b) < 1e-9;
let snapped = snap.snapPosition({ x: 3.04, y: 5 }, targets, 0.1, field);
assert.ok(near(snapped.point.x, 3) && near(snapped.point.y, 5), "Snaps to the same X");
assert.equal(snapped.guides[0].label, "X of point 1");
assert.deepEqual(snapped.guides[0].from, { x: 3, y: 2 }, "The guide starts at the aligned point");
snapped = snap.snapPosition({ x: 6, y: 2.05 }, targets, 0.1, field);
assert.ok(near(snapped.point.y, 2) && near(snapped.point.x, 6), "Snaps to the same Y");
snapped = snap.snapPosition({ x: 5.03, y: 3.98 }, targets, 0.1, field);
assert.ok(near(snapped.point.x - 3, snapped.point.y - 2), "Snaps onto the 45° line from the previous point");
assert.match(snapped.guides[0].label, /^45° from point 1$/);
snapped = snap.snapPosition({ x: 5.5, y: 4.2 }, targets, 0.1, field);
assert.deepEqual(snapped, { point: { x: 5.5, y: 4.2 }, guides: [] }, "Far from every target, the point stays put");
// A 45° line crossing an aligned X wins over either alone.
snapped = snap.snapPosition({ x: 4.98, y: 4.03 }, { xs: [{ value: 5, label: "X of point 3", at: 0 }], ys: [], anchors: targets.anchors }, 0.1, field);
assert.ok(near(snapped.point.x, 5) && near(snapped.point.y, 4) && snapped.guides.length === 2, "45° line and same X together");
snapped = snap.snapPosition({ x: 8.3, y: 1 }, { xs: [{ value: field.length / 2, label: "center line" }], ys: [], anchors: [] }, 0.1, field);
assert.ok(near(snapped.point.x, 8.27) && near(snapped.guides[0].from.y, 0) && near(snapped.guides[0].to.y, field.width), "Center line guides span the field");

assert.deepEqual(snap.snapHeading(87, [], 7), { heading: 90, label: "90°" });
assert.deepEqual(snap.snapHeading(-133, [], 7), { heading: -135, label: "-135°" });
assert.deepEqual(snap.snapHeading(178, [], 7), { heading: 180, label: "180°" });
assert.deepEqual(snap.snapHeading(30, [], 7), { heading: 30, label: null }, "No snap far from every target");
assert.deepEqual(snap.snapHeading(32, [{ value: 33.7, label: "along the path" }], 7), { heading: 33.7, label: "along the path" });
assert.deepEqual(snap.snapHeading(45, [{ value: 45, label: "same as point 2" }], 7), { heading: 45, label: "same as point 2" }, "Named headings win ties");

// Editing helpers behind the Auto Builder's hooks.
{
  const leg = (id, x, y, patch = {}) => drive({ id, x, y, ...patch });
  const branchStep = { id: "b", type: "branch", condition: { kind: "timeLeft", seconds: 5 },
    then: [leg("t1", 5, 5, { subpoints: [{ id: "sp", progress: 0.5, state: "SHOOT" }] })], otherwise: [leg("o1", 6, 1)] };
  const copy = edits.cloneStep(branchStep);
  assert.notEqual(copy.id, branchStep.id, "A cloned branch gets a new id");
  assert.notEqual(copy.then[0].id, "t1", "Steps inside a cloned branch get new ids");
  assert.notEqual(copy.then[0].subpoints[0].id, "sp", "Subpoints get new ids too");
  assert.equal(copy.then[0].x, 5, "A clone keeps its pose");

  assert.equal(edits.nextAutoName([]), "Auto 1");
  assert.equal(edits.nextAutoName([{ name: "Auto 2" }, { name: "Left" }]), "Auto 3");
  assert.equal(edits.nextAutoName([{ name: "Auto 2" }]), "Auto 3", "Skips names already taken");

  const doc = { version: 1, periodSeconds: 20, points: [], cameras: [], autos: [{ id: "a", isDefault: true }, { id: "b", isDefault: false }] };
  assert.deepEqual(edits.setDefaultIn(doc, "b", true).autos.map(auto => auto.isDefault), [false, true], "One default at a time");
  assert.deepEqual(edits.setDefaultIn(doc, "a", false).autos.map(auto => auto.isDefault), [false, false]);
  const { copy: dup, branchPairs } = edits.duplicateAuto({ id: "a", name: "Left", isDefault: true, steps: [branchStep] });
  assert.equal(dup.name, "Left copy");
  assert.equal(dup.isDefault, false, "A duplicate is never the default");
  assert.deepEqual(branchPairs.map(pair => pair[0]), ["b"], "Branches pair with the original's in order");
  assert.deepEqual(edits.insertAutoAfter(doc, "a", { id: "c" }).autos.map(auto => auto.id), ["a", "c", "b"], "Duplicates sit after the original");

  const steps = [leg("1", 1, 1), { id: "r", type: "requestState", state: "SHOOT" }, branchStep, leg("2", 9, 4)];
  assert.equal(routing.driveBefore(steps, {}, { after: "r" }).id, "1", "A new step after a request starts from the drive before it");
  assert.equal(routing.driveBefore(steps, {}, { after: "b" }).id, "t1", "After a branch, the robot comes from the side the field shows");
  assert.equal(routing.driveBefore(steps, { b: "otherwise" }, { after: "b" }).id, "o1");
  assert.equal(routing.driveBefore(steps, {}, { into: { branchId: "b", arm: "otherwise" } }).id, "o1", "Adding into a side starts from its last drive");
  assert.equal(routing.driveBefore(steps, {}, { after: null }).id, "2", "With nothing selected, the last drive");
  const added = edits.newDriveStep(steps, {}, { after: "1" }, project, { x: 4, y: 2 });
  assert.deepEqual([added.x, added.y, added.maxVelocity], [4, 2, 3], "A new leg takes the click position and the previous leg's limits");
  assert.deepEqual(routing.insertTargetAfter(steps, ["2", "1"]), { after: "2" }, "New steps go after the selected step that runs last");
  const numbering = routing.stepNumbering(steps);
  assert.equal(numbering.stepNumbers.get("o1"), 5, "Steps are numbered over both sides of a branch");
  assert.equal(numbering.driveNumbers.get("2"), 4, "So are drive points");

  assert.equal(edits.alignAnchor(steps, ["1", "2"], "2").id, "2", "Points line up with the primary step");
  assert.deepEqual(edits.alignIn(steps, ["1", "2"], steps[3], "y").filter(step => ["1", "2"].includes(step.id)).map(step => step.y), [4, 4]);
  assert.deepEqual(edits.nudgeChanges(steps, ["1"], -2, 0.5, 0, field), [{ stepId: "1", x: 0, y: 1.5 }], "Nudges stay on the field");
  assert.deepEqual(edits.nudgeChanges(steps, ["1"], 0, 0, 15, field), [{ stepId: "1", heading: 15 }]);
  const flipped = edits.pointPatches([{ stepId: "1", x: 2 }], steps, { flipX: true, flipY: false }, field).get("1");
  assert.ok(Math.abs(flipped.x - (field.length - 2)) < 1e-9 && flipped.y === 1, "Edits on the mirrored copy flip back onto the original");
  assert.deepEqual(edits.turnWithMode(leg("x", 1, 1, { heading: 90 }), "face"), { mode: "face", x: 1, y: 3, pointId: null }, "Face point starts 2 m ahead");
  assert.deepEqual(edits.conditionWithKind({ ...branchStep, condition: { kind: "state", state: "SHOOT", waitSeconds: 2 } }, "check", ["IDLE"], ["hasFuel"]),
    { kind: "check", method: "hasFuel", waitSeconds: 2 }, "Switching what a branch checks keeps its wait");

  const listRows = rows.stepListRows(steps, { b: "otherwise" });
  assert.deepEqual(listRows.map(row => row.kind === "arm" ? `${row.arm}${row.offRoute ? "*" : ""}` : row.step.id), ["1", "r", "b", "then*", "t1", "otherwise", "o1", "2"],
    "The step list shows each branch's sides under it, dimming the side the field isn't showing");
}

// Keyboard shortcuts.
{
  const press = (key, modifiers = {}) => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers });
  const ready = { typing: false, hasAuto: true, hasSteps: true, hasClipboard: true, hasSelection: true, selectionHasDrive: true };
  assert.deepEqual(keys.keyAction(press("s", { ctrlKey: true }), { ...ready, typing: true }), { kind: "save" }, "Ctrl+S saves even while typing");
  assert.equal(keys.keyAction(press("z", { ctrlKey: true }), { ...ready, typing: true }), null, "Ctrl+Z in a text field is the field's own undo");
  assert.deepEqual(keys.keyAction(press("Z", { ctrlKey: true, shiftKey: true }), ready), { kind: "redo" });
  assert.deepEqual(keys.keyAction(press("3"), ready), { kind: "addStep", type: "waitForState" });
  assert.equal(keys.keyAction(press("3"), { ...ready, hasAuto: false }), null, "Step keys need an auto");
  assert.deepEqual(keys.keyAction(press("ArrowLeft", { shiftKey: true }), ready), { kind: "nudge", dx: -0.25, dy: 0 });
  assert.deepEqual(keys.keyAction(press("ArrowUp", { altKey: true }), ready), { kind: "moveSteps", offset: -1 });
  assert.equal(keys.keyAction(press("ArrowUp"), { ...ready, selectionHasDrive: false }), null, "Arrows only move drive points");
  assert.deepEqual(keys.keyAction(press("e"), ready), { kind: "turn", degrees: -15 });
  assert.equal(keys.keyAction(press("Delete"), { ...ready, hasSelection: false }), null);
  assert.deepEqual(keys.keyAction(press(" "), { ...ready, hasAuto: false }), { kind: "playPause" });
  assert.equal(keys.neighborIndex(4, -1, 1), 0, "] with nothing selected picks the first step");
  assert.equal(keys.neighborIndex(4, -1, -1), 3, "[ with nothing selected picks the last step");
  assert.equal(keys.neighborIndex(4, 3, 1), 3, "] stops at the end");
}

// Column layout and dragging on the field.
{
  assert.deepEqual(columns.parseColumns(null, 1280), { left: 196, right: 300, leftOpen: true, rightOpen: true }, "Narrow windows start with narrower columns");
  assert.equal(columns.parseColumns(null, 1920).right, 340);
  assert.deepEqual(columns.parseColumns('{"left": 300, "right": "wide", "extra": 1}', 1920), { left: 300, right: 340, leftOpen: true, rightOpen: true },
    "Saved sizes of the wrong type are ignored");
  assert.equal(columns.draggedColumn(columns.defaultColumns, "right", 90).rightOpen, false, "Dragging a column past the edge closes it");
  assert.equal(columns.draggedColumn(columns.defaultColumns, "left", 900).left, 420, "Widths are clamped");
  assert.equal(columns.gridColumns({ left: 200, right: 300, leftOpen: false, rightOpen: true }), "0px 12px minmax(0, 1fr) 12px 300px");

  const legs = [drive({ id: "a", x: 1, y: 1 }), drive({ id: "b", x: 3, y: 1 }), drive({ id: "c", x: 3, y: 3 })];
  assert.deepEqual(dragging.boxSelection(legs, { x: 0, y: 0 }, { x: 3.5, y: 1.5 }), ["a", "b"]);
  assert.deepEqual(dragging.moveGroup("b", ["a"], false), { select: "replace", group: ["b"] }, "Pressing an unselected robot selects just it");
  assert.deepEqual(dragging.moveGroup("a", ["a", "c"], false), { select: null, group: ["a", "c"] }, "Pressing a selected robot drags the selection");
  assert.deepEqual(dragging.moveGroup("b", ["a"], true), { select: "toggle", group: ["a", "b"] }, "Shift adds to the selection");
  assert.deepEqual(dragging.aimHeading(legs, 1, { x: 4, y: 2.1 }, true, true), { heading: 45, label: "45°" }, "Shift aims in 15° steps");
  assert.equal(dragging.aimHeading(legs, 1, { x: 3.02, y: 3 }, false, true).label, "toward point 3", "Aiming snaps toward the next point");
  const move = { kind: "move", stepId: "b", ids: ["b", "c"], grab: { x: 3, y: 1 }, origins: new Map([["b", { x: 3, y: 1 }], ["c", { x: 3, y: 3 }]]),
    clientX: 0, clientY: 0, moved: true, reselect: false };
  const moved = dragging.dragMoves(legs, move, { x: 3.5, y: 1.03 }, true, 0.1, field);
  assert.deepEqual(moved.moves, [{ stepId: "b", x: 3.5, y: 1 }, { stepId: "c", x: 3.5, y: 3 }], "The selection moves together; the grabbed point snaps to point 1's Y");
  assert.equal(moved.guides[0].label, "Y of point 1");
}

console.log("Auto builder checks passed.");
