import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
export const owletDownloadUrl = "https://docs.ctr-electronics.com/cli-tools";

type Owlet = { path: string; compliancy?: number };

/**
 * Every Owlet we can find. CTRE changes the .hoot format between Phoenix releases, and each Owlet
 * reads one format version ("compliancy"). AdvantageScope's cache names them `owlet-<ver>-C<compliancy>.exe`.
 */
export async function findOwlets(directories: string[], explicit?: string): Promise<Owlet[]> {
  const found: string[] = [];
  if (explicit) found.push(explicit);
  for (const directory of directories) {
    try {
      for (const name of await fs.readdir(directory)) {
        if (/^owlet/i.test(name) && (process.platform !== "win32" || name.toLowerCase().endsWith(".exe"))) found.push(path.join(directory, name));
      }
    } catch {
      // Keep looking.
    }
  }
  try {
    const { stdout } = await execFileAsync(process.platform === "win32" ? "where" : "which", ["owlet"], { windowsHide: true });
    found.push(...stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean));
  } catch {
    // Not on PATH.
  }
  const unique = Array.from(new Set(found.map((candidate) => path.resolve(candidate))));
  return unique.map((candidate) => {
    const match = /-C(\d+)(?:\.exe)?$/i.exec(path.basename(candidate));
    return { path: candidate, compliancy: match ? Number(match[1]) : undefined };
  }).sort((left, right) => (right.compliancy ?? -1) - (left.compliancy ?? -1));
}

/** Runs `owlet <hoot> --compliancy`, which prints both the Owlet's and the log's format version. */
async function readCompliancy(owlet: string, hootPath: string) {
  const { stdout } = await execFileAsync(owlet, [hootPath, "--compliancy"], { windowsHide: true, timeout: 30000 });
  const own = /owlet:\s*(\d+)/i.exec(stdout);
  const hoot = /hoot log:\s*(\d+)/i.exec(stdout);
  return { owlet: own ? Number(own[1]) : undefined, hoot: hoot ? Number(hoot[1]) : undefined };
}

/** Converts a .hoot to .wpilog with the Owlet that matches the log's format version. */
export async function convertHoot(hootPath: string, outputPath: string, directories: string[], explicit?: string) {
  const owlets = await findOwlets(directories, explicit);
  if (owlets.length === 0) {
    throw new Error(`Opening .hoot files needs CTRE's Owlet converter, which wasn't found. Opening any .hoot once in AdvantageScope downloads it, or get it from ${owletDownloadUrl} and put it in power-tool/tools/. .wpilog files open without it.`);
  }

  let needed: number | undefined;
  for (const owlet of owlets) {
    try {
      const reported = await readCompliancy(owlet.path, hootPath);
      owlet.compliancy ??= reported.owlet;
      needed = reported.hoot;
      if (needed !== undefined) break;
    } catch {
      // This Owlet can't read the header; try another.
    }
  }

  let chosen = needed === undefined ? owlets[0] : owlets.find((owlet) => owlet.compliancy === needed);
  if (!chosen && needed !== undefined) {
    // Fill in versions for Owlets whose file names don't say, then look again.
    for (const owlet of owlets.filter((candidate) => candidate.compliancy === undefined)) {
      try { owlet.compliancy = (await readCompliancy(owlet.path, hootPath)).owlet; } catch { /* Skip it. */ }
    }
    chosen = owlets.find((owlet) => owlet.compliancy === needed);
  }
  if (!chosen) {
    const versions = owlets.map((owlet) => owlet.compliancy).filter((value) => value !== undefined).join(", ") || "unknown";
    throw new Error(`This log uses .hoot format version ${needed}, but the Owlet versions found are ${versions}. Opening the log once in AdvantageScope downloads the matching Owlet, or get it from ${owletDownloadUrl}.`);
  }

  try {
    await execFileAsync(chosen.path, [hootPath, outputPath, "-f", "wpilog"], { windowsHide: true, timeout: 180000, maxBuffer: 1024 * 1024 * 16 });
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error && String(error.stderr).trim()
      ? String(error.stderr).trim()
      : error instanceof Error ? error.message : String(error);
    throw new Error(`Owlet couldn't convert ${path.basename(hootPath)}: ${detail}`);
  }
  return { owlet: chosen.path, compliancy: chosen.compliancy };
}
