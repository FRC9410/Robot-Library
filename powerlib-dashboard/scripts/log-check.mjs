import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Usage: node scripts/log-check.mjs [--write-sample <path.wpilog>]
const result = await build({
  stdin: { contents: 'export * from "./src/features/logs/wpilog.ts"; export * from "./src/features/logs/logModel.ts";',
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" },
  bundle: true, write: false, format: "esm", platform: "node"
});
const { parseWpilog, buildLogModel, busiestMechanism, metricKey, plainMechanismKey, stepStats, valueAt, indexAt, segments } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);

/** Minimal .wpilog writer using the shortest field widths, so the reader's bitfield handling is exercised. */
class LogWriter {
  constructor(extra = "") {
    const header = Buffer.alloc(12);
    header.write("WPILOG", 0, "ascii");
    header.writeUInt16LE(0x0100, 6);
    header.writeUInt32LE(Buffer.byteLength(extra), 8);
    this.parts = [header, Buffer.from(extra)];
    this.nextId = 1;
    this.ids = new Map();
  }
  static width(value, max) { let width = 1; while (width < max && value >= 2 ** (8 * width)) width += 1; return width; }
  static uint(buffer, offset, value, width) { for (let index = 0; index < width; index += 1) buffer[offset + index] = Math.floor(value / 2 ** (8 * index)) % 256; }
  static text(value) { const bytes = Buffer.from(value); const length = Buffer.alloc(4); length.writeUInt32LE(bytes.length); return Buffer.concat([length, bytes]); }
  record(id, micros, payload) {
    const idWidth = LogWriter.width(id, 4); const sizeWidth = LogWriter.width(payload.length, 4); const timeWidth = LogWriter.width(micros, 8);
    const head = Buffer.alloc(1 + idWidth + sizeWidth + timeWidth);
    head[0] = (idWidth - 1) | ((sizeWidth - 1) << 2) | ((timeWidth - 1) << 4);
    LogWriter.uint(head, 1, id, idWidth); LogWriter.uint(head, 1 + idWidth, payload.length, sizeWidth); LogWriter.uint(head, 1 + idWidth + sizeWidth, micros, timeWidth);
    this.parts.push(head, payload);
  }
  start(name, type, metadata = "", micros = 0) {
    const id = this.nextId++; this.ids.set(name, id);
    const entry = Buffer.alloc(4); entry.writeUInt32LE(id);
    this.record(0, micros, Buffer.concat([Buffer.from([0]), entry, LogWriter.text(name), LogWriter.text(type), LogWriter.text(metadata)]));
  }
  finish(name, micros) {
    const entry = Buffer.alloc(5); entry[0] = 1; entry.writeUInt32LE(this.ids.get(name), 1);
    this.record(0, micros, entry); this.ids.delete(name);
  }
  append(name, micros, payload) { this.record(this.ids.get(name), micros, payload); }
  double(name, micros, value) { const bytes = Buffer.alloc(8); bytes.writeDoubleLE(value); this.append(name, micros, bytes); }
  boolean(name, micros, value) { this.append(name, micros, Buffer.from([value ? 1 : 0])); }
  string(name, micros, value) { this.append(name, micros, Buffer.from(value)); }
  pose(name, micros, x, y, heading) { const bytes = Buffer.alloc(24); bytes.writeDoubleLE(x, 0); bytes.writeDoubleLE(y, 8); bytes.writeDoubleLE(heading, 16); this.append(name, micros, bytes); }
  bytes() { return new Uint8Array(Buffer.concat(this.parts)); }
}

// A 150 s fake qualification match: auto 0-15 s, disabled 15-18 s, teleop 18-150 s.
const mode = t => t < 15 ? "AUTO" : t < 18 ? "DISABLED" : "TELEOP";
function stateAt(t) {
  if (t < 15) return t >= 2 && t < 8 ? "INTAKING" : t >= 9 && t < 13 ? "SCORING" : "IDLE";
  if (t < 18) return "IDLE";
  if (t >= 134) return "CLIMBING";
  const cycle = (t - 18) % 20;
  return cycle < 6 ? "IDLE" : cycle < 12 ? "INTAKING" : cycle < 16 ? "SCORING" : "IDLE";
}
const brownout = t => t >= 96.8 && t < 97.6;
const mechanisms = {
  Intake: { kind: "velocity", c1: 0.6, c2: 0.5, setpoint: s => s === "INTAKING" ? 40 : s === "SCORING" ? 20 : 0, target: (sp, t) => t >= 66 && t < 68.5 ? 4 : sp },
  Shooter: { kind: "velocity", c1: 0.9, c2: 0.02, setpoint: s => s === "INTAKING" ? 55 : s === "SCORING" ? 85 : s === "CLIMBING" ? 0 : 30, target: (sp, t) => brownout(t) ? sp * 0.55 : sp },
  Hood: { kind: "absolute", c1: 0.5, c2: 0.45, setpoint: (s, t, scoringAim) => s === "SCORING" ? scoringAim : s === "CLIMBING" ? 5 : 15, target: sp => sp, units: '{"units":"degrees"}' },
  Climber: { kind: "relative", c1: 0.3, c2: 0.2, setpoint: s => s === "CLIMBING" ? 120 : 0, target: sp => sp }
};

function writeMatch() {
  const log = new LogWriter("PowerLib log-check sample");
  const boot = 5_000_000;
  const drive = key => `PowerLib/Subsystems/Drive/Data/${key}`;
  for (const [key, type] of [["Mode", "string"], ["Enabled", "boolean"], ["ActualState", "string"], ["BatteryVolts", "double"], ["RioCanUtilization", "double"],
    ["Pose", "struct:Pose2d"], ["Pose/XMeters", "double"], ["Pose/YMeters", "double"], ["Pose/HeadingDegrees", "double"], ["Heartbeat", "double"]]) log.start(drive(key), type, "", boot);
  log.start(".schema/struct:Pose2d", "structschema", "", boot);
  log.start("PowerLib/RobotStatus/BrownedOut", "boolean", "", boot);
  for (const [owner, config] of Object.entries(mechanisms)) {
    const value = config.kind === "velocity" ? "Velocity" : "Position";
    const setpoint = config.kind === "velocity" ? "VelocitySetpoint" : config.kind === "absolute" ? "SetpointRotations" : "Setpoint";
    log.start(`PowerLib/Subsystems/${owner}/Data/${value}`, "double", config.units ?? "", boot);
    log.start(`PowerLib/Subsystems/${owner}/Data/${setpoint}`, "double", "", boot);
    if (config.kind === "relative") log.start(`PowerLib/Subsystems/${owner}/Data/AtTarget`, "boolean", "", boot);
    Object.assign(config, { valueKey: value, setpointKey: setpoint, v: 0, dv: 0 });
  }
  let aim = 25;
  let previousState = "";
  for (let step = 0; step <= 7500; step += 1) {
    const t = step * 0.02;
    const micros = boot + Math.round(t * 1e6);
    const state = stateAt(t);
    const disabled = mode(t) === "DISABLED";
    let x; let y;
    if (t < 15) { const u = Math.min(1, t / 13); x = 2 + 5.2 * u; y = 4 + 1.6 * Math.sin(Math.PI * u); }
    else if (t < 18) { x = 7.2; y = 4; }
    else { const k = ((t - 18) / 20) * 2 * Math.PI; x = 8.27 + 5.5 * Math.sin(k) - 1.07 * Math.exp(-(t - 18)); y = 4.03 + 2.6 * Math.sin(2 * k); }
    const heading = t < 18 ? 0 : Math.atan2(5.2 * Math.cos(2 * ((t - 18) / 20) * 2 * Math.PI), 5.5 * Math.cos(((t - 18) / 20) * 2 * Math.PI));
    if (state === "SCORING" && previousState !== "SCORING") aim = Math.round((24 + 2.2 * Math.abs(x - 8.27)) * 2) / 2;
    previousState = state;
    log.string(drive("Mode"), micros, mode(t));
    log.boolean(drive("Enabled"), micros, !disabled);
    log.string(drive("ActualState"), micros, disabled ? "IDLE" : state);
    log.double(drive("RioCanUtilization"), micros, t >= 121 && t < 121.5 ? 0.93 : 0.41);
    log.pose(drive("Pose"), micros, x, y, heading);
    log.double(drive("Pose/XMeters"), micros, x);
    log.double(drive("Pose/YMeters"), micros, y);
    log.double(drive("Pose/HeadingDegrees"), micros, (heading * 180) / Math.PI);
    if (step === 2500) log.finish(drive("Heartbeat"), micros);
    if (step === 2550) log.start(drive("Heartbeat"), "double", "", micros);
    if (step < 2500 || step >= 2550) log.double(drive("Heartbeat"), micros, step);
    log.boolean("PowerLib/RobotStatus/BrownedOut", micros, brownout(t));
    let shooterSetpoint = 0;
    for (const [owner, config] of Object.entries(mechanisms)) {
      const setpoint = disabled ? (owner === "Hood" ? 15 : 0) : config.setpoint(state, t, aim);
      config.dv = config.c1 * config.dv + config.c2 * (config.target(setpoint, t) - config.v);
      config.v += config.dv;
      log.double(`PowerLib/Subsystems/${owner}/Data/${config.valueKey}`, micros, config.v + Math.sin(step * 1.7) * 0.2);
      log.double(`PowerLib/Subsystems/${owner}/Data/${config.setpointKey}`, micros, setpoint);
      if (config.kind === "relative") log.boolean(`PowerLib/Subsystems/${owner}/Data/AtTarget`, micros, Math.abs(config.v - setpoint) < 2);
      if (owner === "Shooter") shooterSetpoint = setpoint;
    }
    log.double(drive("BatteryVolts"), micros, brownout(t) ? 6.9 : 12.7 - 0.008 * t - (shooterSetpoint > 50 ? 0.6 : 0));
  }
  const ints = Buffer.alloc(16); ints.writeBigInt64LE(-3n, 0); ints.writeBigInt64LE(9007199254740991n, 8);
  const names = Buffer.concat([Buffer.from([2, 0, 0, 0]), LogWriter.text("left"), LogWriter.text("right")]);
  const float = Buffer.alloc(4); float.writeFloatLE(1.5);
  for (const [name, type, payload] of [["Test/Ints", "int64[]", ints], ["Test/Names", "string[]", names], ["Test/Float", "float", float], ["Test/Flags", "boolean[]", Buffer.from([1, 0, 1])]]) {
    log.start(name, type, "", boot); log.append(name, boot + 1, payload);
  }
  return log.bytes();
}

const sampleIndex = process.argv.indexOf("--write-sample");
const match = writeMatch();
if (sampleIndex !== -1) {
  const target = process.argv[sampleIndex + 1];
  assert.ok(target, "--write-sample needs a file path");
  writeFileSync(target, match);
  console.log(`Wrote sample log to ${target} (${(match.byteLength / 1e6).toFixed(1)} MB)`);
}

// Reader
const file = parseWpilog(match);
assert.equal(file.extraHeader, "PowerLib log-check sample");
assert.equal(file.truncated, false);
assert.deepEqual(file.signals.get("Test/Ints").values[0], [-3, 9007199254740991]);
assert.deepEqual(file.signals.get("Test/Names").values[0], ["left", "right"]);
assert.equal(file.signals.get("Test/Float").values[0], 1.5);
assert.deepEqual(file.signals.get("Test/Flags").values[0], [true, false, true]);
assert.equal(file.signals.get(".schema/struct:Pose2d").values.length, 0, "Schemas are skipped");
const heartbeat = file.signals.get("PowerLib/Subsystems/Drive/Data/Heartbeat");
assert.equal(heartbeat.values.length, 7451, "A finished and restarted entry keeps one signal");
assert.equal(heartbeat.values[2500], 2550);
const firstPose = file.signals.get("PowerLib/Subsystems/Drive/Data/Pose").values[0];
assert.equal(firstPose.x, 2); assert.equal(firstPose.y, 4);
assert.throws(() => parseWpilog(new TextEncoder().encode("NOTALOG00000")), /isn't a \.wpilog/);
const cut = parseWpilog(match.subarray(0, match.byteLength - 5));
assert.equal(cut.truncated, true, "A cut-off final record is reported, not thrown");
assert.ok(cut.signals.get("PowerLib/Subsystems/Intake/Data/Velocity").values.length > 7000);

// Signal names from SignalLogger, DataLogManager and legacy paths
assert.deepEqual(metricKey("NT:/PowerLib/Subsystems/Intake/Data/Velocity"), { owner: "Intake", key: "Velocity" });
assert.deepEqual(metricKey("PowerLib/Subsystems/Drive/Data/Pose/XMeters"), { owner: "Drive", key: "Pose/XMeters" });
assert.deepEqual(metricKey("/PowerLib/Drive/BatteryVolts"), { owner: "Drive", key: "BatteryVolts" });
assert.deepEqual(metricKey("PowerLib/RobotStatus/BrownedOut"), { owner: "RobotStatus", key: "BrownedOut" });
assert.equal(metricKey("Phoenix6/TalonFX-20/StatorCurrent"), null);

// Model
const model = buildLogModel(file, [{ id: "climber", name: "Climber", type: "relativePosition", relativePosition: { units: "inches" } }]);
assert.ok(Math.abs(model.duration - 150) < 0.01, "Times start at the first sample");
assert.deepEqual(model.mechanisms.map(item => [item.id, item.kind, item.units]),
  [["Climber", "position", "inches"], ["Hood", "position", "deg"], ["Intake", "velocity", "rps"], ["Shooter", "velocity", "rps"]]);
assert.equal(busiestMechanism(model.mechanisms).id, "Shooter", "Open on the mechanism with the most setpoint changes, not the first alphabetically");
const hood = model.mechanisms.find(item => item.id === "Hood");
assert.equal(valueAt(hood.setpoint, 10), file.signals.get("PowerLib/Subsystems/Hood/Data/SetpointRotations").values[500],
  "SetpointRotations is the absolute-position setpoint");
assert.ok(model.mechanisms.find(item => item.id === "Climber").atTarget, "AtTarget is used when logged");
assert.deepEqual(model.periods.map(item => [item.label, Math.round(item.start), Math.round(item.end)]), [["Auto", 0, 15], ["Teleop", 18, 150]]);
const kinds = model.markers.map(item => `${item.kind}@${Math.round(item.time)}${item.mechanismId ? `:${item.mechanismId}` : ""}`);
assert.ok(kinds.includes("brownout@97"), kinds.join(", "));
assert.ok(kinds.includes("can@121"), kinds.join(", "));
assert.ok(kinds.includes("setpoint@66:Intake"), kinds.join(", "));
assert.ok(model.pose.values.length > 7000);
assert.deepEqual(segments(model.state, model.duration).slice(0, 3).map(run => run.value), ["IDLE", "INTAKING", "IDLE"]);
assert.equal(indexAt([0, 1, 2], 1.5), 1); assert.equal(indexAt([0, 1, 2], -1), -1);
const shooter = model.mechanisms.find(item => item.id === "Shooter");
const scoring = stepStats(shooter, 33.9);
assert.equal(scoring.from, 55); assert.equal(scoring.to, 85);
assert.ok(scoring.overshootPercent >= 0 && scoring.settleSeconds > 0, JSON.stringify(scoring));
assert.equal(stepStats(shooter, 0.01), null, "No step before the first setpoint change");

// DataLogManager-style log: 10 Hz /PowerLib/Data JSON frames only
const frames = new LogWriter();
frames.start("NT:/PowerLib/Data", "json", "", 0);
frames.start("Phoenix6/TalonFX-20/StatorCurrent", "double", "", 0);
for (let step = 0; step <= 100; step += 1) {
  const t = step / 10;
  frames.string("NT:/PowerLib/Data", step * 100000, JSON.stringify({ schemaVersion: 1, sequence: step, timestampSeconds: t, subsystems: {
    Drive: { Mode: t < 5 ? "DISABLED" : "TELEOP", BatteryVolts: 12.4, ActualState: "IDLE", Pose: t < 2 ? null : { xMeters: t, yMeters: 1, headingRadians: 0 } },
    Intake: { Velocity: t < 5 ? 0 : 20, VelocitySetpoint: t < 5 ? 0 : 20, Broken: null } } }));
  frames.double("Phoenix6/TalonFX-20/StatorCurrent", step * 100000, 3);
}
const framed = buildLogModel(parseWpilog(frames.bytes()));
assert.equal(framed.usedFrames, true);
assert.deepEqual(framed.mechanisms.map(item => item.id), ["Intake"]);
assert.deepEqual(framed.periods.map(item => [item.label, item.start]), [["Teleop", 5]]);
assert.equal(framed.pose.values.length, 81, "Null poses are skipped");
assert.equal(framed.markers.length, 0);

// Owlet export of a robot without PowerLib: Owlet's own RobotMode/RobotEnable/Voltage/CAN signals plus plain names
assert.deepEqual(plainMechanismKey("Intake Wrist Position"), { owner: "Intake Wrist", key: "Position" });
assert.deepEqual(plainMechanismKey("Shooter Velocity Setpoint"), { owner: "Shooter", key: "VelocitySetpoint" });
assert.deepEqual(plainMechanismKey("Arm/Setpoint"), { owner: "Arm", key: "Setpoint" });
for (const name of ["Voltage", "Phoenix6/TalonFX-20/Velocity", "TalonFX-20/Position", "CAN Utilization"]) assert.equal(plainMechanismKey(name), null, name);
const owlet = new LogWriter();
for (const [name, type, metadata] of [["RobotMode", "string", "{}"], ["RobotEnable", "boolean", "{}"], ["Voltage", "double", '{"units": "V"}'],
  ["CAN Utilization", "double", '{"units": "%"}'], ["Shooter Velocity", "double", '{"units": "rotations per second"}'],
  ["Shooter Velocity Setpoint", "double", '{"units": "rotations per second"}'], ["Intake Wrist Position", "double", '{"units": "degrees"}'],
  ["Feeder Velocity", "double", '{"units": "rotations per second"}']]) owlet.start(name, type, metadata, 700000);
for (let step = 0; step <= 300; step += 1) {
  const t = step / 10;
  const micros = 700000 + step * 100000;
  const robotMode = t < 5 ? "Disabled" : t < 10 ? "Autonomous" : t < 12 ? "Disabled" : "Teleop";
  owlet.string("RobotMode", micros, robotMode);
  owlet.boolean("RobotEnable", micros, robotMode !== "Disabled");
  owlet.double("Voltage", micros, t > 20 && t < 20.5 ? 6.5 : 12.3);
  owlet.double("CAN Utilization", micros, t > 25 && t < 26 ? 95 : 40);
  owlet.double("Shooter Velocity", micros, t > 12 ? 60 : 0);
  owlet.double("Shooter Velocity Setpoint", micros, t > 12 ? 60 : 0);
  owlet.double("Intake Wrist Position", micros, Math.round(t) % 4 === 0 ? 90 : 10);
  owlet.double("Feeder Velocity", micros, 0);
}
const plainModel = buildLogModel(parseWpilog(owlet.bytes()));
assert.deepEqual(plainModel.periods.map(item => [item.label, Math.round(item.start * 10) / 10, Math.round(item.end * 10) / 10]),
  [["Auto", 5, 10], ["Teleop", 12, 30]], "Owlet's Autonomous/Teleop modes become periods");
assert.deepEqual(plainModel.mechanisms.map(item => [item.id, item.name, item.kind, item.units, Boolean(item.setpoint)]),
  [["Feeder", "Feeder", "velocity", "rps", false], ["Intake Wrist", "Intake Wrist", "position", "deg", false], ["Shooter", "Shooter", "velocity", "rps", true]]);
assert.equal(valueAt(plainModel.battery, 15), 12.3, "Owlet's Voltage is the battery");
const plainKinds = plainModel.markers.map(item => `${item.kind}@${Math.round(item.time)}`);
assert.ok(plainKinds.includes("brownout@20") && plainKinds.includes("can@25"), plainKinds.join(", "));
assert.equal(busiestMechanism(plainModel.mechanisms).id, "Shooter", "A mechanism with a setpoint wins");
assert.equal(busiestMechanism(plainModel.mechanisms.filter(item => !item.setpoint)).id, "Intake Wrist", "Without setpoints, the one that moved");

console.log("log-check passed");
