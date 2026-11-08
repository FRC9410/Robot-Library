import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const load = async entry => {
  const bundled = await build({ entryPoints: [fileURLToPath(new URL(entry, import.meta.url))], bundle: true,
    write: false, format: "esm", platform: "node" });
  return import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].contents).toString("base64")}`);
};
const { validateUploadedField } = await load("../electron/uploadedField.ts");
const { readUploadedField, saveUploadedField, removeUploadedField } = await load("../electron/uploadedFieldFiles.ts");
const field = { version: 1, label: "Practice field", length: 12, width: 6,
  image: { href: "data:image/png;base64,aGVsbG8=", pixelWidth: 200, pixelHeight: 100, rotate180: false } };
assert.equal(validateUploadedField({ ...field, label: "  Practice field  " }).label, field.label);
for (const invalid of [null, [], { ...field, version: 2 }, { ...field, label: " " }, { ...field, label: "x".repeat(81) },
  ...[0, -1, Infinity, NaN, "12"].flatMap(value => [{ ...field, length: value }, { ...field, width: value }]),
  ...[0, 1.5, 20000].map(pixelWidth => ({ ...field, image: { ...field.image, pixelWidth } })),
  { ...field, image: { ...field.image, pixelWidth: 16000, pixelHeight: 16000 } },
  { ...field, image: { ...field.image, rotate180: "false" } },
  ...["file:///private.png", "https://host/image.png", "data:image/svg+xml;base64,PHN2Zz4=", "data:image/png;base64,%%%"]
    .map(href => ({ ...field, image: { ...field.image, href } }))]) {
  assert.throws(() => validateUploadedField(invalid));
}
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-field-upload-check-"));
try {
  assert.equal(await readUploadedField(fixture), null);
  await saveUploadedField(fixture, field);
  assert.deepEqual(await readUploadedField(fixture), field, "Image bytes and dimensions survive a fresh read");
  assert.throws(() => saveUploadedField(fixture, { ...field, length: 0 }));
  assert.deepEqual(await readUploadedField(fixture), field, "Invalid replacements preserve the old field");
  await Promise.all([saveUploadedField(fixture, { ...field, label: "First" }), saveUploadedField(fixture, { ...field, label: "Second" })]);
  assert.equal((await readUploadedField(fixture)).label, "Second", "Concurrent replacements are serialized");
  assert.deepEqual(await fs.readdir(fixture), ["uploaded-field.json"], "No temporary files remain");
  await fs.writeFile(path.join(fixture, "uploaded-field.json"), "broken JSON");
  await assert.rejects(() => readUploadedField(fixture), /Could not load/);
  assert.equal(await fs.readFile(path.join(fixture, "uploaded-field.json"), "utf8"), "broken JSON", "Reading never replaces corrupt data");
  await saveUploadedField(fixture, field);
  const blocked = path.join(fixture, "not-a-directory");
  await fs.writeFile(blocked, "occupied");
  await assert.rejects(() => saveUploadedField(blocked, field));
  assert.deepEqual(await readUploadedField(fixture), field);
  await removeUploadedField(fixture);
  assert.equal(await readUploadedField(fixture), null);
  await removeUploadedField(fixture);
} finally {
  if (path.dirname(path.resolve(fixture)) !== path.resolve(os.tmpdir()) || !path.basename(fixture).startsWith("power-tool-field-upload-check-"))
    throw Error("Refusing unexpected fixture cleanup path");
  await fs.rm(fixture, { recursive: true, force: true });
}
console.log("Field upload checks passed: validation, persistence, serialized replacement, failed writes, corruption, and removal.");
