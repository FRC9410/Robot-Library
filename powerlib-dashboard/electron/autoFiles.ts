import fs from "node:fs/promises";
import path from "node:path";
import { replaceFile } from "./constantsFiles.js";
import { generatedJsonPath } from "./projectPaths.js";

// Keep in sync with src/features/autos/autoModel.ts, which generates the Java source.
const generatedHeader = "// POWERLIB GENERATED AUTOS - DO NOT EDIT";
const autosJson = "powerlib-autos.json";

/**
 * The newest powerlib-autos.json format this Power Tool understands. Raise it (here and as
 * autosFileVersion in src/features/autos/autoModel.ts) whenever older copies would lose something
 * by reading and saving the file, such as a new step type. A file with a higher number is never
 * written over: an older Power Tool would silently drop what it doesn't understand.
 * Files without a version, and version 1, are from before this check.
 */
export const autosFileVersion = 2;

/** The format version a saved document says it has; 1 when it has none. */
export function autosFileVersionOf(document: unknown) {
  const version = document && typeof document === "object" ? (document as { version?: unknown }).version : undefined;
  return typeof version === "number" && Number.isInteger(version) && version > 0 ? version : 1;
}

export function newerAutosFileMessage(version: number) {
  return `${autosJson} was saved by a newer Power Tool (file version ${version}; this one understands up to ${autosFileVersion}). `
    + "Update Power Tool (File → Update Power Tool) before changing autos, or the newer parts would be lost.";
}
const javaRoot = (robotRoot: string) => path.join(robotRoot, "src", "main", "java", "frc", "robot");

export type AutoFilesState = {
  path: string;
  document: unknown;
  states: string[];
  driveCommandInstalled: boolean;
  robotAutosHooked: boolean | null;
  robotAutosStrings: string[];
  /** StateMachine's public boolean methods with no arguments, which branches can check. */
  checks: string[];
  /** GeneratedAutos.java as it is now, or null when it doesn't exist. */
  generatedSource: string | null;
  robot: { width: number; length: number };
  /** Drivetrain numbers for the Auto Builder's speed checks, or null without TunerConstants. */
  drivetrain: DrivetrainFiles | null;
  /** Limelight names and measurement limits for the tag-visibility view, or null without VisionConstants. */
  vision: VisionFiles | null;
  error?: string;
};

// Keep in sync with VisionLimits and CameraMount in src/features/autos/autoVision.ts.
export type VisionFiles = {
  /** LimelightVisionConfig's first two arguments, which set how far the robot trusts a tag. */
  basePositionStdDev: number;
  maxTagDistance: number;
  /** The Limelight table names the robot reads, in order. */
  cameraNames: string[];
};

type Point = { x: number; y: number };

// Keep in sync with DrivetrainConstants in src/features/autos/autoLimits.ts.
export type DrivetrainFiles = {
  /** From TunerConstants, the code the robot runs; SI units. */
  speedAt12Volts: number;
  driveGearRatio: number;
  wheelRadius: number;
  slipCurrent: number;
  frictionVoltage: number;
  modules: Point[];
  /** From PathPlanner's settings, the only place they appear; null when missing. */
  mass: number | null;
  wheelCOF: number | null;
  motor: string | null;
  /** PathPlanner's copy of the TunerConstants numbers, so the Auto Builder can point out where they disagree. */
  pathPlanner: { maxDriveSpeed: number | null; driveGearing: number | null; driveWheelRadius: number | null; modules: Point[] | null } | null;
};

async function readOptional(filePath: string) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const stripComments = (source: string) => source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, " ");

/** Reads RobotState constants, including constants that take constructor arguments. */
export function parseRobotStates(source: string) {
  const match = /\benum\s+RobotState\s*\{([^;}]*)/.exec(stripComments(source));
  if (!match) return [];
  return match[1].split(",").map(part => /^\s*([A-Za-z_$][\w$]*)/.exec(part)?.[1]).filter((name): name is string => Boolean(name));
}

/** StateMachine's public, non-static boolean methods with no arguments, such as hasFuel(). */
export function parseRobotChecks(source: string) {
  const methods = [...stripComments(source).matchAll(/\bpublic\s+(?:final\s+)?boolean\s+([A-Za-z_$][\w$]*)\s*\(\s*\)/g)].map(match => match[1]);
  return [...new Set(methods)];
}

const registerSignature = /public\s+static\s+void\s+register\s*\(\s*(?:final\s+)?(?:frc\.powerlib\.auto\.)?AutoBuilder\s+([A-Za-z_$][\w$]*)\s*,\s*(?:final\s+)?(?:frc\.robot\.subsystems\.)?StateMachine\s+([A-Za-z_$][\w$]*)\s*\)\s*\{/;

/** String literals in RobotAutos.java; any may be a hand-written auto name that generated autos must not reuse. */
export function parseStringLiterals(source: string) {
  const literals = stripComments(source).match(/"(?:\\.|[^"\\\r\n])*"/g) ?? [];
  return [...new Set(literals.map(literal => literal.slice(1, -1).replace(/\\(.)/g, "$1")))];
}

export function hasGeneratedAutosHook(source: string) {
  return /\bGeneratedAutos\s*\.\s*register\s*\(/.test(stripComments(source));
}

/** Adds the generated registration as the first line of RobotAutos.register(). */
export function addGeneratedAutosHook(source: string) {
  if (hasGeneratedAutosHook(source)) return source;
  const match = registerSignature.exec(source);
  if (!match) throw new Error("Could not find RobotAutos.register(AutoBuilder, StateMachine). Add GeneratedAutos.register(autoBuilder, robot); to it yourself.");
  const end = match.index + match[0].length;
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return `${source.slice(0, end)}${newline}    GeneratedAutos.register(${match[1]}, ${match[2]});${source.slice(end)}`;
}

/** PathPlanner's settings.json, or an empty object when it is missing or unreadable. */
async function readPathPlannerSettings(robotRoot: string): Promise<Record<string, unknown>> {
  try {
    const settings = JSON.parse((await readOptional(path.join(robotRoot, "src", "main", "deploy", "pathplanner", "settings.json")))?.replace(/^﻿/, "") ?? "{}");
    return settings && typeof settings === "object" ? settings : {};
  } catch {
    return {};
  }
}

const positive = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value > 0;

function robotSize(settings: Record<string, unknown>) {
  return { width: positive(settings.robotWidth) ? settings.robotWidth : 0.914, length: positive(settings.robotLength) ? settings.robotLength : 0.914 };
}

/** Meters, meters per second, amps and volts for the WPILib units TunerConstants uses. */
const unitScale: Record<string, number> = { Meters: 1, Centimeters: 0.01, Millimeters: 0.001, Inches: 0.0254, Feet: 0.3048,
  MetersPerSecond: 1, FeetPerSecond: 0.3048, Amps: 1, Volts: 1 };

/** A numeric constant such as `kWheelRadius = Inches.of(2)` or `kDriveGearRatio = 5.4`, in SI units. */
function javaNumber(source: string, name: string) {
  const match = new RegExp(String.raw`\b${name}\s*=\s*(?:(?:Units\.)?([A-Za-z]+)\.of\(\s*)?(-?\d+(?:\.\d+)?(?:[eE]-?\d+)?)`).exec(source);
  if (!match) return null;
  const scale = match[1] === undefined ? 1 : unitScale[match[1]];
  return scale === undefined ? null : Number(match[2]) * scale;
}

/**
 * Reads the drivetrain numbers the speed checks need from CTRE's generated TunerConstants and
 * PathPlanner's settings. Returns null when TunerConstants lacks the basics.
 */
export function parseDrivetrain(tunerSource: string, settings: Record<string, unknown>): DrivetrainFiles | null {
  const source = stripComments(tunerSource);
  const number = (name: string) => javaNumber(source, name);
  const speedAt12Volts = number("kSpeedAt12Volts");
  const driveGearRatio = number("kDriveGearRatio");
  const wheelRadius = number("kWheelRadius");
  const slipCurrent = number("kSlipCurrent");
  const modules = ["FrontLeft", "FrontRight", "BackLeft", "BackRight"].map(corner => ({ x: number(`k${corner}XPos`), y: number(`k${corner}YPos`) }));
  if (!positive(speedAt12Volts) || !positive(driveGearRatio) || !positive(wheelRadius) || !positive(slipCurrent)
    || modules.some(module => module.x === null || module.y === null)) return null;
  const setting = (key: string) => positive(settings[key]) ? settings[key] as number : null;
  const pathPlannerModules = ["fl", "fr", "bl", "br"].map(corner => ({ x: settings[`${corner}ModuleX`], y: settings[`${corner}ModuleY`] }));
  const hasPathPlanner = Object.keys(settings).length > 0;
  return {
    speedAt12Volts, driveGearRatio, wheelRadius, slipCurrent,
    frictionVoltage: number("kDriveFrictionVoltage") ?? 0,
    modules: modules as Point[],
    mass: setting("robotMass"),
    wheelCOF: setting("wheelCOF"),
    motor: typeof settings.driveMotorType === "string" ? settings.driveMotorType : null,
    pathPlanner: hasPathPlanner ? {
      maxDriveSpeed: setting("maxDriveSpeed"),
      driveGearing: setting("driveGearing"),
      driveWheelRadius: setting("driveWheelRadius"),
      modules: pathPlannerModules.every(module => typeof module.x === "number" && typeof module.y === "number") ? pathPlannerModules as Point[] : null
    } : null
  };
}

/**
 * Reads the Limelight names and the MegaTag2 limits the robot applies, from VisionConstants:
 * `new LimelightVisionConfig(basePositionStdDev, maxTagDistanceMeters, maxMeasurementAgeSeconds)`
 * and the LIMELIGHT_NAMES array. Returns null when neither is there.
 */
export function parseVision(source: string): VisionFiles | null {
  const text = stripComments(source);
  const config = /\bnew\s+LimelightVisionConfig\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*,/.exec(text);
  const names = /\bLIMELIGHT_NAMES\s*=\s*\{([^}]*)\}/.exec(text);
  const cameraNames = names ? [...names[1].matchAll(/"([^"]+)"/g)].map(match => match[1]) : [];
  if (!config && cameraNames.length === 0) return null;
  const base = config ? Number(config[1]) : Number.NaN;
  const distance = config ? Number(config[2]) : Number.NaN;
  return {
    basePositionStdDev: positive(base) ? base : 0.07,
    maxTagDistance: positive(distance) ? distance : 6.25,
    cameraNames
  };
}

/** CTRE's generator writes TunerConstants to frc/robot/generated; PowerLib projects keep it in constants. */
async function readTunerConstants(robotRoot: string) {
  for (const folder of ["constants", "generated"]) {
    const source = await readOptional(path.join(javaRoot(robotRoot), folder, "TunerConstants.java"));
    if (source !== null) return source;
  }
  return null;
}

export async function readAutoFiles(robotRoot: string): Promise<AutoFilesState> {
  const jsonPath = await generatedJsonPath(robotRoot, autosJson);
  // Generated drive legs need the DriveToPose command and PowerLib's DriveConstraints.
  const driveCommandFiles = [path.join(javaRoot(robotRoot), "commands", "DriveToPose.java"),
    path.join(robotRoot, "src", "main", "java", "frc", "powerlib", "auto", "DriveConstraints.java")];
  const [json, stateMachine, driveCommandInstalled, robotAutos, generatedSource, settings, tunerConstants, visionConstants] = await Promise.all([
    readOptional(jsonPath),
    readOptional(path.join(javaRoot(robotRoot), "subsystems", "StateMachine.java")),
    Promise.all(driveCommandFiles.map(file => fs.access(file).then(() => true, () => false))).then(found => found.every(Boolean)),
    readOptional(path.join(javaRoot(robotRoot), "autos", "RobotAutos.java")),
    readOptional(path.join(javaRoot(robotRoot), "autos", "GeneratedAutos.java")),
    readPathPlannerSettings(robotRoot),
    readTunerConstants(robotRoot),
    readOptional(path.join(javaRoot(robotRoot), "constants", "VisionConstants.java"))
  ]);
  const state: AutoFilesState = {
    path: jsonPath,
    document: { version: autosFileVersion, autos: [] },
    states: stateMachine ? parseRobotStates(stateMachine) : [],
    driveCommandInstalled,
    robotAutosHooked: robotAutos ? hasGeneratedAutosHook(robotAutos) : null,
    robotAutosStrings: robotAutos ? parseStringLiterals(robotAutos) : [],
    checks: stateMachine ? parseRobotChecks(stateMachine) : [],
    generatedSource,
    robot: robotSize(settings),
    drivetrain: tunerConstants ? parseDrivetrain(tunerConstants, settings) : null,
    vision: visionConstants ? parseVision(visionConstants) : null
  };
  if (json !== null) {
    try {
      const document: unknown = JSON.parse(json.replace(/^﻿/, ""));
      const version = autosFileVersionOf(document);
      // Show nothing from a newer file, so nothing can be edited and saved back without its newer parts.
      if (version > autosFileVersion) state.error = newerAutosFileMessage(version);
      else state.document = document;
    } catch (error) {
      state.error = `Could not read ${autosJson}: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  return state;
}

function requireDocument(document: unknown) {
  if (!document || typeof document !== "object" || !Array.isArray((document as { autos?: unknown }).autos)) {
    throw new Error("Invalid auto document.");
  }
  const version = autosFileVersionOf(document);
  if (version > autosFileVersion) throw new Error(newerAutosFileMessage(version));
  return `${JSON.stringify(document, null, 2)}\n`;
}

/** Throws when the saved file is from a newer Power Tool, whatever the page sends. */
async function refuseNewerFile(jsonPath: string) {
  const saved = await readOptional(jsonPath);
  if (saved === null) return;
  let document: unknown;
  try { document = JSON.parse(saved.replace(/^﻿/, "")); } catch { return; }
  const version = autosFileVersionOf(document);
  if (version > autosFileVersion) throw new Error(newerAutosFileMessage(version));
}

export async function saveAutoFiles(robotRoot: string, document: unknown) {
  const jsonPath = await generatedJsonPath(robotRoot, autosJson);
  const json = requireDocument(document);
  await refuseNewerFile(jsonPath);
  await replaceFile(jsonPath, json);
  return readAutoFiles(robotRoot);
}

/** Saves the document, writes GeneratedAutos.java and makes sure RobotAutos registers it. */
export async function updateAutoCode(robotRoot: string, document: unknown, javaSource: unknown) {
  const json = requireDocument(document);
  if (typeof javaSource !== "string" || !javaSource.startsWith(generatedHeader) || !/\bpublic\s+final\s+class\s+GeneratedAutos\b/.test(javaSource)) {
    throw new Error("Invalid generated auto source.");
  }
  const autosDirectory = path.join(javaRoot(robotRoot), "autos");
  const generatedPath = path.join(autosDirectory, "GeneratedAutos.java");
  const robotAutosPath = path.join(autosDirectory, "RobotAutos.java");
  const robotAutos = await readOptional(robotAutosPath);
  if (robotAutos === null) throw new Error("Missing src/main/java/frc/robot/autos/RobotAutos.java. Run the PowerLib installer first.");
  const existing = await readOptional(generatedPath);
  if (existing !== null && !existing.startsWith(generatedHeader)) {
    throw new Error("GeneratedAutos.java was not written by Power Tool. Rename it before updating auto code.");
  }
  const hooked = addGeneratedAutosHook(robotAutos);
  const jsonPath = await generatedJsonPath(robotRoot, autosJson);
  await refuseNewerFile(jsonPath);
  await replaceFile(jsonPath, json);
  await replaceFile(generatedPath, javaSource);
  if (hooked !== robotAutos) await replaceFile(robotAutosPath, hooked);
  return { generatedPath, hookAdded: hooked !== robotAutos, state: await readAutoFiles(robotRoot) };
}
