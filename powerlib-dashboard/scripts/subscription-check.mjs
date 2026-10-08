import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const load = async path => {
  const result = await build({ entryPoints: [fileURLToPath(new URL(path, import.meta.url))], bundle: true, write: false, format: "cjs", platform: "node" });
  const module = { exports: {} };
  new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
  return module.exports;
};
const { TopicViews } = await load("../src/networktables/TopicViews.ts");
const views = new TopicViews();
const drive = { name: "/PowerLib/Subsystems/Drive/Data/Heartbeat", type: "double", value: 1 };
const tuning = { name: "/PowerLib/Subsystems/Hood/Variables/PID/kP", type: "double", value: 2 };
const camera = { name: "/limelight/hb", type: "double", value: 1 };
views.replace([drive, tuning, camera]);
const oldTuning = views.get("tuning"), oldApp = views.get("app");
views.replace([{ ...drive, value: 2 }, tuning, { ...camera, value: 2 }]);
assert.equal(views.get("tuning"), oldTuning, "Drive traffic must not rerender tuning");
assert.equal(views.get("app"), oldApp, "Heartbeat/camera traffic must not rerender the app shell");
views.replace([drive, { ...tuning, value: 3 }, camera]);
assert.notEqual(views.get("tuning"), oldTuning);
views.replace([]); assert.equal(views.get("drive").length, 0);

const { PowerLibNt4Client } = await load("../src/networktables/nt4Client.ts");
const { tuningUpdateIntervalMs } = await load("../src/networktables/telemetryTiming.ts");
const client = new PowerLibNt4Client();
const prefixes = new Map(); let nextId = 0;
const socket = new EventTarget(); socket.websocket = socket;
const fakeTopic = name => ({ name, subscribers: new Map(),
  subscribe(callback, options) { const id = ++nextId; this.subscribers.set(id, { callback, options }); return id; },
  unsubscribe(id) { this.subscribers.delete(id); }
});
client.nt = { client: { messenger: { socket }, getPrefixTopicFromName: name => prefixes.get(name) },
  createPrefixTopic(name) { const topic = fakeTopic(name); prefixes.set(name, topic); return topic; },
  createTopic(name) { const topic = fakeTopic(name); topic.getValue = () => 0; return topic; },
  addRobotConnectionListener() { return () => {}; }
};
client.watchPrefix("/PowerLib/", () => {}, tuningUpdateIntervalMs);
client.watchPrefix("/PowerLib/Data", () => {});
assert.equal([...prefixes.get("/PowerLib/").subscribers.values()][0].options.periodic, 0.2);
assert.equal([...prefixes.get("/PowerLib/Data").subscribers.values()][0].options.periodic, 0.1);
client.subscribe(tuning.name, "double", 0, () => {});
assert.equal([...client.topics.get(tuning.name).subscribers.values()][0].options.periodic, 0.2);
client.watchCameraAnnouncements(() => {});
assert.equal([...prefixes.get("/").subscribers.values()][0].options.topicsonly, true);
assert.equal(client.isWatchedValue("/Unrelated/Value"), false);
const stopRaw = client.watchPrefix("/", () => {});
assert.equal(client.isWatchedValue("/Unrelated/Value"), true);
stopRaw(); assert.equal(client.isWatchedValue("/Unrelated/Value"), false);
assert.equal(prefixes.get("/").subscribers.size, 1, "Closing explorer must retain metadata discovery");
socket.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(["tv", "tx", "ty"].map(key => ({ method: "announce", params: { name: `/custom-camera/${key}` } }))) }));
assert.ok(prefixes.has("/custom-camera/"), "Custom-named cameras must still be discovered");
console.log("Scoped subscriptions, explorer cleanup, custom camera discovery and stable topic views passed.");
