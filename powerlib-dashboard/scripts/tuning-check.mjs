import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const load = async path => {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true,
    write: false, format: "cjs", platform: "node" });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
};
const { TuningModeSync } = await load("../src/networktables/TuningModeSync.ts");
const { tuningUpdateIntervalMs, telemetryUpdateIntervalMs } = await load("../src/networktables/telemetryTiming.ts");
assert.equal(tuningUpdateIntervalMs, 200);
assert.equal(telemetryUpdateIntervalMs, 100);

const writes = [];
const sync = new TuningModeSync(async value => { writes.push(value); }, error => assert.fail(error));
sync.request(true);
await sync.sync(0, false, false);
assert.deepEqual(writes, [], "Disconnected dashboards must not publish");
sync.connectionChanged(true);
await sync.sync(0, false, false);
await sync.sync(100, true, false);
assert.deepEqual(writes, [true], "Reconciliation must run at most once per 200 ms");
await sync.sync(200, true, false);
assert.deepEqual(writes, [true, true], "Matching requested state alone is not robot acknowledgement");
await sync.sync(400, true, true);
assert.deepEqual(writes, [true, true], "Matching request and acknowledgement must stop repeated writes");
sync.connectionChanged(false);
await sync.sync(600, false, false);
sync.connectionChanged(true);
await sync.sync(800, false, false);
assert.deepEqual(writes, [true, true, true], "A robot reboot must recover tuning without toggling");
await sync.sync(1000, true, true);
sync.connectionChanged(false); sync.connectionChanged(true);
await sync.sync(1200, true, true);
assert.equal(writes.length, 4, "Reconnect must republish even when cached observations match");
sync.request(false); await sync.sync(1400, true, true);
assert.equal(writes.at(-1), false, "Turning tuning off must reconcile too");
sync.reset(); await sync.sync(1600, false, false);
assert.equal(sync.desired, false, "Changing robot targets must discard the previous switch intent");

const errors = [];
let fail = true;
const retry = new TuningModeSync(async () => { if (fail) throw new Error("not announced"); }, error => errors.push(error));
retry.connectionChanged(true); retry.request(true);
await retry.sync(0, false, false); await retry.sync(200, false, false);
assert.deepEqual(errors, ["not announced"], "Repeated publication failure must not spam notifications");
fail = false; await retry.sync(400, false, false); await retry.sync(600, true, true);
assert.equal(retry.desired, true, "A failed write must retain the requested mode for retry");

let finish;
const delayedWrites = [];
const delayed = new TuningModeSync(value => {
  delayedWrites.push(value);
  return new Promise(resolve => { finish = resolve; });
}, error => assert.fail(error));
delayed.connectionChanged(true); delayed.request(true);
const first = delayed.sync(0, false, false);
delayed.request(false); await delayed.sync(200, false, false);
assert.deepEqual(delayedWrites, [true], "An unfinished publication must not spawn duplicates");
finish(); await first;
const latest = delayed.sync(400, true, true);
assert.deepEqual(delayedWrites, [true, false], "A newer switch choice must survive an old publication completing");
finish(); await latest;

const { TopicViews } = await load("../src/networktables/TopicViews.ts");
const views = new TopicViews();
const gain = { name: "/PowerLib/Subsystems/Hood/Variables/PID/kP", type: "double", value: 1 };
views.replace([gain]);
const previous = views.get("tuning");
views.replace([{ ...gain, value: 2 }], false);
assert.equal(views.get("tuning"), previous, "A telemetry refresh must not refresh tuning early");
views.replace([{ ...gain, value: 3 }], false); views.refreshTuning();
assert.equal(views.get("tuning")[0].value, 3, "The next tuning refresh must show the latest value");
const current = views.get("tuning"); views.refreshTuning();
assert.equal(views.get("tuning"), current, "Unchanged tuning must retain a stable React snapshot");

const { PowerLibNt4Client } = await load("../src/networktables/nt4Client.ts");
globalThis.window = { setTimeout };
const client = new PowerLibNt4Client();
const serverWrites = [];
let publications = 0;
const topic = {
  publisher: true, pubuid: 1,
  unpublish() { this.publisher = false; this.pubuid = undefined; },
  async publish() { this.publisher = true; this.pubuid = ++publications; },
  setValue(value) { serverWrites.push(value); }
};
const requestTopic = "/PowerLib/Tuning/RequestedEnabled";
client.nt = {}; client.topics.set(requestTopic, topic); client.connectionRevision = 1;
await client.publish(requestTopic, "boolean", true);
client.connectionRevision = 2;
await client.publish(requestTopic, "boolean", true);
assert.deepEqual(serverWrites, [true, true], "An unchanged mode must actually be sent to the restarted server");
assert.equal(publications, 2, "A new connection must renew a stale publication");
topic.publisher = false;
let acknowledge;
topic.publish = () => new Promise(resolve => { acknowledge = () => { topic.publisher = true; resolve(); }; });
const staleWrite = client.publish(requestTopic, "boolean", false);
client.connectionRevision++;
acknowledge();
await assert.rejects(staleWrite, /connection changed/);
assert.deepEqual(serverWrites, [true, true], "An old connection's completion must not write a stale mode");
console.log("5 Hz tuning, acknowledgement reconciliation, reboot recovery, retries and latest tuning snapshots passed.");
