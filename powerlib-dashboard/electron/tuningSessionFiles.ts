import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { normalizeTuningConnection, isTuningSessionValue, type TuningConnection, type TuningSessionValue } from "./tuningSession.js";
const pending = new Map<string, Promise<unknown>>();
function location(userData: string, root: string, connection: TuningConnection) {
  const resolved = path.resolve(root);
  const project = process.platform === "win32" ? resolved.toLowerCase() : resolved;
  const normalized = normalizeTuningConnection(connection);
  const key = createHash("sha256").update(JSON.stringify([project, normalized])).digest("hex");
  return { project, connection: normalized, path: path.join(userData, "tuning-sessions", `${key}.json`) };
}
export async function readTuningSession(userData: string, root: string, connection: TuningConnection) {
  const scope = location(userData, root, connection);
  try {
    const document = JSON.parse(await fs.readFile(scope.path, "utf8"));
    if (!document || document.version !== 1 || document.project !== scope.project || JSON.stringify(normalizeTuningConnection(document.connection)) !== JSON.stringify(scope.connection)
      || !Array.isArray(document.values) || document.values.length > 5000 || !document.values.every(isTuningSessionValue)
      || new Set(document.values.map((row: TuningSessionValue) => row.name)).size !== document.values.length) throw Error("Invalid tuning recovery file.");
    return { path: scope.path, values: document.values as TuningSessionValue[] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { path: scope.path, values: [] as TuningSessionValue[] };
    throw Error(`Could not read ${scope.path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}
export function saveTuningSession(userData: string, root: string, connection: TuningConnection, values: TuningSessionValue[]) {
  if (!Array.isArray(values) || !values.length || values.length > 5000 || !values.every(isTuningSessionValue)) throw Error("Invalid applied tuning values.");
  const scope = location(userData, root, connection);
  const result = (pending.get(scope.path) ?? Promise.resolve()).then(async () => {
    const old = await readTuningSession(userData, root, connection);
    const rows = new Map(old.values.map(row => [row.name, row]));
    for (const { name, type, value } of values) rows.set(name, { name, type, value });
    if (rows.size > 5000) throw Error("Too many saved tuning values.");
    const next = [...rows.values()].sort((left, right) => left.name.localeCompare(right.name));
    await fs.mkdir(path.dirname(scope.path), { recursive: true });
    const temporary = `${scope.path}.${randomUUID()}.tmp`;
    try { await fs.writeFile(temporary, JSON.stringify({ version: 1, project: scope.project, connection: scope.connection, updatedAt: new Date().toISOString(), values: next }, null, 2) + "\n"); await fs.rename(temporary, scope.path); }
    finally { await fs.rm(temporary, { force: true }); }
    return { path: scope.path, values: next };
  });
  const settled = result.then(() => {}, () => {});
  pending.set(scope.path, settled);
  void settled.then(() => { if (pending.get(scope.path) === settled) pending.delete(scope.path); });
  return result;
}
