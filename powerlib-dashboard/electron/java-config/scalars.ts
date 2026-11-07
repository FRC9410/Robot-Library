import { constantsDirectory, digest, type SourceProject } from "./project.js";
import { SourceValues, patchValues } from "./values.js";
import { boundExpression, closing, javaFields, literalValue, maskJava, splitExpressions, type Span } from "./source.js";
import type { GeneratedSwerveConstants } from "./configTypes.js";
import { validateVisionConfig, type VisionConfig } from "../visionConfig.js";
import { validateLocalizationConfig, type LocalizationConfig } from "../localizationConfig.js";

export const swervePaths: Record<string, [keyof GeneratedSwerveConstants, string]> = {
  DRIVER_MAX_SPEED_COEFFICIENT: ["driver", "maxSpeedCoefficient"], DRIVER_VELOCITY_SCALE: ["driver", "velocityScale"],
  DRIVER_MAX_ANGULAR_RATE_RADIANS_PER_SECOND: ["driver", "maxAngularRateRadiansPerSecond"], DRIVER_JOYSTICK_DEADBAND: ["driver", "joystickDeadband"], DRIVER_SKEW_COMPENSATION: ["driver", "skewCompensation"],
  REQUEST_MAX_ANGULAR_RATE_RADIANS_PER_SECOND: ["requests", "maxAngularRateRadiansPerSecond"], REQUEST_TRANSLATION_DEADBAND_METERS_PER_SECOND: ["requests", "translationDeadbandMetersPerSecond"], REQUEST_ROTATIONAL_DEADBAND_RADIANS_PER_SECOND: ["requests", "rotationalDeadbandRadiansPerSecond"],
  DRIVE_TO_POINT_MAX_ANGULAR_RATE_RADIANS_PER_SECOND: ["driveToPoint", "maxAngularRateRadiansPerSecond"], DRIVE_TO_POINT_MAX_SPEED_COEFFICIENT: ["driveToPoint", "maxSpeedCoefficient"], DRIVE_TO_POINT_SLOW_SPEED_COEFFICIENT: ["driveToPoint", "slowSpeedCoefficient"], DRIVE_TO_POINT_STATIC_FRICTION_CONSTANT: ["driveToPoint", "staticFrictionConstant"],
  HEADING_KP: ["heading", "kP"], HEADING_KI: ["heading", "kI"], HEADING_KD: ["heading", "kD"]
};

export async function readSwerve(project: SourceProject) {
  const source = await project.read(`${constantsDirectory}/SwerveConstants.java`);
  const table = new SourceValues(source);
  const result: Record<string, Record<string, number>> = {};
  const diagnostics: string[] = [];
  for (const [name, [group, key]] of Object.entries(swervePaths)) {
    try { (result[group] ??= {})[key] = table.number(name); }
    catch (error) { diagnostics.push(`${name}: ${error instanceof Error ? error.message : String(error)}`); }
  }
  return { config: { ...result, sourceRevision: digest(source) } as GeneratedSwerveConstants, revision: digest(source), diagnostics };
}

export async function writeSwerve(project: SourceProject, config: GeneratedSwerveConstants, revision?: string) {
  const relative = `${constantsDirectory}/SwerveConstants.java`;
  await project.assertRevision(relative, revision ?? config.sourceRevision);
  const fields: Record<string, { value: number }> = {};
  for (const [name, [group, key]] of Object.entries(swervePaths)) {
    const groupValues = config[group] as Record<string, unknown> | undefined;
    if (groupValues?.[key] !== undefined) {
      const value = Number(groupValues[key]);
      if (!Number.isFinite(value)) throw Error(`Invalid ${name}.`);
      fields[name] = { value };
    }
  }
  await project.set(relative, patchValues(await project.read(relative), fields));
}

const visionPath = `${constantsDirectory}/VisionConstants.java`;
const cameraNames = { LIMELIGHT_FOV_DEGREES: "CAMERA_FOV_DEGREES", LIMELIGHT_IMAGE_WIDTH: "IMAGE_WIDTH", LIMELIGHT_IMAGE_HEIGHT: "IMAGE_HEIGHT" };
function sourceName(table: SourceValues, canonical: string, alias?: string) { return table.fields.some(field => field.name === canonical) ? canonical : alias && table.fields.some(field => field.name === alias) ? alias : canonical; }
/** Migration may explicitly add missing declarations; custom expressions still fail. */
export async function readVisionDraft(project: SourceProject) {
  const source = await project.read(visionPath);
  const table = new SourceValues(source);
  let names: string[];
  const list = table.fields.find(item => item.name === "LIMELIGHT_NAMES");
  if (list) {
    const range = boundExpression(source, list.expression);
    const mask = maskJava(source);
    const start = mask.indexOf("{", range.start);
    if (start < 0 || start >= range.end) throw Error("Camera list uses an unsupported Java expression.");
    names = splitExpressions(source, { start: start + 1, end: closing(mask, start) }).map(arg => {
      const value = literalValue(source, arg);
      if (typeof value !== "string") throw Error("Camera names must resolve to Java string literals.");
      return value;
    });
  } else names = table.fields.some(item => item.name === "LIMELIGHT_NAME") ? [table.string("LIMELIGHT_NAME")] : [];
  const number = (canonical: string, alias: string) => {
    const name = sourceName(table, canonical, alias);
    return table.fields.some(field => field.name === name) ? table.number(name) : undefined;
  };
  const vision = { limelights: names.filter(Boolean).map(name => ({ name })), fovDegrees: number("LIMELIGHT_FOV_DEGREES", cameraNames.LIMELIGHT_FOV_DEGREES),
    imageWidth: number("LIMELIGHT_IMAGE_WIDTH", cameraNames.LIMELIGHT_IMAGE_WIDTH), imageHeight: number("LIMELIGHT_IMAGE_HEIGHT", cameraNames.LIMELIGHT_IMAGE_HEIGHT) };
  return { path: visionPath, vision: { ...vision, sourceRevision: digest(source) }, revision: digest(source) };
}

export async function readVision(project: SourceProject) {
  const result = await readVisionDraft(project);
  // Older names can be viewed unchanged; saves enforce the limelight- format.
  validateVisionConfig({ ...result.vision, limelights: [] });
  return { ...result, vision: result.vision as VisionConfig };
}

export async function writeVision(project: SourceProject, vision: VisionConfig, revision?: string) {
  validateVisionConfig(vision);
  await project.assertRevision(visionPath, revision ?? vision.sourceRevision);
  let source = await project.read(visionPath);
  const table = new SourceValues(source);
  source = patchValues(source, { [sourceName(table, "LIMELIGHT_FOV_DEGREES", cameraNames.LIMELIGHT_FOV_DEGREES)]: { value: vision.fovDegrees }, [sourceName(table, "LIMELIGHT_IMAGE_WIDTH", cameraNames.LIMELIGHT_IMAGE_WIDTH)]: { value: vision.imageWidth, type: "int" }, [sourceName(table, "LIMELIGHT_IMAGE_HEIGHT", cameraNames.LIMELIGHT_IMAGE_HEIGHT)]: { value: vision.imageHeight, type: "int" } }, true);
  const fields = javaFields(source);
  const list = fields.find(item => item.name === "LIMELIGHT_NAMES");
  const names = `{${vision.limelights.map(camera => JSON.stringify(camera.name)).join(", ")}}`;
  if (list) {
    const current = await readVision(project).catch(() => null);
    if (!current || JSON.stringify(current.vision.limelights) !== JSON.stringify(vision.limelights)) source = source.slice(0, list.expression.start) + names + source.slice(list.expression.end);
  } else {
    const end = maskJava(source).lastIndexOf("}");
    source = source.slice(0, end) + `  public static final String[] LIMELIGHT_NAMES = ${names};\n` + source.slice(end);
  }
  // Keep the legacy single-camera alias valid for robot code which still references it.
  const primary = javaFields(source).find(item => item.name === "LIMELIGHT_NAME");
  if (primary && vision.limelights.length) source = patchValues(source, { LIMELIGHT_NAME: { value: vision.limelights[0].name, type: "String" } });
  await project.set(visionPath, source);
}

export const localizationNames = ["POSITION_TARGET_AREA_THRESHOLD", "POSITION_MAX_TARGET_DISTANCE_METERS", "HEADING_MAX_TAG_DISTANCE_METERS", "HEADING_SINGLE_TAG_MAX_DISTANCE_METERS"];
function limitArguments(source: string, range: Span, method: string) {
  const mask = maskJava(source);
  const calls = [...mask.slice(range.start, range.end).matchAll(new RegExp(`\\.${method}\\s*\\(`, "g"))];
  if (!calls.length) return null;
  if (calls.length !== 1) throw Error(`Multiple ${method} calls are ambiguous; edit this expression in Java.`);
  const open = range.start + calls[0].index! + calls[0][0].length - 1;
  const end = closing(mask, open);
  const args = splitExpressions(source, { start: open + 1, end });
  if (args.length !== 2 || mask.slice(end + 1, range.end).trim()) throw Error(`Custom ${method} chain is read-only.`);
  return { start: open + 1, end, args };
}
export async function readLocalizationDraft(project: SourceProject) {
  const source = await project.read(visionPath);
  const table = new SourceValues(source);
  const position = limitArguments(source, table.field("CONFIG").expression, "withPositionLimits");
  const heading = limitArguments(source, table.field("HEADING_CONFIG").expression, "withDistanceLimits");
  const number = (range: Span) => { const value = literalValue(source, range); if (typeof value !== "number") throw Error("Localization requires a literal numeric binding."); return value; };
  const optional = (canonical: string, alias?: string) => {
    const name = sourceName(table, canonical, alias);
    return table.fields.some(field => field.name === name) ? table.number(name) : undefined;
  };
  const config = { position: { targetAreaThreshold: position ? number(position.args[1]) : optional(localizationNames[0], "TARGET_AREA_THRESHOLD"), maxTargetDistanceMeters: position ? number(position.args[0]) : optional(localizationNames[1], "MAX_TARGET_DISTANCE_METERS") },
    heading: { maxTagDistanceMeters: heading ? number(heading.args[0]) : optional(localizationNames[2]), singleTagMaxDistanceMeters: heading ? number(heading.args[1]) : optional(localizationNames[3]) } };
  return { path: visionPath, config: { ...config, sourceRevision: digest(source) }, revision: digest(source) };
}

export async function readLocalization(project: SourceProject) {
  const result = await readLocalizationDraft(project);
  validateLocalizationConfig(result.config);
  return { ...result, config: result.config };
}

export async function writeLocalization(project: SourceProject, config: LocalizationConfig, revision?: string) {
  validateLocalizationConfig(config);
  await project.assertRevision(visionPath, revision ?? config.sourceRevision);
  let source = patchValues(await project.read(visionPath), Object.fromEntries([
    config.position.targetAreaThreshold, config.position.maxTargetDistanceMeters, config.heading.maxTagDistanceMeters, config.heading.singleTagMaxDistanceMeters
  ].map((value, index) => [localizationNames[index], { value }])), true);
  for (const [name, method, fields] of [["CONFIG", "withPositionLimits", [localizationNames[1], localizationNames[0]]], ["HEADING_CONFIG", "withDistanceLimits", [localizationNames[2], localizationNames[3]]]] as const) {
    const field = javaFields(source).find(item => item.name === name);
    if (!field) throw Error(`VisionConstants is missing ${name}.`);
    const suffix = `.${method}(${fields.join(", ")})`;
    if (!field.value.replace(/\s/g, "").endsWith(suffix.replace(/\s/g, ""))) {
      const existing = limitArguments(source, field.expression, method);
      if (existing) source = source.slice(0, existing.start) + fields.join(", ") + source.slice(existing.end);
      else source = source.slice(0, field.expression.start) + `(${field.value})${suffix}` + source.slice(field.expression.end);
    }
  }
  await project.set(visionPath, source);
}
