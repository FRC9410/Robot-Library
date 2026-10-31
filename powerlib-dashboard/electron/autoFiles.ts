import fs from "node:fs/promises";
import path from "node:path";
import { replaceFile } from "./constantsFiles.js";
import { generatedJsonPath } from "./projectPaths.js";

// Keep in sync with src/features/autos/autoModel.ts, which generates the Java source.
const generatedHeader = "// POWERLIB GENERATED AUTOS - DO NOT EDIT";
const autosJson = "powerlib-autos.json";
const javaRoot = (robotRoot: string) => path.join(robotRoot, "src", "main", "java", "frc", "robot");

export type AutoFilesState = {
  path: string;
  document: unknown;
  states: string[];
  driveCommandInstalled: boolean;
  robotAutosHooked: boolean | null;
  robotAutosStrings: string[];
  robot: { width: number; length: number };
  error?: string;
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

async function readRobotSize(robotRoot: string) {
  const fallback = { width: 0.914, length: 0.914 };
  try {
    const settings = JSON.parse((await readOptional(path.join(robotRoot, "src", "main", "deploy", "pathplanner", "settings.json"))) ?? "{}");
    const valid = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value > 0;
    return { width: valid(settings.robotWidth) ? settings.robotWidth : fallback.width,
      length: valid(settings.robotLength) ? settings.robotLength : fallback.length };
  } catch {
    return fallback;
  }
}

export async function readAutoFiles(robotRoot: string): Promise<AutoFilesState> {
  const jsonPath = await generatedJsonPath(robotRoot, autosJson);
  // Generated drive legs need the DriveToPose command and PowerLib's DriveConstraints.
  const driveCommandFiles = [path.join(javaRoot(robotRoot), "commands", "DriveToPose.java"),
    path.join(robotRoot, "src", "main", "java", "frc", "powerlib", "auto", "DriveConstraints.java")];
  const [json, stateMachine, driveCommandInstalled, robotAutos, robot] = await Promise.all([
    readOptional(jsonPath),
    readOptional(path.join(javaRoot(robotRoot), "subsystems", "StateMachine.java")),
    Promise.all(driveCommandFiles.map(file => fs.access(file).then(() => true, () => false))).then(found => found.every(Boolean)),
    readOptional(path.join(javaRoot(robotRoot), "autos", "RobotAutos.java")),
    readRobotSize(robotRoot)
  ]);
  const state: AutoFilesState = {
    path: jsonPath,
    document: { version: 1, autos: [] },
    states: stateMachine ? parseRobotStates(stateMachine) : [],
    driveCommandInstalled,
    robotAutosHooked: robotAutos ? hasGeneratedAutosHook(robotAutos) : null,
    robotAutosStrings: robotAutos ? parseStringLiterals(robotAutos) : [],
    robot
  };
  if (json !== null) {
    try {
      state.document = JSON.parse(json.replace(/^﻿/, ""));
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
  return `${JSON.stringify(document, null, 2)}\n`;
}

export async function saveAutoFiles(robotRoot: string, document: unknown) {
  await replaceFile(await generatedJsonPath(robotRoot, autosJson), requireDocument(document));
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
  await replaceFile(await generatedJsonPath(robotRoot, autosJson), json);
  await replaceFile(generatedPath, javaSource);
  if (hooked !== robotAutos) await replaceFile(robotAutosPath, hooked);
  return { generatedPath, hookAdded: hooked !== robotAutos, state: await readAutoFiles(robotRoot) };
}
