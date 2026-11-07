import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const result = await build({ entryPoints: [fileURLToPath(new URL("../electron/visionFiles.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const { readVisionConfig, saveVisionConfig } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-vision-config-"));
try {
  const constants = path.join(fixture, "src/main/java/frc/robot/constants");
  await fs.mkdir(constants, { recursive: true });
  await fs.writeFile(path.join(constants, "VisionConstants.java"), 'public class VisionConstants { public static final String LIMELIGHT_NAME = "limelight-left"; public static final String[] LIMELIGHT_NAMES = {LIMELIGHT_NAME, "limelight-right"}; public static volatile double CAMERA_FOV_DEGREES = 70; public static volatile int IMAGE_WIDTH = 640; public static volatile int IMAGE_HEIGHT = 480; }');
  const initial = await readVisionConfig(fixture);
  assert.deepEqual(initial.vision.limelights.map(camera => camera.name), ["limelight-left", "limelight-right"]);
  assert.equal(initial.vision.fovDegrees, 70, "Existing shared Java FOV is imported");
  assert.equal(initial.vision.imageWidth, 640);
  assert.equal(initial.vision.imageHeight, 480);
  const otherSections = { subsystems: [{ name: "Intake" }], swerve: { heading: { kP: 7 } }, custom: { retained: true } };
  await fs.writeFile(initial.path, JSON.stringify(otherSections));
  const camera = { name: "limelight-front" };
  const settings = { fovDegrees: 63.3, imageWidth: 640, imageHeight: 480 };
  const config = { ...settings, limelights: [camera] };
  await saveVisionConfig(fixture, config);
  assert.deepEqual((await readVisionConfig(fixture)).vision, config);
  assert.deepEqual(JSON.parse(await fs.readFile(initial.path, "utf8")), { ...otherSections, vision: config });
  for (const name of ["front", "limelight-", "limelight-Front", "limelight-front/camera", "limelight-front camera", "limelight-front--camera"]) {
    await assert.rejects(saveVisionConfig(fixture, { ...settings, limelights: [{ name }] }));
  }
  for (const patch of [{ fovDegrees: 0 }, { fovDegrees: 180 }, { fovDegrees: Infinity }, { imageWidth: 0 }, { imageHeight: 2.5 }, { imageWidth: 2147483648 }]) {
    await assert.rejects(saveVisionConfig(fixture, { ...config, ...patch }));
  }
  await assert.rejects(saveVisionConfig(fixture, { ...settings, limelights: [camera, camera] }));
  assert.deepEqual((await readVisionConfig(fixture)).vision.limelights, [camera], "Rejected edits preserve the previous configuration");
  const legacy = { limelights: [{ ...camera, ...settings }, { name: "limelight-back", fovDegrees: 60, imageWidth: 320, imageHeight: 240 }] };
  await fs.writeFile(initial.path, JSON.stringify({ ...otherSections, vision: legacy }));
  const migrated = (await readVisionConfig(fixture)).vision;
  assert.deepEqual(migrated, { ...settings, limelights: [camera, { name: "limelight-back" }] }, "The first legacy camera supplies shared values");
  assert.deepEqual(JSON.parse(await fs.readFile(initial.path, "utf8")).vision, legacy, "Reading migration does not rewrite the project");
  await saveVisionConfig(fixture, migrated);
  assert.deepEqual(JSON.parse(await fs.readFile(initial.path, "utf8")).vision, migrated, "Saving strips per-camera settings");
  await saveVisionConfig(fixture, { ...settings, imageWidth: 1280, limelights: migrated.limelights });
  assert.equal((await readVisionConfig(fixture)).vision.imageWidth, 1280);
  assert.deepEqual((await readVisionConfig(fixture)).vision.limelights, migrated.limelights, "Global edits preserve all camera names");
  await saveVisionConfig(fixture, { ...settings, limelights: [] });
  assert.deepEqual((await readVisionConfig(fixture)).vision.limelights, [], "Deleting the last camera persists an empty list");
  assert.equal((await readVisionConfig(fixture)).vision.fovDegrees, 63.3, "Deleting the last camera retains global values");
  await fs.writeFile(initial.path, "{broken");
  await assert.rejects(saveVisionConfig(fixture, config));
  assert.equal(await fs.readFile(initial.path, "utf8"), "{broken", "Corrupt documents must not be overwritten");
  console.log("Vision config checks passed: global settings, legacy migration, project persistence, unrelated settings preservation, names, duplicates, dimensions, empty lists and failed saves.");
} finally {
  if (path.dirname(fixture) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith("power-tool-vision-config-")) await fs.rm(fixture, { recursive: true, force: true });
}
