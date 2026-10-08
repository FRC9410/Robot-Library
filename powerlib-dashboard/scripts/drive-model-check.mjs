import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const result = await build({ entryPoints: [fileURLToPath(new URL("../src/features/drive/driveModel.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const { discoverCameras, discoverMechanisms, getPowerLibAutoChooser, driveModel, streamUrl, formatTime } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const t = (name, value, type = typeof value) => ({ name, value, type, receivedAt: 5000 });
const drive = (key, value) => t(`/PowerLib/Drive/${key}`, value);
assert.equal(streamUrl("mjpg:http://10.94.10.11:1181/?action=stream"), "http://10.94.10.11:1181/?action=stream");
assert.equal(streamUrl("mjpeg:http://host:1181/stream"), "http://host:1181/stream");
for (const bad of ["javascript:alert(1)", "file:///tmp/image", "http://user:pass@host/camera", "not a url"]) assert.equal(streamUrl(bad), undefined);
const cameras = discoverCameras([t("/CameraPublisher/front/streams", ["mjpg:http://host:1181/stream", "http://host:1181/stream", "bad"]),
  t("/CameraPublisher/front/connected", false), t("/limelight-left/hb", 10), t("/limelight-fake/name", "fake")]);
assert.equal(cameras.length, 2); assert.equal(cameras[0].urls.length, 1); assert.equal(cameras[0].connected, false);
assert.equal(discoverCameras([t("/CameraPublisher/broken/streams", [12, false, "file:///x"])]).length, 0);
const chooser = getPowerLibAutoChooser([t("/SmartDashboard/Auto Chooser/.type", "String Chooser"), t("/SmartDashboard/Auto Chooser/options", ["None", "Left", "Left"]),
  t("/SmartDashboard/Auto Chooser/active", "Left"), t("/SmartDashboard/Bad/.type", "String Chooser"), t("/SmartDashboard/Bad/options", [4])]);
assert.deepEqual(chooser.options, ["None", "Left"]); assert.equal(chooser.active, "Left");
assert.equal(getPowerLibAutoChooser([t("/SmartDashboard/Other Auto/.type", "String Chooser"), t("/SmartDashboard/Other Auto/options", ["Wrong chooser"])]), undefined);
assert.equal(getPowerLibAutoChooser([t("/SmartDashboard/Auto Chooser/.type", "String Chooser"), t("/SmartDashboard/Auto Chooser/options", [4])]), undefined);
for (const options of [["None", "Shared", "Red"], ["None", "Shared", "Blue"], ["None", "Shared"]]) {
  assert.deepEqual(getPowerLibAutoChooser([t("/SmartDashboard/Auto Chooser/.type", "String Chooser"),
    t("/SmartDashboard/Auto Chooser/options", options)]).options, options);
}
const telemetry = [drive("Heartbeat", 2), drive("Enabled", false), drive("Pose/XMeters", 2), drive("Pose/YMeters", 3), drive("Pose/HeadingDegrees", 90)];
assert.equal(driveModel(telemetry, true, 5200).canSelectAuto, true);
assert.deepEqual(driveModel(telemetry, true, 5200).pose, { x: 2, y: 3, heading: 90 });
assert.equal(driveModel([...telemetry, drive("Enabled", true)], true, 5200).canSelectAuto, false);
for (const model of [driveModel(telemetry, true, 6500), driveModel(telemetry, false, 5200), driveModel([], true, 5200)]) {
  assert.equal(model.canSelectAuto, false); assert.equal(model.pose, undefined);
}
assert.equal(driveModel([...telemetry, drive("PoseValid", false)], true, 5200).pose, undefined);
assert.equal(driveModel([...telemetry, drive("Pose/XMeters", NaN)], true, 5200).pose, undefined);
const robotStatus = driveModel([...telemetry, drive("RequestedState", "SHOOTING"), drive("ActualState", "PREPARING_SHOT"), drive("BatteryVolts", 11.8), drive("Alliance", "Red"), drive("MatchTimeSeconds", 92), drive("RioCanUtilization", .35)], true, 5200);
assert.equal(robotStatus.text("requestedState"), "SHOOTING");
assert.equal(robotStatus.text("actualState"), "PREPARING_SHOT");
assert.equal(robotStatus.number("battery"), 11.8);
assert.equal(robotStatus.text("alliance"), "Red");
assert.equal(robotStatus.number("time"), 92);
assert.equal(robotStatus.number("can"), .35);
assert.equal(driveModel([...telemetry, drive("State", "SHOOTING")], true, 5200).text("actualState"), undefined, "Legacy requested state must not masquerade as actual state");
const sharedTelemetry = telemetry.map(topic => ({ ...topic, name: topic.name.replace("/PowerLib/Drive/", "/PowerLib/Subsystems/Drive/Data/") }));
const sharedModel = driveModel(sharedTelemetry, true, 5200);
assert.equal(sharedModel.canSelectAuto, true);
assert.deepEqual(sharedModel.pose, driveModel(telemetry, true, 5200).pose);
assert.equal(driveModel([...telemetry, drive("PoseValid", false)], true, 5200).health, "fault");
assert.equal(driveModel([drive("BatteryVolts", 9), t("/PowerLib/Subsystems/Drive/Data/BatteryVolts", 12.4)], true, 5200).number("battery"), 12.4);
const targeting = telemetry.map(topic => topic.name.endsWith("/Enabled") ? { ...topic, value: true } : topic);
assert.equal(driveModel([...targeting, drive("HeadingSetpointDegrees", -30)], true, 5200).headingSetpoint, -30);
for (const value of [NaN, Infinity, "90"]) assert.equal(driveModel([...targeting, drive("HeadingSetpointDegrees", value)], true, 5200).headingSetpoint, undefined);
for (const extras of [[drive("Enabled", false)], [drive("Mode", "TEST")], [drive("PoseValid", false)]]) {
  const topics = [...targeting.filter(topic => !extras.some(extra => extra.name === topic.name)), ...extras, drive("HeadingSetpointDegrees", 90)];
  assert.equal(driveModel(topics, true, 5200).headingSetpoint, undefined);
}
assert.equal(driveModel([...targeting, drive("HeadingSetpointDegrees", 90)], true, 6500).headingSetpoint, undefined);
assert.equal(driveModel([...targeting, drive("HeadingSetpointDegrees", 90)], false, 5200).headingSetpoint, undefined);
assert.equal(driveModel(targeting, true, 5200).headingSetpoint, undefined);
assert.equal(driveModel([...telemetry, drive("Pose/HeadingDegrees", -30)], true, 5200).pose.heading, -30);
const raw = new ArrayBuffer(24); const view = new DataView(raw); view.setFloat64(0, 4, true); view.setFloat64(8, 5, true); view.setFloat64(16, Math.PI, true);
assert.equal(driveModel([t("/Robot/Pose", raw, "struct:Pose2d")], true, 5200).pose.heading, 180);
const sharedStruct = driveModel([t("/PowerLib/Subsystems/Drive/Data/Pose", raw, "struct:Pose2d")], true, 5200);
assert.deepEqual(sharedStruct.pose, { x: 4, y: 5, heading: 180 });
assert.equal(sharedStruct.poseSupported, true);
assert.equal(sharedStruct.canSelectAuto, false, "Pose alone must not unlock autonomous selection");
assert.equal(driveModel([t("/Robot/Pose", new ArrayBuffer(8), "struct:Pose2d")], true, 5200).pose, undefined);
assert.equal(formatTime(-1), "—:—"); assert.equal(formatTime(61.1), "1:02");
const mechanism = (owner, key, value) => t(`/PowerLib/Subsystems/${owner}/Data/${key}`, value);
const mechanisms = [mechanism("Flywheel", "Velocity", 42.5), mechanism("Flywheel", "Position", 100), mechanism("Flywheel", "VelocitySetpoint", 60),
  mechanism("Hood", "Position", .061), mechanism("Hood", "SetpointRotations", .08), mechanism("Wrist", "Position", -.4), mechanism("Wrist", "Setpoint", 0),
  mechanism("Feeder", "Velocity", 0), mechanism("Drive", "Position", 12)];
const cards = discoverMechanisms(mechanisms, [{ name: "Wrist", relativePosition: { units: "degrees" } }], true, 5200);
assert.equal(cards.length, 4);
assert.equal(cards.find(card => card.id === "Flywheel").value, 42.5, "Velocity takes priority over its encoder position");
assert.equal(cards.find(card => card.id === "Flywheel").setpoint, 60);
assert.equal(cards.find(card => card.id === "Hood").setpoint, .08);
assert.equal(cards.find(card => card.id === "Wrist").setpoint, 0);
assert.equal(cards.find(card => card.id === "Wrist").units, "degrees");
assert.equal(cards.find(card => card.id === "Feeder").setpoint, undefined);
for (const value of [null, NaN, Infinity, "60"]) {
  assert.equal(discoverMechanisms([mechanism("Flywheel", "Velocity", 42.5), mechanism("Flywheel", "VelocitySetpoint", value)], [], true, 5200)[0].setpoint, undefined);
}
for (const [connected, now] of [[false, 5200], [true, 6500]]) {
  assert.ok(discoverMechanisms(mechanisms, [], connected, now).every(card => card.value === undefined && card.setpoint === undefined));
}
console.log("Drive model checks passed: discovery, URLs, chooser, locking, stale data, pose, mechanism actuals/setpoints, units, clock.");
