import fs from "node:fs/promises";
import path from "node:path";
import { readRobotDocument, updateRobotDocument } from "./robotDocument.js";
import { defaultLimelightSettings, normalizeVisionConfig, validateVisionConfig, type VisionConfig } from "./visionConfig.js";

export async function readVisionConfig(robotRoot: string) {
  const { path: file, document } = await readRobotDocument(robotRoot);
  if (document.vision !== undefined) {
    return { path: file, vision: normalizeVisionConfig(document.vision) };
  }
  // Import camera names from an existing robot until Vision is first configured.
  let source = "";
  try { source = await fs.readFile(path.join(robotRoot, "src/main/java/frc/robot/constants/VisionConstants.java"), "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  const primary = source.match(/\bString\s+LIMELIGHT_NAME\s*=\s*"([^"]+)"/)?.[1];
  const namesBlock = source.match(/\bLIMELIGHT_NAMES\s*=\s*\{([^}]*?)\}/s)?.[1];
  const names = namesBlock === undefined ? (primary ? [primary] : []) : namesBlock.split(",").map(token => {
    const value = token.replace(/\/\/[^\n]*/g, "").trim();
    if (!value) return "";
    if (value === "LIMELIGHT_NAME" && primary) return primary;
    const literal = /^"([^"]+)"$/.exec(value);
    if (!literal) throw Error("Camera names use Java expressions. Set literal Limelight names before editing Vision config.");
    return literal[1];
  }).filter(Boolean);
  const scalar = (names: string[], fallback: number) => {
    const literal = source.match(new RegExp(`\\b(?:${names.join("|")})\\s*=\\s*([+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?)\\s*;`))?.[1];
    return literal === undefined ? fallback : Number(literal);
  };
  const settings = {
    fovDegrees: scalar(["LIMELIGHT_FOV_DEGREES", "CAMERA_FOV_DEGREES"], defaultLimelightSettings.fovDegrees),
    imageWidth: scalar(["LIMELIGHT_IMAGE_WIDTH", "IMAGE_WIDTH"], defaultLimelightSettings.imageWidth),
    imageHeight: scalar(["LIMELIGHT_IMAGE_HEIGHT", "IMAGE_HEIGHT"], defaultLimelightSettings.imageHeight)
  };
  validateVisionConfig({ ...settings, limelights: [] });
  return { path: file, vision: { ...settings, limelights: names.map(name => ({ name })) } };
}

export async function saveVisionConfig(robotRoot: string, vision: VisionConfig) {
  vision = normalizeVisionConfig(vision);
  const result = await updateRobotDocument(robotRoot, document => ({ ...document, vision }));
  return { path: result.path, vision };
}
