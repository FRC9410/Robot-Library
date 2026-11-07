import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generatedJsonPath } from "./projectPaths.js";

const saves = new Map<string, Promise<unknown>>();
export function withRobotDocumentLock<T>(robotRoot: string, action: () => Promise<T>): Promise<T> {
  const key = path.resolve(robotRoot).toLowerCase();
  const result = (saves.get(key) ?? Promise.resolve()).then(action);
  const settled = result.then(() => {}, () => {});
  saves.set(key, settled);
  void settled.then(() => { if (saves.get(key) === settled) saves.delete(key); });
  return result;
}

export async function readRobotDocument(robotRoot: string) {
  const file = await generatedJsonPath(robotRoot, "powerlib-subsystems.json");
  try {
    const document = JSON.parse(await fs.readFile(file, "utf8"));
    if (!document || typeof document !== "object" || Array.isArray(document)) throw Error("Invalid robot configuration document.");
    return { path: file, exists: true, document: document as Record<string, unknown> };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path: file, exists: false, document: {} as Record<string, unknown> };
    throw error;
  }
}

export function updateRobotDocument(robotRoot: string, update: (document: Record<string, unknown>) => Record<string, unknown>) {
  return withRobotDocumentLock(robotRoot, async () => {
    const current = await readRobotDocument(robotRoot);
    const document = update(current.document);
    const temporary = `${current.path}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, `${JSON.stringify(document, null, 2)}\n`, "utf8");
      await fs.rename(temporary, current.path);
    } finally { await fs.rm(temporary, { force: true }); }
    return { path: current.path, exists: true, document };
  });
}
