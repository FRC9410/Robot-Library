import fs from "node:fs/promises";
import path from "node:path";
import { readRobotDocument, updateRobotDocument } from "./robotDocument.js";
import { stateNamesFromJava, validateStateConfig, type StateConfig } from "./stateConfig.js";

export async function readStateConfig(robotRoot: string) {
  const { path: file, document } = await readRobotDocument(robotRoot);
  let states = document.states;
  if (states === undefined) {
    try { states = stateNamesFromJava(await fs.readFile(path.join(robotRoot, "src/main/java/frc/robot/subsystems/StateMachine.java"), "utf8")); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      states = ["IDLE"];
    }
  }
  const config = { states };
  validateStateConfig(config);
  return { path: file, config };
}

export async function saveStateConfig(robotRoot: string, config: StateConfig) {
  validateStateConfig(config);
  const result = await updateRobotDocument(robotRoot, document => ({ ...document, states: config.states }));
  return { path: result.path, config };
}
