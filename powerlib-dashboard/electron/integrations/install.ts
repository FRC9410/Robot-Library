import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { isMissing } from "./catalog.js";
import type { Integration } from "./catalog.js";

const run = promisify(execFile);

async function git(cwd: string, args: string[], signal: AbortSignal) {
  try {
    const result = await run("git", args, {
      cwd, signal, windowsHide: true, timeout: 120_000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "Never" }
    });
    return result.stdout.trim();
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & { stderr?: string };
    if (failure.code === "ENOENT") throw new Error("Install Git and make sure it is on PATH, then retry.");
    throw new Error(failure.stderr?.trim() || failure.message);
  }
}

export async function isInstalled(directory: string) {
  try {
    return (await fs.lstat(directory)).isDirectory()
      && (await fs.stat(path.join(directory, "pyproject.toml"))).isFile()
      && (await fs.stat(path.join(directory, "uv.lock"))).isFile();
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

export async function migrateLegacyInstallation(directory: string) {
  const parent = path.dirname(directory);
  const legacy = path.join(parent, "installed", path.basename(directory));
  if (await isInstalled(directory) || !await isInstalled(legacy)) return;
  if (path.relative(legacy, await fs.realpath(legacy)) !== "") {
    throw new Error("The previous integration folder must be inside this robot project.");
  }
  try {
    await fs.lstat(directory);
    throw new Error(`Move the existing folder at ${directory} before migrating the integration.`);
  } catch (error) { if (!isMissing(error)) throw error; }

  // Virtual environment launchers refer to the old absolute path. Keep the old
  // environment under a backup name so uv builds a new one on the next start.
  const environment = path.join(legacy, ".venv");
  const backup = path.join(legacy, `.venv-before-move-${randomUUID()}`);
  let backedUp = false;
  try {
    try { await fs.rename(environment, backup); backedUp = true; }
    catch (error) { if (!isMissing(error)) throw error; }
    await fs.rename(legacy, directory);
  } catch (error) {
    if (isMissing(error) && await isInstalled(directory)) return;
    if (backedUp) await fs.rename(backup, environment);
    throw error;
  }
}

export async function installIntegration(integration: Integration, directory: string, signal: AbortSignal) {
  const parent = path.dirname(directory);
  await fs.mkdir(parent, { recursive: true });
  // Stage under the destination's real parent so publication is an atomic rename.
  const realParent = await fs.realpath(parent);
  if (path.relative(path.resolve(parent), realParent) !== "") throw new Error("The integration folder must be inside this robot project.");
  if (await isInstalled(directory)) return;

  const stage = await fs.mkdtemp(path.join(realParent, ".install-"));
  try {
    await git(stage, ["init", "--quiet", "--template="], signal);
    await git(stage, ["fetch", "--quiet", "--depth=1", "--no-tags", "--", integration.repository, integration.revision], signal);
    await git(stage, ["-c", "core.hooksPath=", "-c", "core.symlinks=false", "checkout", "--quiet", "--detach", "FETCH_HEAD"], signal);
    if (!await isInstalled(stage)) throw new Error("The downloaded revision is missing pyproject.toml or uv.lock.");
    signal.throwIfAborted();
    await fs.rm(path.join(stage, ".git"), { recursive: true, force: true });
    await fs.rename(stage, directory);
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
