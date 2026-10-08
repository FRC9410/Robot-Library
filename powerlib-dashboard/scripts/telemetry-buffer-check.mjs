import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { readFileSync } from "node:fs";

const result = await build({ entryPoints: [fileURLToPath(new URL("../src/networktables/TopicSnapshotBuffer.ts", import.meta.url))],
  bundle: true, write: false, format: "esm", platform: "node" });
const { TopicSnapshotBuffer } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const buffer = new TopicSnapshotBuffer();
const sample = (name, value) => ({ name, value, type: "double" });

// A burst retains just the newest sample per topic, with its actual arrival time.
for (let index = 0; index < 10000; index++) buffer.upsert(sample("/Velocity", index), index);
buffer.upsert(sample("/Heartbeat", 5), 9999);
const batch = buffer.flush();
assert.equal(batch.length, 2);
assert.deepEqual(batch.find(topic => topic.name === "/Velocity"), { ...sample("/Velocity", 9999), receivedAt: 9999 });
assert.equal(buffer.flush(), null, "Idle intervals must not cause screen updates");

// Sparse updates keep the other latest readings without re-stamping their freshness.
buffer.upsert(sample("/Velocity", 10000), 10100);
const next = buffer.flush();
assert.equal(next.find(topic => topic.name === "/Heartbeat").receivedAt, 9999);
assert.equal(next.find(topic => topic.name === "/Velocity").receivedAt, 10100);

// Disconnect or host changes discard pending readings from the previous session.
buffer.upsert(sample("/OldRobot", 1), 10200);
buffer.replace([]);
assert.equal(buffer.flush(), null);
assert.deepEqual(buffer.values(), []);
buffer.upsert(sample("/NewRobot", 2), 10300);
assert.deepEqual(buffer.flush(), [{ ...sample("/NewRobot", 2), receivedAt: 10300 }]);
console.log("Telemetry batching checks passed: latest readings, timestamps, idle updates, and connection resets.");

// Each complete map replaces the preceding map atomically, including removed metrics.
const frame = (subsystems, sequence = 1) => ({ name: "/PowerLib/Data", type: "json",
  value: JSON.stringify({ schemaVersion: 1, sequence, timestampSeconds: sequence * .1, subsystems }) });
const drivePrefix = "/PowerLib/Subsystems/Drive/Data/";
buffer.replace([]);
buffer.upsert(sample(drivePrefix + "OldField", 7), 11000);
buffer.upsert(sample("/PowerLib/Subsystems/Shooter/Variables/Target", 35), 11000);
buffer.upsert(frame({ Drive: { Heartbeat: 1, Enabled: false, RequestedState: "READY", ActualState: "DISABLED",
  Alliance: "Blue", MatchTimeSeconds: -1, RioCanUtilization: .25, BatteryVolts: 12,
  Pose: { xMeters: 2, yMeters: 3, headingRadians: Math.PI / 2 } }, Shooter: { Velocity: 35 } }), 11100);
let complete = buffer.flush();
assert.equal(complete.some(topic => topic.name.endsWith("/OldField")), false);
assert.equal(complete.find(topic => topic.name === drivePrefix + "BatteryVolts").value, 12);
assert.equal(complete.find(topic => topic.name.endsWith("/Shooter/Data/Velocity")).value, 35);
assert.equal(complete.find(topic => topic.name.endsWith("/Shooter/Variables/Target")).value, 35);
const modelBuild = await build({ entryPoints: [fileURLToPath(new URL("../src/features/drive/driveModel.ts", import.meta.url))],
  bundle: true, write: false, format: "esm", platform: "node" });
const { driveModel } = await import(`data:text/javascript;base64,${Buffer.from(modelBuild.outputFiles[0].contents).toString("base64")}`);
assert.deepEqual(driveModel(complete, true, 11200).pose, { x: 2, y: 3, heading: 90 });
assert.equal(driveModel(complete, true, 11200).canSelectAuto, true);
assert.equal(driveModel(complete, true, 12400).canSelectAuto, false);
buffer.upsert(sample(drivePrefix + "BatteryVolts", 99), 11150);
assert.equal(buffer.flush(), null, "Old scalar publishers cannot mix with the complete map");
for (let sequence = 2; sequence <= 100; sequence++) {
  buffer.upsert(frame({ Drive: { Heartbeat: sequence, Enabled: true, BatteryVolts: sequence } }, sequence), 11100 + sequence);
}
complete = buffer.flush();
assert.equal(complete.find(topic => topic.name === drivePrefix + "BatteryVolts").value, 100);
assert.equal(complete.some(topic => topic.name.endsWith("/Shooter/Data/Velocity")), false);
assert.equal(complete.some(topic => topic.name === drivePrefix + "Pose"), false);
assert.equal(complete.find(topic => topic.name === drivePrefix + "Heartbeat").receivedAt, 11200);
const latest = complete;
for (const value of ["{", "{}", JSON.stringify({ schemaVersion: 2, sequence: 1, timestampSeconds: .1, subsystems: {} }),
  JSON.stringify({ schemaVersion: 1, sequence: 1, timestampSeconds: .1, subsystems: { Drive: { Pose: { xMeters: "bad" } } } })]) {
  buffer.upsert({ name: "/PowerLib/Data", type: "json", value }, 12000);
  assert.equal(buffer.flush(), null, "Malformed frames must not refresh telemetry");
  assert.ok(buffer.telemetryError, "Rejected frames must be visible to the operator");
  assert.deepEqual(buffer.values(), latest);
}
buffer.upsert(frame({ Drive: { Heartbeat: 101, HeadingSetpointDegrees: null, Pose: null, PoseValid: false } }, 101), 12000);
assert.equal(buffer.telemetryError, null, "A valid frame clears the diagnostic");
assert.equal(buffer.flush().find(topic => topic.name === drivePrefix + "HeadingSetpointDegrees").value, null);
buffer.upsert(frame({}, 102), 12100);
assert.equal(buffer.flush().some(topic => topic.name.startsWith(drivePrefix)), false);
buffer.replace([]);
buffer.upsert(sample(drivePrefix + "BatteryVolts", 12), 13000);
assert.equal(buffer.flush()[0].value, 12, "A new connection can still use a legacy robot");
console.log("Complete data-object checks passed: atomic replacement, removed fields, latest frame, typed pose, freshness, malformed frames and legacy reset.");

if (process.argv.includes("--java-fixture")) {
  buffer.replace([]);
  const value = readFileSync(new URL("../../build/library-checks/telemetry-frame.json", import.meta.url), "utf8");
  buffer.upsert({ name: "/PowerLib/Data", type: "json", value }, 14000);
  const decoded = buffer.flush();
  assert.ok(decoded, "The dashboard must accept the Java-produced frame");
  const pose = decoded.find(topic => topic.name.endsWith("Vision/Data/EstimatedPose"));
  assert.equal(pose.type, "struct:Pose2d");
  assert.equal(new DataView(pose.value).getFloat64(0, true), 4);
  assert.equal(decoded.find(topic => topic.name.endsWith("BatteryVolts")).value, 12);
  console.log("Java-to-dashboard telemetry contract fixture passed.");
}
