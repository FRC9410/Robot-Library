import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import ssh2 from "ssh2";
import type { FileEntry, SFTPWrapper } from "ssh2";

/** Where the robot answers: radio IP, roboRIO mDNS, Systemcore mDNS, roboRIO over USB. */
const robotHosts = ["10.94.10.2", "roborio-9410-frc.local", "robot.local", "172.22.11.2"];

/**
 * The addresses to try. `POWERLIB_ROBOT` ("host" or "host:port") replaces them, to test against the fake robot
 * (`node scripts/fake-robot.mjs`, which listens on 127.0.0.1:2222).
 */
function robotAddresses() {
  const override = process.env.POWERLIB_ROBOT?.trim();
  return (override ? [override] : robotHosts).map((address) => {
    const [host, port] = address.split(":");
    return { host, port: Number(port) || 22 };
  });
}
type RobotAddress = ReturnType<typeof robotAddresses>[number];

/** Default logins: the roboRIO's (no password), then Systemcore's (WPILib docs, "Systemcore SFTP"). */
const logins = [
  { username: "lvuser", password: "" },
  { username: "admin", password: "" },
  { username: "systemcore", password: "systemcore" }
];

/** Folders robot logs land in: a USB stick, then internal storage on the roboRIO and Systemcore. */
const logFolders = ["/U/logs", "/u/logs", "/media/sda1/logs", "/home/lvuser/logs", "/home/systemcore/logs"];

const isLogName = (name: string) => /\.(wpilog|hoot)$/i.test(name);
const isFolder = (entry: FileEntry) => (entry.attrs.mode & 0o170000) === 0o040000;
const isFile = (entry: FileEntry) => (entry.attrs.mode & 0o170000) === 0o100000;

/** True when something answers on the SSH port at `address` within `timeoutMs`. */
function answers(address: RobotAddress, timeoutMs: number) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(address);
    const finish = (ok: boolean) => { socket.destroy(); resolve(ok); };
    socket.setTimeout(timeoutMs, () => finish(false));
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
  });
}

async function findAddress(timeoutMs: number) {
  const addresses = robotAddresses();
  const results = await Promise.all(addresses.map((address) => answers(address, timeoutMs)));
  return addresses.find((_address, index) => results[index]) ?? null;
}

/** The first robot address that answers on SSH, or null. All are tried at once. */
export async function findRobot(timeoutMs = 1500) {
  return (await findAddress(timeoutMs))?.host ?? null;
}

type Session = { sftp: SFTPWrapper; close: () => void; host: string; username: string };

function connect({ host, port }: RobotAddress, login: { username: string; password: string }) {
  return new Promise<Session>((resolve, reject) => {
    const client = new ssh2.Client();
    client.once("ready", () => client.sftp((error, sftp) => {
      if (error) { client.end(); reject(error); return; }
      resolve({ sftp, close: () => client.end(), host, username: login.username });
    }));
    client.once("error", (error) => { client.end(); reject(error); });
    // An empty password is sent through keyboard-interactive too, which some SSH servers require.
    client.on("keyboard-interactive", (_name, _instructions, _lang, prompts, finish) => finish(prompts.map(() => login.password)));
    client.connect({ host, port, ...login, tryKeyboard: true, readyTimeout: 6000 });
  });
}

/** Logs in to the robot with the first default login that works. */
async function openSession() {
  const address = await findAddress(1500);
  if (!address) throw new Error("Can't reach the robot. Turn it on and connect to its radio or USB.");
  let lastError: unknown;
  for (const login of logins) {
    try {
      return await connect(address, login);
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error(`The robot at ${address.host} didn't accept its default logins (${lastError instanceof Error ? lastError.message : String(lastError)}).`);
}

const readDirectory = (sftp: SFTPWrapper, folder: string) =>
  new Promise<FileEntry[]>((resolve) => sftp.readdir(folder, (error, list) => resolve(error ? [] : list)));

/** Every .hoot and .wpilog in the robot's log folders, one level of subfolders deep (Phoenix makes one per run). */
export async function listRobotLogs() {
  const session = await openSession();
  try {
    const files: { path: string; folder: string; name: string; modifiedMs: number; size: number }[] = [];
    const seen = new Set<string>();
    for (const root of logFolders) {
      for (const entry of await readDirectory(session.sftp, root)) {
        const full = `${root}/${entry.filename}`;
        if (isFolder(entry)) {
          for (const inner of await readDirectory(session.sftp, full)) {
            if (isFile(inner) && isLogName(inner.filename)) {
              files.push({ path: `${full}/${inner.filename}`, folder: full, name: inner.filename, modifiedMs: inner.attrs.mtime * 1000, size: inner.attrs.size });
            }
          }
        } else if (isFile(entry) && isLogName(entry.filename)) {
          files.push({ path: full, folder: root, name: entry.filename, modifiedMs: entry.attrs.mtime * 1000, size: entry.attrs.size });
        }
      }
    }
    // /U and /u can be the same drive; keep each file once.
    const unique = files.filter((file) => {
      const key = `${file.name}|${file.size}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return { host: session.host, username: session.username, files: unique };
  } finally {
    session.close();
  }
}

/** True for a .hoot or .wpilog inside one of the robot's log folders (or one subfolder down), and nothing else. */
export function isRobotLogPath(remotePath: string) {
  if (remotePath.includes("\\") || remotePath.split("/").includes("..")) return false;
  return logFolders.some((root) => {
    if (!remotePath.startsWith(`${root}/`)) return false;
    const rest = remotePath.slice(root.length + 1).split("/");
    return rest.length <= 2 && rest.every(Boolean) && isLogName(rest[rest.length - 1]);
  });
}

/**
 * Deletes log files from the robot. Only log files in its log folders are touched; a run's subfolder is removed
 * too once it's empty. Returns the paths that were deleted and the ones that failed, with why.
 */
export async function deleteRobotLogs(remotePaths: string[]) {
  const bad = remotePaths.find((remotePath) => !isRobotLogPath(remotePath));
  if (bad) throw new Error(`Not a robot log file: ${bad}`);
  const session = await openSession();
  try {
    const deleted: string[] = [];
    const failed: { path: string; error: string }[] = [];
    for (const remotePath of remotePaths) {
      await new Promise<void>((resolve) => session.sftp.unlink(remotePath, (error) => {
        if (error) failed.push({ path: remotePath, error: error.message }); else deleted.push(remotePath);
        resolve();
      }));
    }
    const runFolders = new Set(deleted.map((remotePath) => path.posix.dirname(remotePath)).filter((folder) => !logFolders.includes(folder)));
    for (const folder of runFolders) {
      if ((await readDirectory(session.sftp, folder)).length === 0) {
        await new Promise<void>((resolve) => session.sftp.rmdir(folder, () => resolve()));
      }
    }
    return { deleted, failed };
  } finally {
    session.close();
  }
}

export type RobotDownload = { remotePath: string; localFolder: string };

/**
 * Copies robot files into `localRoot`, each into its `localFolder` (relative), skipping files already there
 * at the same size. Reports progress in bytes. Returns the local files as the logs list sees them.
 */
export async function downloadRobotLogs(downloads: RobotDownload[], localRoot: string,
  onProgress: (progress: { done: number; total: number; file: string }) => void) {
  const session = await openSession();
  try {
    const sizes = await Promise.all(downloads.map((item) => new Promise<number>((resolve) =>
      session.sftp.stat(item.remotePath, (error, stats) => resolve(error ? 0 : stats.size)))));
    const total = sizes.reduce((sum, size) => sum + size, 0);
    let finished = 0;
    const saved = [];
    for (const [index, item] of downloads.entries()) {
      const name = path.posix.basename(item.remotePath);
      const folder = path.join(localRoot, item.localFolder);
      const localPath = path.join(folder, name);
      await fs.mkdir(folder, { recursive: true });
      const existing = await fs.stat(localPath).catch(() => null);
      if (!existing || existing.size !== sizes[index]) {
        const partial = `${localPath}.part`;
        await new Promise<void>((resolve, reject) => session.sftp.fastGet(item.remotePath, partial, {
          step: (transferred) => onProgress({ done: finished + transferred, total, file: name })
        }, (error) => (error ? reject(error) : resolve())));
        await fs.rename(partial, localPath);
      }
      finished += sizes[index];
      onProgress({ done: finished, total, file: name });
      const stats = await fs.stat(localPath);
      saved.push({ path: localPath, folder: item.localFolder, name, modifiedMs: stats.mtimeMs, size: stats.size });
    }
    return saved;
  } finally {
    session.close();
  }
}
