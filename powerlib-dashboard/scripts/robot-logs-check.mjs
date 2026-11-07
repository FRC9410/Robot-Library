import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build } from "esbuild";
import { startFakeRobot } from "./fake-robot.mjs";

// Usage: node scripts/robot-logs-check.mjs
// Runs Get logs from robot's Electron code (electron/robotLogs.ts) against the fake robot: find, log in, list, download, delete.
const root = fileURLToPath(new URL("..", import.meta.url));
const bundlePath = path.join(root, "node_modules", ".cache", "robot-logs-check", "robotLogs.mjs");
await build({ entryPoints: [path.join(root, "electron", "robotLogs.ts")], bundle: true, format: "esm", platform: "node",
  packages: "external", outfile: bundlePath, logLevel: "error" });

const work = fs.mkdtempSync(path.join(os.tmpdir(), "power-tool-robot-"));
const robotFolder = path.join(work, "robot");
const localFolder = path.join(work, "laptop");
const write = (relative, size) => {
  const file = path.join(robotFolder, relative);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, Buffer.from(Array.from({ length: size }, (_, index) => index % 251)));
};
write("2026-04-03_14-15-37/rio_2026-04-03_14-15-42.hoot", 70_000);
write("2026-04-03_14-15-37/9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-15-42.hoot", 300_000);
write("KSLA_Q6_rio_2026-03-20_14-39-56.hoot", 5_000);
write("notes.txt", 10);

const server = await startFakeRobot(robotFolder, 2299);
try {
  process.env.POWERLIB_ROBOT = "127.0.0.1:2299";
  const robot = await import(pathToFileURL(bundlePath).href);

  assert.equal(await robot.findRobot(), "127.0.0.1", "Finds the robot at POWERLIB_ROBOT");
  const listed = await robot.listRobotLogs();
  assert.equal(listed.username, "lvuser", "Logs in with the roboRIO's default login");
  assert.deepEqual(listed.files.map(file => file.path).sort(), [
    "/U/logs/2026-04-03_14-15-37/9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-15-42.hoot",
    "/U/logs/2026-04-03_14-15-37/rio_2026-04-03_14-15-42.hoot",
    "/U/logs/KSLA_Q6_rio_2026-03-20_14-39-56.hoot"
  ], "Lists .hoot files at the top and one folder down, and nothing else");
  assert.equal(listed.files.find(file => file.name.startsWith("rio_")).size, 70_000);

  const downloads = [
    { remotePath: "/U/logs/2026-04-03_14-15-37/rio_2026-04-03_14-15-42.hoot", localFolder: "Shop/2026-04-03 14-15" },
    { remotePath: "/U/logs/2026-04-03_14-15-37/9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-15-42.hoot", localFolder: "Shop/2026-04-03 14-15" }
  ];
  const progress = [];
  const saved = await robot.downloadRobotLogs(downloads, localFolder, step => progress.push(step));
  assert.equal(saved.length, 2);
  for (const file of saved) {
    const original = path.join(robotFolder, "2026-04-03_14-15-37", file.name);
    assert.ok(fs.readFileSync(file.path).equals(fs.readFileSync(original)), `${file.name} downloads byte for byte`);
  }
  assert.equal(saved[0].folder, "Shop/2026-04-03 14-15");
  assert.deepEqual(progress.at(-1), { done: 370_000, total: 370_000, file: saved[1].name }, "Progress ends at the total");
  assert.ok(!fs.readdirSync(path.join(localFolder, "Shop", "2026-04-03 14-15")).some(name => name.endsWith(".part")), "No .part files left");

  const before = fs.statSync(saved[0].path).mtimeMs;
  await new Promise(resolve => setTimeout(resolve, 20));
  await robot.downloadRobotLogs(downloads.slice(0, 1), localFolder, () => {});
  assert.equal(fs.statSync(saved[0].path).mtimeMs, before, "A file already there at the same size isn't copied again");

  assert.ok(robot.isRobotLogPath("/U/logs/KSLA_Q6_rio_2026-03-20_14-39-56.hoot"), "A log at the top of a log folder can be deleted");
  assert.ok(robot.isRobotLogPath("/home/lvuser/logs/run/a.wpilog"), "A log one folder down can be deleted");
  for (const bad of ["/U/logs/notes.txt", "/U/logs/../etc/passwd.hoot", "/etc/a.hoot", "/U/logs/a/b/c.hoot", "/U/logs/", "/U/logsX/a.hoot", "/U/logs//a.hoot"]) {
    assert.ok(!robot.isRobotLogPath(bad), `${bad} can't be deleted`);
  }
  await assert.rejects(robot.deleteRobotLogs(["/U/logs/notes.txt"]), /Not a robot log file/, "Delete refuses anything that isn't a robot log");
  assert.ok(fs.existsSync(path.join(robotFolder, "notes.txt")));

  const run = "/U/logs/2026-04-03_14-15-37";
  const removed = await robot.deleteRobotLogs([
    `${run}/rio_2026-04-03_14-15-42.hoot`, `${run}/9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-15-42.hoot`, "/U/logs/gone.hoot"
  ]);
  assert.deepEqual(removed.deleted, [`${run}/rio_2026-04-03_14-15-42.hoot`, `${run}/9F61CEC3394C4853202020503F0E19FF_2026-04-03_14-15-42.hoot`]);
  assert.deepEqual(removed.failed.map(item => item.path), ["/U/logs/gone.hoot"], "A missing file is reported, not thrown");
  assert.ok(!fs.existsSync(path.join(robotFolder, "2026-04-03_14-15-37")), "The run's folder goes once it's empty");
  assert.deepEqual((await robot.listRobotLogs()).files.map(file => file.name), ["KSLA_Q6_rio_2026-03-20_14-39-56.hoot"], "Only the other run is left");
  assert.ok(fs.existsSync(path.join(robotFolder, "notes.txt")), "Other files on the robot are left alone");
  assert.ok(fs.existsSync(saved[0].path), "Deleting from the robot leaves the downloaded copy");

  process.env.POWERLIB_ROBOT = "127.0.0.1:2298";
  assert.equal(await robot.findRobot(500), null, "Nothing answering means no robot");
  await assert.rejects(robot.listRobotLogs(), /Can't reach the robot/);
} finally {
  server.close();
  fs.rmSync(work, { recursive: true, force: true });
}
console.log("robot-logs-check passed");
