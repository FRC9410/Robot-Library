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
assert.equal(views.get("robot").length, 0, "Robot telemetry must not bypass the 5 Hz tuning snapshot");

const { createRobotCards, createTuningValues, groupTunables, parseTuningValue } = await load("../src/features/robot/robotModel.ts");
const { parseDraftValue } = await load("../src/features/networktables/tuningUtils.ts");
assert.throws(() => parseDraftValue("double", " "), /Enter a number/, "Clearing a numeric input must not silently send zero");
const variable = (owner, key, value = 1, scope = "Subsystems", type = "double") =>
  ({ name: `/PowerLib/${scope}/${owner}/Variables/${key}`, type, value });
const file = (name, kind = "robot") => ({ id: `${kind}:${name}`, name, kind, constants: [], source: "", path: "", exists: true });
const hoodFile = file("Hood", "subsystem");
const discovered = [variable("Hood", "PID/kP"), variable("Hood", "Custom/READY_TOLERANCE"),
  variable("Hood", "Other/kP"), variable("Shooting", "Custom/DISTANCE"), variable("Swerve", "Heading/kP"),
  variable("Hood", "Speed", 2, "Commands"), variable("Ignored", "Array", [1], "Subsystems", "double[]")];
const cards = createRobotCards([{ id: "hood", name: "Hood", type: "absolutePosition" }], [
  { name: "/PowerLib/Subsystems/Hood/Data/Position", type: "double", value: 0.1 },
  { name: "/PowerLib/Subsystems/Hood/Data/Connected", type: "boolean", value: true },
  { name: "/PowerLib/Subsystems/Drive/Data/Pose/XMeters", type: "double", value: 2 }
], discovered, [file("OI"), hoodFile, file("Swerve"), file("Shooting")]);
assert.deepEqual(cards.map(card => card.key), ["subsystem:Hood", "subsystem:Swerve", "command:Hood", "subsystem:OI", "subsystem:Shooting"],
  "Mechanisms must lead, each non-subsystem group must follow once, and command owners must stay distinct");
assert.equal(cards[0].constantsFile, hoodFile, "Subsystem constants must attach to their existing card");
assert.equal(cards[0].metrics.length, 1, "Removed health fields must stay hidden");
assert.equal(cards[0].tunableCount, 3, "A card must expose every writable variable without a saved selection");
assert.equal(cards[1].tunableCount, 1, "Drive telemetry and Swerve tunables must share the drivetrain card");
assert.equal(cards[1].constantsFile.id, "robot:Swerve");
assert.equal(groupTunables(discovered).get("subsystem:Hood").length, 3);
assert.ok(!cards.some(card => card.owner === "Ignored"), "Unsupported variables must not create empty live groups");
const offlineCards = createRobotCards([{ name: "Hood" }], [], [], [hoodFile, file("Shooting")]);
assert.deepEqual(offlineCards.map(card => card.key), ["subsystem:Hood", "subsystem:Shooting"], "Project cards must remain available while disconnected");
console.log("Robot card merging, complete per-group tunables, offline constants and numeric validation passed.");

const shootingFile = { ...file("Shooting"), constants: [
  { originalName: "DISTANCE", name: "DISTANCE", type: "double", value: "3.5", custom: false, tunable: true },
  { originalName: "ENABLED", name: "ENABLED", type: "boolean", value: "true", custom: false, tunable: false },
  { originalName: "LABEL", name: "LABEL", type: "String", value: '"Hub"', custom: true, tunable: false },
  { originalName: "COUNT", name: "COUNT", type: "int", value: "2", custom: true, tunable: true }
] };
const liveConstants = [variable("Shooting", "Custom/DISTANCE", 4.1), variable("Shooting", "Custom/COUNT", 2)];
const merged = createTuningValues(liveConstants, shootingFile);
assert.equal(merged.length, 4, "Live constants must appear once alongside saved-only values in the same list");
const distance = merged.find(value => value.constant.name === "DISTANCE");
assert.equal(distance.baseline, "4.1", "A published value must override the saved default");
assert.equal(parseTuningValue(distance, "4.5").live, 4.5);
assert.equal(parseTuningValue(merged.find(value => value.constant.name === "LABEL"), 'Hub "left"').saved, '"Hub \\"left\\""');
assert.equal(parseTuningValue(merged.find(value => value.constant.name === "ENABLED"), "false").saved, "false");
assert.throws(() => parseTuningValue(merged.find(value => value.constant.name === "COUNT"), "2.5"), /whole-number/);
assert.equal(createTuningValues([], shootingFile).find(value => value.constant.name === "DISTANCE").id, distance.id,
  "Connecting must keep an existing constant edit associated with the same row");
const swerveFile = { ...file("Swerve"), constants: [{ originalName: "HEADING_KP", name: "HEADING_KP", type: "double", value: "6.5", custom: false, tunable: true }] };
assert.equal(createTuningValues([variable("Swerve", "Heading/kP", 7)], swerveFile).length, 1,
  "Native drivetrain constants and their live variables must share one row");
console.log("Inline constants, live-value deduplication, reconnect identity and Java type validation passed.");

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
