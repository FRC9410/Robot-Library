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
  const result = await updateRobotDocument(robotRoot, document => {
    const pending = document.stateHandlerDeletions ?? [];
    if (!Array.isArray(pending) || pending.some(name => typeof name !== "string")) throw Error("Invalid pending state handler deletions.");
    const deletions = [...new Set([...pending, ...(config.deleteHandlers ?? [])])].filter(name => !config.states.includes(name));
    validateStateConfig({ states: config.states, deleteHandlers: deletions });
    const next: Record<string, unknown> = { ...document, states: config.states };
    if (deletions.length) next.stateHandlerDeletions = deletions;
    else delete next.stateHandlerDeletions;
    return next;
  });
  return { path: result.path, config: { states: config.states } };
}
