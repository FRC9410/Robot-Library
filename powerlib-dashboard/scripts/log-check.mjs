import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

// Usage: node scripts/log-check.mjs [--write-sample <path.wpilog>]
// The written sample also has Phoenix TalonFX signals (swerve IDs 1-8 plus each mechanism's motors), so every Logs widget has data.
const result = await build({
  stdin: { contents: 'export * from "./src/features/logs/wpilog.ts"; export * from "./src/features/logs/logModel.ts";',
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" },
  bundle: true, write: false, format: "esm", platform: "node"
});
const { parseWpilog, buildLogModel, busiestMechanism, busName, isViewerSignal, metricKey, plainMechanismKey, stepStats, valueAt, indexAt, segments,
  averageAt, slotMeans, canPercentAt, matchClockAt, poseHeatmap, motorAverage } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const owletBundle = await build({ entryPoints: [fileURLToPath(new URL("../electron/owlet.ts", import.meta.url))], bundle: true, write: false,
  format: "esm", platform: "node" });
const owlet = await import(`data:text/javascript;base64,${Buffer.from(owletBundle.outputFiles[0].contents).toString("base64")}`);

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

/**
 * Fake TalonFX motors for the written sample: CAN IDs, motor rotations per mechanism unit (for Position, so motion
 * matching can pair them), current per unit of speed and of acceleration, and the speed that needs full voltage.
 */
const sampleMotors = {
  Drive: { ids: [1, 2, 3, 4, 5, 6, 7, 8], ratio: 21, perSpeed: 3, perAccel: 4, fullSpeed: 4.5 },
  Intake: { ids: [20], ratio: 1, perSpeed: 0.25, perAccel: 0.02, fullSpeed: 50 },
  Shooter: { ids: [21, 22], ratio: 1, perSpeed: 0.35, perAccel: 0.03, fullSpeed: 95 },
  Hood: { ids: [23], ratio: 50 / 360, perSpeed: 0.05, perAccel: 0.002, fullSpeed: 200 },
  Climber: { ids: [24], ratio: 2, perSpeed: 0.5, perAccel: 0.02, fullSpeed: 40 }
};
const motorSignalNames = ["SupplyCurrent", "SupplyVoltage", "MotorVoltage", "StatorCurrent", "DeviceTemp", "Position"];

function writeMatch(withMotors = false) {
  const log = new LogWriter("PowerLib log-check sample");
  const boot = 5_000_000;
  const drive = key => `PowerLib/Subsystems/Drive/Data/${key}`;
  for (const [key, type] of [["Mode", "string"], ["Enabled", "boolean"], ["ActualState", "string"], ["BatteryVolts", "double"], ["RioCanUtilization", "double"],
    ["Pose", "struct:Pose2d"], ["Pose/XMeters", "double"], ["Pose/YMeters", "double"], ["Pose/HeadingDegrees", "double"], ["Heartbeat", "double"], ["MatchTimeSeconds", "double"]]) log.start(drive(key), type, "", boot);
  log.start(".schema/struct:Pose2d", "structschema", "", boot);
  log.start("PowerLib/RobotStatus/BrownedOut", "boolean", "", boot);
  log.start("PowerLib/RobotStatus/FmsAttached", "boolean", "", boot);
  for (const [owner, config] of Object.entries(mechanisms)) {
    const value = config.kind === "velocity" ? "Velocity" : "Position";
    const setpoint = config.kind === "velocity" ? "VelocitySetpoint" : config.kind === "absolute" ? "SetpointRotations" : "Setpoint";
    log.start(`PowerLib/Subsystems/${owner}/Data/${value}`, "double", config.units ?? "", boot);
    log.start(`PowerLib/Subsystems/${owner}/Data/${setpoint}`, "double", "", boot);
    if (config.kind === "relative") log.start(`PowerLib/Subsystems/${owner}/Data/AtTarget`, "boolean", "", boot);
    Object.assign(config, { valueKey: value, setpointKey: setpoint, v: 0, dv: 0 });
  }
  const motors = withMotors ? Object.entries(sampleMotors).flatMap(([group, config]) => config.ids.map(id => ({ group, config, id, position: 0, temp: 25 }))) : [];
  for (const motor of motors) for (const signal of motorSignalNames) log.start(`Phoenix6/TalonFX-${motor.id}/${signal}`, "double", "", boot);
  let previousPose = { x: 2, y: 4 };
  let previousDriveSpeed = 0;
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
    // The Driver Station counts each period down (15 s auto, 135 s teleop in this fake match) and reads -1 between them.
    log.double(drive("MatchTimeSeconds"), micros, t < 15 ? 15 - t : t < 18 ? -1 : 135 - (t - 18));
    log.boolean("PowerLib/RobotStatus/FmsAttached", micros, true);
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
    const battery = brownout(t) ? 6.9 : 12.7 - 0.008 * t - (shooterSetpoint > 50 ? 0.6 : 0);
    log.double(drive("BatteryVolts"), micros, battery);
    const driveSpeed = Math.hypot(x - previousPose.x, y - previousPose.y) / 0.02;
    const motion = {
      Drive: { speed: step ? driveSpeed : 0, accel: step ? (driveSpeed - previousDriveSpeed) / 0.02 : 0 },
      ...Object.fromEntries(Object.entries(mechanisms).map(([owner, config]) => [owner, config.kind === "velocity"
        ? { speed: config.v, accel: config.dv / 0.02 } : { speed: config.dv / 0.02, accel: 0, position: config.v }]))
    };
    previousPose = { x, y };
    previousDriveSpeed = driveSpeed;
    for (const motor of motors) {
      const { speed, accel, position } = motion[motor.group];
      const { ratio, perSpeed, perAccel, fullSpeed } = motor.config;
      motor.position = position !== undefined ? position * ratio : motor.position + speed * ratio * 0.02;
      const climbing = motor.group === "Climber" && stateAt(t) === "CLIMBING" ? 20 : 0;
      const supply = disabled ? 0 : Math.max(0, 0.8 + perSpeed * Math.abs(speed) + Math.min(25, perAccel * Math.abs(accel)) + climbing + Math.sin(step * 0.9 + motor.id) * 0.3);
      motor.temp += supply * supply * 0.00002 - (motor.temp - 25) * 0.0005;
      const name = signal => `Phoenix6/TalonFX-${motor.id}/${signal}`;
      log.double(name("SupplyCurrent"), micros, supply);
      log.double(name("StatorCurrent"), micros, supply * 1.7);
      log.double(name("SupplyVoltage"), micros, battery - supply * 0.01);
      log.double(name("MotorVoltage"), micros, disabled ? 0 : Math.sign(speed) * battery * Math.min(1, Math.abs(speed) / fullSpeed + 0.03));
      log.double(name("DeviceTemp"), micros, motor.temp);
      log.double(name("Position"), micros, motor.position);
    }
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
const sample = writeMatch(true);
if (sampleIndex !== -1) {
  const target = process.argv[sampleIndex + 1];
  assert.ok(target, "--write-sample needs a file path");
  writeFileSync(target, sample);
  console.log(`Wrote sample log to ${target} (${(sample.byteLength / 1e6).toFixed(1)} MB)`);
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
// Match clock and FMS come from Drive/MatchTimeSeconds and RobotStatus/FmsAttached.
assert.equal(Math.round(matchClockAt(model.matchTime, 10)), 5, "Match time counts down in auto");
assert.equal(matchClockAt(model.matchTime, 16), undefined, "Negative match time (between periods) shows no clock");
assert.equal(Math.round(matchClockAt(model.matchTime, 50)), 103);
assert.equal(matchClockAt(undefined, 50), undefined);
assert.equal(valueAt(model.fmsAttached, 50), true);
// Heat map: enabled pose samples per 0.3 m cell; disabled time (15-18 s) and off-field poses don't count.
const heat = poseHeatmap(model.pose, model.periods, 16.54, 8.07);
assert.deepEqual([heat.columns, heat.rows], [56, 27]);
const enabledSamples = model.pose.times.filter(time => model.periods.some(period => time >= period.start && time < period.end)).length;
assert.equal(heat.counts.reduce((sum, count) => sum + count, 0), enabledSamples, "Every enabled on-field pose lands in one cell");
assert.ok(heat.max > 0 && heat.max === Math.max(...heat.counts));
const parked = poseHeatmap({ times: [0, 1, 2, 3], values: [{ x: 1, y: 1 }, { x: 1.1, y: 1.1 }, { x: 99, y: 1 }, { x: 1, y: 1 }] }, [{ start: 0, end: 2.5 }], 16.54, 8.07);
assert.equal(parked.counts[3 * parked.columns + 3], 2, "Off-field and disabled samples are left out");
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
const owletLog = new LogWriter();
for (const [name, type, metadata] of [["RobotMode", "string", "{}"], ["RobotEnable", "boolean", "{}"], ["Voltage", "double", '{"units": "V"}'],
  ["CAN Utilization", "double", '{"units": "%"}'], ["Shooter Velocity", "double", '{"units": "rotations per second"}'],
  ["Shooter Velocity Setpoint", "double", '{"units": "rotations per second"}'], ["Intake Wrist Position", "double", '{"units": "degrees"}'],
  ["Feeder Velocity", "double", '{"units": "rotations per second"}'], ["DS:IsFMSAttached", "boolean", "{}"]]) owletLog.start(name, type, metadata, 700000);
for (let step = 0; step <= 300; step += 1) {
  const t = step / 10;
  const micros = 700000 + step * 100000;
  const robotMode = t < 5 ? "Disabled" : t < 10 ? "Autonomous" : t < 12 ? "Disabled" : "Teleop";
  owletLog.string("RobotMode", micros, robotMode);
  owletLog.boolean("RobotEnable", micros, robotMode !== "Disabled");
  owletLog.double("Voltage", micros, t > 20 && t < 20.5 ? 6.5 : 12.3);
  owletLog.double("CAN Utilization", micros, t > 25 && t < 26 ? 95 : 40);
  owletLog.double("Shooter Velocity", micros, t > 12 ? 60 : 0);
  owletLog.double("Shooter Velocity Setpoint", micros, t > 12 ? 60 : 0);
  owletLog.double("Intake Wrist Position", micros, Math.round(t) % 4 === 0 ? 90 : 10);
  owletLog.double("Feeder Velocity", micros, 0);
  owletLog.boolean("DS:IsFMSAttached", micros, false);
}
const plainModel = buildLogModel(parseWpilog(owletLog.bytes()));
assert.deepEqual(plainModel.periods.map(item => [item.label, Math.round(item.start * 10) / 10, Math.round(item.end * 10) / 10]),
  [["Auto", 5, 10], ["Teleop", 12, 30]], "Owlet's Autonomous/Teleop modes become periods");
assert.deepEqual(plainModel.mechanisms.map(item => [item.id, item.name, item.kind, item.units, Boolean(item.setpoint)]),
  [["Feeder", "Feeder", "velocity", "rps", false], ["Intake Wrist", "Intake Wrist", "position", "deg", false], ["Shooter", "Shooter", "velocity", "rps", true]]);
assert.equal(valueAt(plainModel.battery, 15), 12.3, "Owlet's Voltage is the battery");
assert.equal(valueAt(plainModel.fmsAttached, 15), false, "Owlet's DS:IsFMSAttached says whether the FMS was connected");
assert.equal(plainModel.matchTime, undefined, "Owlet exports have no match time");
const plainKinds = plainModel.markers.map(item => `${item.kind}@${Math.round(item.time)}`);
assert.ok(plainKinds.includes("brownout@20") && plainKinds.includes("can@25"), plainKinds.join(", "));
assert.equal(busiestMechanism(plainModel.mechanisms).id, "Shooter", "A mechanism with a setpoint wins");
assert.equal(busiestMechanism(plainModel.mechanisms.filter(item => !item.setpoint)).id, "Intake Wrist", "Without setpoints, the one that moved");

// A two-file session: roboRIO file with mechanism values, CANivore file with Phoenix's motor signals
assert.equal(busName("MOSE_Q8_rio_2026-04-03_14-55-53.hoot"), "rio");
assert.equal(busName("MOSE_Q8_9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-55-53.hoot"), "CANivore");
assert.ok(isViewerSignal("Phoenix6/TalonFX-20/SupplyCurrent") && !isViewerSignal("Phoenix6/TalonFX-20/DutyCycle") && isViewerSignal("Shooter Velocity"));
const rio = new LogWriter();
const canivore = new LogWriter();
for (const log of [rio, canivore]) { log.start("RobotMode", "string", "{}", 0); log.start("Voltage", "double", '{"units": "V"}', 0); }
rio.start("Intake Velocity", "double", '{"units": "rotations per second"}', 0);
rio.start("Phoenix6/TalonFX-20/SupplyCurrent", "double", '{"units": "A"}', 0);
const motorIds = [20, 21, 1, 2];
for (const id of motorIds) for (const signal of ["SupplyCurrent", "SupplyVoltage", "MotorVoltage", "StatorCurrent", "DeviceTemp", "DutyCycle"]) {
  canivore.start(`Phoenix6/TalonFX-${id}/${signal}`, "double", "{}", 0);
}
for (let step = 0; step <= 100; step += 1) {
  const micros = step * 100000;
  for (const log of [rio, canivore]) { log.string("RobotMode", micros, step < 20 ? "Disabled" : "Teleop"); log.double("Voltage", micros, 12); }
  rio.double("Intake Velocity", micros, step >= 20 ? 40 : 0);
  rio.double("Phoenix6/TalonFX-20/SupplyCurrent", micros, 99);
  for (const id of motorIds) {
    const amps = step >= 20 ? (id >= 20 ? 10 : 30) : 0;
    canivore.double(`Phoenix6/TalonFX-${id}/SupplyCurrent`, micros + id, amps);
    canivore.double(`Phoenix6/TalonFX-${id}/SupplyVoltage`, micros + id, 11.5);
    canivore.double(`Phoenix6/TalonFX-${id}/MotorVoltage`, micros + id, id === 20 ? 6 : 8);
    canivore.double(`Phoenix6/TalonFX-${id}/StatorCurrent`, micros + id, amps * 2);
    canivore.double(`Phoenix6/TalonFX-${id}/DeviceTemp`, micros + id, 30 + id);
    canivore.double(`Phoenix6/TalonFX-${id}/DutyCycle`, micros + id, 0.5);
  }
}
const sessionFiles = [{ name: "Q8_rio_2026-04-03_14-55-53.wpilog", bytes: rio.bytes() }, { name: "Q8_9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-55-53.wpilog", bytes: canivore.bytes() }];
const sessionSources = sessionFiles.map(file => ({ name: file.name, file: parseWpilog(file.bytes, isViewerSignal) }));
assert.equal(sessionSources[1].file.signals.has("Phoenix6/TalonFX-20/DutyCycle"), false, "Signals the viewer doesn't use are skipped while parsing");
const intakeConfig = [{ id: "intake", name: "Intake", type: "velocity", motors: [{ role: "leader", id: 20 }, { role: "follower", id: 21 }] }];
const session = buildLogModel(sessionSources, intakeConfig);
assert.deepEqual(session.buses, ["rio", "CANivore"]);
assert.deepEqual(session.motors.map(motor => [motor.key, motor.group]),
  [["CANivore:1", ""], ["CANivore:2", ""], ["CANivore:20", "Intake"], ["CANivore:21", "Intake"], ["rio:20", ""]],
  "Config IDs mean the CANivore motor when the same ID is also on the roboRIO bus");
const intake = session.mechanisms.find(item => item.id === "Intake");
assert.deepEqual(intake.motors.map(motor => motor.id), [20, 21]);
assert.equal(valueAt(intake.metrics.current, 5), 20, "Supply current is summed across the mechanism's motors");
assert.equal(valueAt(intake.metrics.power, 5), 230, "Power is supply voltage times supply current, summed");
assert.equal(valueAt(intake.metrics.voltage, 5), 7, "Applied voltage is averaged");
assert.equal(valueAt(intake.metrics.stator, 5), 40);
assert.equal(valueAt(intake.metrics.temp, 5), 51, "Temperature is the hottest motor");
const intakeAverage = motorAverage(intake.motors, "SupplyCurrent");
assert.equal(valueAt(intakeAverage, 5), 10, "The average line is the mean of the motors (summed current 20 A over 2 motors)");
assert.ok(intakeAverage.min <= 0 && intakeAverage.max >= 10, "The axis includes zero and the motors' usual readings");
// 100 Hz readings at 20 A with one 400 A sample: the axis follows the 0.1 s means (58 A there), not the raw spike.
const spiky = motorAverage([{ signals: { SupplyCurrent: { times: [...Array(1000).keys()].map(index => index / 100),
  values: [...Array(1000).keys()].map(index => index === 505 ? 400 : 20) } } }], "SupplyCurrent");
assert.equal(spiky.min, 0, "The axis includes zero");
assert.ok(spiky.max > 20 && spiky.max < 100, `One raw spike doesn't stretch the axis (max ${spiky.max})`);
assert.equal(motorAverage(intake.motors, "Position"), undefined, "No average when none of the motors logged that signal");
assert.equal(motorAverage([], "SupplyCurrent"), undefined);
assert.deepEqual(session.mechanisms.filter(item => item.kind === "motors").map(item => item.id), ["motor:CANivore:1", "motor:CANivore:2", "motor:rio:20"],
  "Unassigned motors are listed on their own");
assert.deepEqual(session.powerGroups.map(group => group.id), ["Intake", "unassigned"]);
assert.equal(valueAt(session.powerGroups[1].power, 5), 30 * 11.5 * 2 + 99 * 12,
  "Unassigned motors are grouped in the power widget; a motor without SupplyVoltage uses the battery voltage");
assert.equal(valueAt(session.powerGroups[0].current, 5), 20, "Each power group carries its summed supply current for the Power card");
assert.equal(valueAt(session.powerGroups[1].current, 5), 30 * 2 + 99);
assert.equal(busiestMechanism(session.mechanisms).id, "Intake", "Motor-only groups come last");
const assigned = buildLogModel(sessionSources, intakeConfig, { "CANivore:1": "Drive", "CANivore:2": "Drive", "CANivore:21": "" });
const drive = assigned.mechanisms.find(item => item.id === "Drive");
assert.equal(drive.kind, "motors");
assert.equal(valueAt(drive.value, 5), 690, "A new group's value is its power");
assert.deepEqual(assigned.mechanisms.find(item => item.id === "Intake").motors.map(motor => motor.id), [20], "An override can unassign a configured motor");
assert.ok(assigned.mechanisms.some(item => item.id === "motor:CANivore:21"));
assert.deepEqual(assigned.periods.map(period => period.label), ["Teleop"], "Both files share one clock and one set of periods");

// Steady displays of noisy motor data: fixed slots, short averages and a fixed power-group order
const noisy = { times: Array.from({ length: 1000 }, (_, index) => index * 0.01), values: Array.from({ length: 1000 }, (_, index) => (index % 2 ? 0 : 10)) };
const slotsA = slotMeans(noisy, 2.003, 4.003, 0.1);
const slotsB = slotMeans(noisy, 2.051, 4.051, 0.1);
assert.deepEqual(slotsB.starts.slice(0, 5).map(start => start.toFixed(1)), slotsA.starts.slice(0, 5).map(start => start.toFixed(1)), "Slot edges don't move with the window");
assert.deepEqual(slotsB.means.slice(0, 19), slotsA.means.slice(0, 19), "So a sliding window shows the same values");
assert.ok(slotsA.means.every(mean => Math.abs(mean - 5) < 0.6), "Each slot is the mean of its ~10 samples, not one raw 0 or 10");
assert.equal(averageAt(noisy, 5, 0.5), 5, "Readouts average out alternating 0/10 A samples");
assert.equal(averageAt(noisy, -1), undefined);
assert.deepEqual(assigned.powerGroups.map(group => group.id), ["Drive", "Intake", "unassigned"],
  "Power groups are ordered by average power over the whole log, unassigned last");

// Automatic motor grouping with no config: motion matching, TunerConstants drive IDs, and the template-ID guess
const motionRio = new LogWriter();
const motionCan = new LogWriter();
motionRio.start("RobotMode", "string", "{}", 0);
motionRio.start("Shooter Velocity", "double", "{}", 0);
motionRio.start("Arm Position", "double", '{"units": "degrees"}', 0);
const motionMotors = [30, 31, 40, 1, 2, 3, 4, 5, 6, 7, 8, 9];
for (const id of motionMotors) for (const signal of ["Position", "SupplyCurrent"]) motionCan.start(`Phoenix6/TalonFX-${id}/${signal}`, "double", "{}", 0);
const shooterAt = t => t < 20 ? 0 : 30 + 25 * Math.sin(t / 3) + (Math.floor(t / 7) % 2) * 20;
const armAt = t => 20 + 40 * Math.sin(t / 5) + 15 * Math.sin(t * 1.3);
let shooterTurns = 0;
for (let step = 0; step <= 6000; step += 1) {
  const t = step * 0.02;
  const micros = Math.round(t * 1e6);
  if (step % 5 === 0) motionRio.string("RobotMode", micros, t < 20 ? "Disabled" : "Teleop");
  motionRio.double("Shooter Velocity", micros, shooterAt(t) + Math.sin(step * 2.3) * 0.5);
  motionRio.double("Arm Position", micros, armAt(t));
  shooterTurns += shooterAt(t) * 0.02 * 2.5;
  const positions = { 30: shooterTurns, 31: -shooterTurns, 40: armAt(t) / 360 * 60 + 12, 9: Math.sin(step * 0.71) * 5 };
  for (const id of motionMotors) {
    const position = positions[id] ?? (id % 2 ? Math.sin(t * (0.3 + id / 10)) * 3 : t * (1 + id / 4) + Math.sin(t * id));
    motionCan.double(`Phoenix6/TalonFX-${id}/Position`, micros + id, position);
    motionCan.double(`Phoenix6/TalonFX-${id}/SupplyCurrent`, micros + id, 5);
  }
}
const motionSources = [{ name: "M_rio_2026-01-01_00-00-00.wpilog", file: parseWpilog(motionRio.bytes()) },
  { name: "M_9F61CEC3394C4853202020503F0E19FF_2026-01-01_00-00-00.wpilog", file: parseWpilog(motionCan.bytes()) }];
const groupsOf = model => Object.fromEntries(model.motors.map(motor => [motor.id, `${motor.group}/${motor.source}`]));
const guessed = groupsOf(buildLogModel(motionSources));
assert.equal(guessed[30], "Shooter/motion", "A geared motor matches its velocity mechanism by motion");
assert.equal(guessed[31], "Shooter/motion", "An inverted follower matches too");
assert.equal(guessed[40], "Arm/motion", "A position mechanism matches its motor's position despite gearing and offset");
assert.equal(guessed[9], "/", "A motor that matches nothing stays unassigned");
for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(guessed[id], "Drive/guess", `Template swerve ID ${id} is guessed as Drive`);
const motionScore = buildLogModel(motionSources).motors.find(motor => motor.id === 30).matchScore;
assert.ok(motionScore > 0.95, `motion score ${motionScore}`);
const tuned = groupsOf(buildLogModel(motionSources, [], {}, [1, 2, 3, 4, 5, 6, 7, 8]));
for (const id of [1, 2, 3, 4, 5, 6, 7, 8]) assert.equal(tuned[id], "Drive/tuner", "TunerConstants IDs group as Drive");
assert.equal(groupsOf(buildLogModel(motionSources, [{ name: "Shooter", motors: [{ id: 31 }] }], { "CANivore:30": "" }))[31], "Shooter/config",
  "Config beats motion matching");
assert.equal(groupsOf(buildLogModel(motionSources, [], { "CANivore:30": "" }))[30], "/override", "A manual Unassigned beats motion matching");

// Owlet helpers: session files, scan parsing and which signals get exported
assert.deepEqual(owlet.sessionSiblings("Q8_9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-55-53.hoot",
  ["Q8_9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-55-53.hoot", "Q8_rio_2026-04-03_14-55-53.hoot", "Q9_rio_2026-04-03_15-10-00.hoot", "notes.txt"]),
  ["Q8_rio_2026-04-03_14-55-53.hoot", "Q8_9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-55-53.hoot"]);
assert.deepEqual(owlet.sessionSiblings("practice.hoot", ["practice.hoot", "other.hoot"]), ["practice.hoot"], "Files without a session timestamp open alone");
const scan = "Shooter Velocity:          1ff00\nTalonFX-20/SupplyCurrent:   6f51400\nTalonFX-20/DutyCycle:     6f01400\nCANcoder-11/Position:   1231400\nPowerLib/Subsystems/Intake/Data/Velocity:  2ff00\nScanning...";
assert.deepEqual(owlet.pickSignalIds(scan), ["1ff00", "6f51400", "2ff00"]);

// CAN use reads as a percent whether the log stored a 0–1 fraction (PowerLib) or a percentage (Owlet).
assert.equal(canPercentAt({ times: [0, 1], values: [0.2, 0.45] }, 1.5), 45);
assert.equal(canPercentAt({ times: [0, 1], values: [20, 45] }, 0.5), 20);
assert.equal(canPercentAt(undefined, 1), undefined);
assert.equal(canPercentAt({ times: [1], values: [0.3] }, 0.5), undefined, "No CAN reading before the first sample");

// The written sample's fake motors group with no config: swerve IDs 1-8 by the template guess, the rest by motion.
const sampleModel = buildLogModel(parseWpilog(sample));
const sampleGroup = id => sampleModel.motors.find(motor => motor.id === id)?.group;
assert.deepEqual([1, 8, 20, 21, 22, 23, 24].map(sampleGroup), ["Drive", "Drive", "Intake", "Shooter", "Shooter", "Hood", "Climber"]);
assert.ok(sampleModel.pose && sampleModel.state && sampleModel.powerGroups.length >= 5, "The sample fills every Logs widget");

console.log("log-check passed");
