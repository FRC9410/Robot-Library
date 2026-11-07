import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const project = fileURLToPath(new URL("..", import.meta.url));
const result = await build({ stdin: { contents: `
  export {readLocalizationConfig,saveLocalizationConfig} from './electron/localizationFiles.ts';
  export {readSubsystemDocument,saveSubsystemDocument} from './electron/subsystemFiles.ts';
  export {saveVisionConfig} from './electron/visionFiles.ts';
  export {saveStateConfig} from './electron/stateFiles.ts';
  export {readConstantsFiles,saveConstantsFile} from './electron/constantsFiles.ts';
`, resolveDir: project }, bundle: true, write: false, format: "esm", platform: "node" });
const { readLocalizationConfig, saveLocalizationConfig, readSubsystemDocument, saveSubsystemDocument, saveVisionConfig, saveStateConfig, readConstantsFiles, saveConstantsFile } =
  await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-localization-"));
try {
  const initial = await readLocalizationConfig(fixture);
  assert.deepEqual(initial.config.heading, { maxTagDistanceMeters: 4, singleTagMaxDistanceMeters: 2 });
  const config = { position: { targetAreaThreshold: 1, maxTargetDistanceMeters: 5 }, heading: { maxTagDistanceMeters: 5, singleTagMaxDistanceMeters: 3 } };
  const vision = { fovDegrees: 60, imageWidth: 320, imageHeight: 240, limelights: [{ name: "limelight-front" }] };
  await fs.writeFile(initial.path, JSON.stringify({ sentinel: "preserved" }));
  await Promise.all([
    saveLocalizationConfig(fixture, config), saveSubsystemDocument(fixture, [{ name: "Intake" }], { heading: { kP: 7 } }),
    saveVisionConfig(fixture, vision), saveStateConfig(fixture, { states: ["IDLE", "READY"] })
  ]);
  assert.deepEqual(JSON.parse(await fs.readFile(initial.path, "utf8")), {
    sentinel: "preserved", localization: config, subsystems: [{ name: "Intake" }], swerve: { heading: { kP: 7 } }, vision, states: ["IDLE", "READY"]
  }, "Concurrent section saves preserve every section");
  assert.deepEqual((await readLocalizationConfig(fixture)).config, config);
  const constantsDirectory = path.join(fixture, "src/main/java/frc/robot/constants");
  await fs.mkdir(constantsDirectory, { recursive: true });
  await fs.writeFile(path.join(constantsDirectory, "VisionConstants.java"), `package frc.robot.constants;
public class VisionConstants {
  public static final double HEADING_MAX_TAG_DISTANCE_METERS = 4.0;
  // POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE
  @frc.powerlib.tuning.TunableConstant
  public static volatile double CUSTOM_GAIN = 1.0;
  // POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE
}`);
  await fs.writeFile(path.join(path.dirname(initial.path), "powerlib-constants.json"), JSON.stringify({ version: 1, files: { "robot:Vision": { constants: [
    { name: "HEADING_MAX_TAG_DISTANCE_METERS", type: "double", value: "99", custom: false, tunable: true },
    { name: "CUSTOM_GAIN", type: "double", value: "1.0", custom: true, tunable: true }
  ] } } }));
  const constantsFile = (await readConstantsFiles(fixture)).find(file => file.id === "robot:Vision");
  assert.equal(constantsFile.error, undefined);
  assert.ok(constantsFile.source.includes("HEADING_MAX_TAG_DISTANCE_METERS = 4.0"), "Stale custom-constants JSON cannot override localization defaults");
  assert.ok(constantsFile.constants.every(row => row.name !== "HEADING_MAX_TAG_DISTANCE_METERS"));
  await saveConstantsFile(fixture, constantsFile.id, constantsFile.source, constantsFile.constants.map(row => ({ ...row, value: "2.0" })));
  assert.deepEqual((await readLocalizationConfig(fixture)).config, config, "Saving a custom constant preserves localization JSON");
  const constantsJson = JSON.parse(await fs.readFile(path.join(path.dirname(initial.path), "powerlib-constants.json"), "utf8"));
  assert.ok(constantsJson.files["robot:Vision"].constants.every(row => row.name !== "HEADING_MAX_TAG_DISTANCE_METERS"), "Native localization values have only one JSON source of truth");
  for (const distance of [0, -1, NaN, Infinity]) {
    await assert.rejects(saveLocalizationConfig(fixture, { ...config, heading: { ...config.heading, maxTagDistanceMeters: distance } }));
    await assert.rejects(saveLocalizationConfig(fixture, { ...config, heading: { ...config.heading, singleTagMaxDistanceMeters: distance } }));
  }
  for (const broken of ["{broken", "null", "[]"]) {
    await fs.writeFile(initial.path, broken);
    await assert.rejects(saveSubsystemDocument(fixture, []));
    await assert.rejects(saveLocalizationConfig(fixture, config));
    await assert.rejects(saveStateConfig(fixture, { states: ["IDLE"] }));
    await assert.rejects(saveVisionConfig(fixture, vision));
    assert.equal(await fs.readFile(initial.path, "utf8"), broken, "Invalid JSON must not be replaced by an empty document");
  }
  await fs.writeFile(initial.path, '{}');
  await saveLocalizationConfig(fixture, config);
  assert.deepEqual((await readSubsystemDocument(fixture)).subsystems, [], "A failed save does not poison the save queue");
  assert.deepEqual((await readLocalizationConfig(fixture)).config, config);
  console.log("Localization persistence checks passed: defaults, typed distance validation, concurrent section saves, preservation and corrupt JSON rejection.");
} finally {
  if (path.dirname(fixture) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith("power-tool-localization-")) await fs.rm(fixture, { recursive: true, force: true });
}
