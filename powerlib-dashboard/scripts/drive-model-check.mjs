import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const result = await build({ entryPoints: [fileURLToPath(new URL("../src/features/drive/driveModel.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const { discoverCameras, getPowerLibAutoChooser, driveModel, streamUrl, formatTime } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
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
const hardware = [drive("GyroConnected", true), ...["BR", "FR", "FL", "BL"].map(name => drive(`Modules/${name}/Connected`, true))];
const healthy = driveModel([...telemetry, ...hardware], true, 5200);
assert.equal(healthy.health, "healthy");
assert.deepEqual(healthy.modules.map(module => module.name), ["FL", "FR", "BL", "BR"]);
const sharedTelemetry = [...telemetry, ...hardware].map(topic => ({ ...topic,
  name: topic.name.replace("/PowerLib/Drive/", "/PowerLib/Subsystems/Drive/Data/") }));
const sharedModel = driveModel(sharedTelemetry, true, 5200);
assert.equal(sharedModel.canSelectAuto, true);
assert.deepEqual(sharedModel.pose, healthy.pose);
assert.deepEqual(sharedModel.modules, healthy.modules);
assert.equal(sharedModel.health, "healthy");
assert.equal(driveModel([drive("BatteryVolts", 9), t("/PowerLib/Subsystems/Drive/Data/BatteryVolts", 12.4)], true, 5200).number("battery"), 12.4);
assert.equal(driveModel(telemetry, true, 5200).health, "unknown"); // Pose alone cannot prove hardware health.
const failedModule = hardware.map(topic => topic.name.endsWith("/FR/Connected") ? { ...topic, value: false } : topic);
assert.equal(driveModel([...telemetry, ...failedModule], true, 5200).health, "fault");
const staleHardware = driveModel([...telemetry, ...hardware], true, 6500);
assert.equal(staleHardware.health, "unknown");
assert.ok(staleHardware.modules.every(module => module.connected === undefined));
assert.equal(driveModel([...telemetry, ...hardware, drive("PoseValid", false)], true, 5200).health, "fault");
assert.equal(driveModel([...telemetry, drive("GyroConnected", "true")], true, 5200).health, "unknown");
assert.equal(driveModel([...telemetry, drive("Pose/HeadingDegrees", -30)], true, 5200).pose.heading, -30);
const raw = new ArrayBuffer(24); const view = new DataView(raw); view.setFloat64(0, 4, true); view.setFloat64(8, 5, true); view.setFloat64(16, Math.PI, true);
assert.equal(driveModel([t("/Robot/Pose", raw, "struct:Pose2d")], true, 5200).pose.heading, 180);
assert.equal(driveModel([t("/Robot/Pose", new ArrayBuffer(8), "struct:Pose2d")], true, 5200).pose, undefined);
assert.equal(formatTime(-1), "—:—"); assert.equal(formatTime(61.1), "1:02");
console.log("Drive model checks passed: discovery, URLs, chooser, locking, stale data, invalid pose, struct pose, clock.");
