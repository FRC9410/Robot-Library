// Checks the shared page settings file (electron/rendererSettings.ts) that lets the dev server and
// the built app remember the same field layout, connection settings and so on.
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const load = async (relative) => {
  const result = await build({ entryPoints: [fileURLToPath(new URL(relative, import.meta.url))], bundle: true, write: false,
    format: "esm", platform: "node", packages: "external" });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
};
const settings = await load("../electron/rendererSettings.ts");

const folder = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-settings-"));
const file = path.join(folder, "nested", settings.rendererSettingsFileName);
try {
  // Only "powerlib." keys with string values are kept.
  assert.deepEqual(settings.cleanRendererSettings({ "powerlib.fieldLayout.v1": "2026-rebuilt", other: "x", "powerlib.bad": 3 }),
    { "powerlib.fieldLayout.v1": "2026-rebuilt" });
  assert.deepEqual(settings.cleanRendererSettings(null), {});
  assert.deepEqual(settings.cleanRendererSettings(["powerlib.a"]), {});

  // No file yet, or an unreadable one, reads as null so the page joins instead of being wiped.
  assert.equal(settings.readRendererSettings(file), null);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, "{ not json");
  assert.equal(settings.readRendererSettings(file), null, "A broken file is treated as missing");
  await fs.rm(path.dirname(file), { recursive: true });

  // The first origin to join seeds the file with its own settings, creating the folder.
  const dev = { "powerlib.fieldLayout.v1": "2026-rebuilt-simplified", "powerlib.connectionSettings": "{\"team\":9410}" };
  assert.deepEqual(settings.joinRendererSettings(file, dev), dev);
  assert.deepEqual(settings.readRendererSettings(file), dev);
  assert.deepEqual((await fs.readdir(path.dirname(file))).sort(), [settings.rendererSettingsFileName], "No temporary file is left behind");

  // A second origin adds what only it has; where both have a value, the file's wins.
  const built = { "powerlib.connectionSettings": "{\"team\":1}", "powerlib.autoBuilder.columns.v1": "{\"left\":240}" };
  const joined = settings.joinRendererSettings(file, built);
  assert.equal(joined["powerlib.fieldLayout.v1"], "2026-rebuilt-simplified", "The built app picks up the field chosen in dev");
  assert.equal(joined["powerlib.connectionSettings"], "{\"team\":9410}", "The file's value wins");
  assert.equal(joined["powerlib.autoBuilder.columns.v1"], "{\"left\":240}", "Settings only the newcomer has are kept");
  assert.deepEqual(settings.readRendererSettings(file), joined);

  // After joining, a write replaces the file, so removed settings stay removed.
  settings.writeRendererSettings(file, { "powerlib.fieldLayout.v1": "none" });
  assert.deepEqual(settings.readRendererSettings(file), { "powerlib.fieldLayout.v1": "none" });
} finally {
  await fs.rm(folder, { recursive: true, force: true });
}

console.log("Shared settings checks passed: filtering, missing and broken files, first join, merging and replacing.");
