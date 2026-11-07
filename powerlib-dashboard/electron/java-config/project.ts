import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { validateJava } from "./source.js";

const pending = new Map<string, Promise<unknown>>();
export const robotSource = "src/main/java/frc/robot";
export const constantsDirectory = `${robotSource}/constants`;
export const stateMachinePath = `${robotSource}/subsystems/StateMachine.java`;
export const constantsBarrelPath = `${robotSource}/Constants.java`;
export const dashboardPath = `${robotSource}/subsystems/PowerDashboard.java`;
export const sourceFormatMarker = "// POWERLIB JAVA CONFIG FORMAT: 1";
export const digest = (source: string) => createHash("sha256").update(source).digest("hex");

async function optionalRead(file: string) {
  try { return await fs.readFile(file, "utf8"); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
}

export function withProjectLock<T>(root: string, operation: () => Promise<T>) {
  const key = path.resolve(root).toLowerCase();
  const result = (pending.get(key) ?? Promise.resolve()).then(operation);
  const settled = result.then(() => {}, () => {});
  pending.set(key, settled);
  void settled.then(() => { if (pending.get(key) === settled) pending.delete(key); });
  return result;
}

type JournalEntry = { relative: string; before: string | null; after: string | null };

async function safePath(root: string, relative: string) {
  const absolute = path.resolve(root, relative);
  const allowed = path.resolve(root, robotSource) + path.sep;
  if (!absolute.startsWith(allowed) || !absolute.endsWith(".java")) throw Error("Java edit escaped the robot source directory.");
  for (let current = absolute; current !== path.resolve(root); current = path.dirname(current)) {
    const info = await fs.lstat(current).catch(error => { if (error.code === "ENOENT") return null; throw error; });
    if (info?.isSymbolicLink()) throw Error(`Java editing does not follow symbolic links: ${current}`);
  }
  return absolute;
}

async function replaceFile(file: string, content: string | null) {
  if (content === null) { await fs.rm(file, { force: true }); return; }
  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, content, "utf8"); await fs.rename(temporary, file); }
  finally { await fs.rm(temporary, { force: true }); }
}

export class SourceProject {
  readonly originals = new Map<string, string | null>();
  readonly edits = new Map<string, string | null>();
  constructor(readonly root: string) {}

  async read(relative: string, optional = false): Promise<string> {
    if (!this.originals.has(relative)) this.originals.set(relative, await optionalRead(await safePath(this.root, relative)));
    const source = this.edits.has(relative) ? this.edits.get(relative) : this.originals.get(relative);
    if (source === null || source === undefined) {
      if (optional) return "";
      throw Error(`Missing ${relative}. Install the robot templates before saving configuration.`);
    }
    return source;
  }

  async files(directory = robotSource): Promise<string[]> {
    const output: string[] = [];
    const walk = async (relative: string) => {
      const entries = await fs.readdir(path.join(this.root, relative), { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error; });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) throw Error(`Source inventory contains a symbolic link: ${entry.name}`);
        if (entry.isDirectory()) await walk(`${relative}/${entry.name}`);
        else if (entry.name.endsWith(".java")) output.push(`${relative}/${entry.name}`);
      }
    };
    await walk(directory);
    for (const [relative, content] of this.edits) if (relative.startsWith(`${directory}/`) && content !== null && !output.includes(relative)) output.push(relative);
    return output.filter(relative => this.edits.get(relative) !== null).sort();
  }

  async set(relative: string, source: string | null) {
    await this.read(relative, true);
    if (source !== null) validateJava(source);
    this.edits.set(relative, source);
  }

  async assertRevision(relative: string, expected?: string) {
    if (!expected) return;
    await this.read(relative);
    // Multiple sections can edit the same file within this transaction. Their
    // loaded revision describes the disk snapshot, not earlier planned edits.
    if (digest(this.originals.get(relative) ?? "") !== expected) throw Error(`${relative} changed since it was loaded. Refresh before saving; your draft has been kept.`);
  }

  async commit() {
    const entries: JournalEntry[] = [...this.edits].filter(([relative, after]) => this.originals.get(relative) !== after)
      .map(([relative, after]) => ({ relative, before: this.originals.get(relative) ?? null, after }));
    if (!entries.length) return [];
    for (const [relative, original] of this.originals) if (await optionalRead(await safePath(this.root, relative)) !== original) throw Error(`${relative} changed during this save. Refresh before saving.`);
    const directory = path.join(this.root, "build", "power-tool-edits", randomUUID());
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(path.join(directory, "journal.json"), JSON.stringify(entries), "utf8");
    const committed: JournalEntry[] = [];
    try {
      for (const entry of entries) {
        const file = await safePath(this.root, entry.relative);
        if (await optionalRead(file) !== entry.before) throw Error(`${entry.relative} changed during this save.`);
        await replaceFile(file, entry.after);
        committed.push(entry);
      }
      await fs.writeFile(path.join(directory, "complete"), "committed\n");
    } catch (error) {
      for (const entry of committed.reverse()) {
        const file = await safePath(this.root, entry.relative);
        if (await optionalRead(file) !== entry.after) throw Error(`Save interrupted by an external edit. Recovery is required from ${directory}.`);
        await replaceFile(file, entry.before);
      }
      await fs.writeFile(path.join(directory, "complete"), "rolled back\n");
      throw error;
    }
    return entries.map(entry => entry.relative);
  }
}

export async function recoverSourceTransactions(root: string) {
  const directory = path.join(root, "build", "power-tool-edits");
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch(error => { if (error.code === "ENOENT") return []; throw error; });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
    const folder = path.join(directory, entry.name);
    if (await optionalRead(path.join(folder, "complete"))) continue;
    const journal = await optionalRead(path.join(folder, "journal.json"));
    if (!journal) continue;
    for (const change of (JSON.parse(journal) as JournalEntry[]).reverse()) {
      const file = await safePath(root, change.relative);
      const current = await optionalRead(file);
      if (current === change.before) continue;
      if (current !== change.after) throw Error(`An interrupted save conflicts with an external edit in ${file}. Recover using ${folder}.`);
      await replaceFile(file, change.before);
    }
    await fs.writeFile(path.join(folder, "complete"), "recovered\n");
  }
}

export function sourceOperation<T>(root: string, action: (project: SourceProject) => Promise<T>) {
  return withProjectLock(root, async () => {
    await recoverSourceTransactions(root);
    const project = new SourceProject(root);
    const result = await action(project);
    await project.commit();
    return result;
  });
}
