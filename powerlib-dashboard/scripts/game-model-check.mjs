import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
async function load(relative) {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
}
const { gameModel, gameTemplate, validGameConfig, gamePrefix } = await load("../src/features/game/gameModel.ts");
const { gamePreviewTopics } = await load("../src/features/game/gamePreview.ts");
const topics = gamePreviewTopics(5000);
let model = gameModel(topics, true, 5100);
assert.equal(model.live, true);
assert.equal(model.bool("VelocityReady"), false);
assert.equal(model.bool("HoodReady"), true);
assert.equal(model.bool("HubActive"), undefined, "Unknown hub activation must not become a fabricated green status");
assert.equal(model.mechanisms[2].value, -.4, "Keep signed rotation units despite historical degrees label");
assert.equal(model.mechanisms[2].unit, "rot");
for (const [connected, now] of [[false, 5100], [true, 6500]]) {
  model = gameModel(topics, connected, now);
  assert.equal(model.live, false);
  assert.equal(model.bool("FeedReady"), undefined);
  assert.equal(model.mechanisms[1].value, undefined);
}
model = gameModel(topics.filter(t => t.name !== gamePrefix + "Heartbeat"), true, 5100);
assert.equal(model.live, false, "Drive heartbeat alone must not validate old game data");
const invalid = topics.map(t => t.name.endsWith("Shooter/Data/Velocity") ? { ...t, value: NaN } : t);
assert.equal(gameModel(invalid, true, 5100).mechanisms[0].value, undefined);
assert.equal(validGameConfig(gameTemplate), true);
for (const value of [null, {}, { ...gameTemplate, field: { ...gameTemplate.field, length: -1 } },
  { ...gameTemplate, autos: { ...gameTemplate.autos, "Blue Left": [[NaN, 2, 0]] } }]) assert.equal(validGameConfig(value), false);
console.log("Game model checks passed: independent readiness, unknown hub, signed units, disconnect/stale heartbeat, missing game data, invalid values, route validation.");
