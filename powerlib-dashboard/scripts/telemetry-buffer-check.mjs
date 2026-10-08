import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

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
