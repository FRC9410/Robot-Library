import fs from "node:fs/promises";
import path from "node:path";
import { readRobotDocument, updateRobotDocument } from "./robotDocument.js";
import { defaultLocalizationConfig, validateLocalizationConfig, type LocalizationConfig } from "./localizationConfig.js";

export async function readLocalizationConfig(robotRoot: string) {
  const current = await readRobotDocument(robotRoot);
  let config = current.document.localization;
  if (config === undefined) {
    let source = "";
    try { source = await fs.readFile(path.join(robotRoot, "src/main/java/frc/robot/constants/VisionConstants.java"), "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const scalar = (name: string, fallback: number) => {
      const literal = source.match(new RegExp(`\\b${name}\\s*=\\s*([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)\\s*;`))?.[1];
      return literal === undefined ? fallback : Number(literal);
    };
    config = {
      position: { targetAreaThreshold: scalar("POSITION_TARGET_AREA_THRESHOLD", defaultLocalizationConfig.position.targetAreaThreshold),
        maxTargetDistanceMeters: scalar("POSITION_MAX_TARGET_DISTANCE_METERS", defaultLocalizationConfig.position.maxTargetDistanceMeters) },
      heading: { maxTagDistanceMeters: scalar("HEADING_MAX_TAG_DISTANCE_METERS", defaultLocalizationConfig.heading.maxTagDistanceMeters),
        singleTagMaxDistanceMeters: scalar("HEADING_SINGLE_TAG_MAX_DISTANCE_METERS", defaultLocalizationConfig.heading.singleTagMaxDistanceMeters) }
    };
  }
  validateLocalizationConfig(config);
  return { path: current.path, config };
}

export async function saveLocalizationConfig(robotRoot: string, config: LocalizationConfig) {
  validateLocalizationConfig(config);
  const result = await updateRobotDocument(robotRoot, document => ({ ...document, localization: config }));
  return { path: result.path, config };
}
