import { readRobotDocument, updateRobotDocument } from "./robotDocument.js";

export async function readSubsystemDocument(robotRoot: string) {
  const { path, exists, document } = await readRobotDocument(robotRoot);
  return { path, exists, subsystems: Array.isArray(document.subsystems) ? document.subsystems : [], swerve: document.swerve ?? {} };
}

export async function saveSubsystemDocument(robotRoot: string, subsystems: unknown[], swerve?: unknown) {
  if (!Array.isArray(subsystems)) throw Error("Subsystems must be a list.");
  const { path, document } = await updateRobotDocument(robotRoot, current => ({ ...current,
    subsystems, swerve: swerve === undefined ? current.swerve ?? {} : swerve }));
  return { path, exists: true, subsystems: document.subsystems as unknown[], swerve: document.swerve ?? {} };
}
