import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";

const project = fileURLToPath(new URL("..", import.meta.url));
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-actions-"));
const root = path.join(fixture, "robot's project with spaces");
await fs.mkdir(path.join(root, "build/libs"), { recursive: true });
const module = path.join(fixture, "actions.mjs");
await build({ entryPoints: [path.join(project, "electron/robotActions.ts")], bundle: true, platform: "node", format: "esm", outfile: module });
const { runRobotAction, simulationLaunch, robotEnvironment } = await import(pathToFileURL(module).href);
await fs.writeFile(path.join(root, "build.gradle"), 'plugins { id "edu.wpi.first.GradleRIO" version "2026.2.1" }');
await fs.writeFile(path.join(root, "gradlew.bat"), '@echo off\r\necho %*>>build\\calls.txt\r\necho %JAVA_HOME%>build\\java-home.txt\r\nif exist fail-build exit /b 7\r\necho BUILD SUCCESSFUL\r\nexit /b 0\r\n');
const calls = async () => (await fs.readFile(path.join(root, "build/calls.txt"), "utf8")).trim().split(/\r?\n/);
const clear = () => fs.writeFile(path.join(root, "build/calls.txt"), "");
await runRobotAction(root, "build"); assert.deepEqual(await calls(), ["--no-daemon --console=plain build"]);
assert.ok((await fs.readFile(path.join(root, "build/java-home.txt"), "utf8")).includes("2026"));
await clear(); await runRobotAction(root, "deploy");
assert.deepEqual(await calls(), ["--no-daemon --console=plain build", "--no-daemon --console=plain deploy"]);
await fs.writeFile(path.join(root, "fail-build"), ""); await clear();
await assert.rejects(() => runRobotAction(root, "deploy")); assert.equal((await calls()).length, 1, "A failed build never deploys");
await clear(); await assert.rejects(() => runRobotAction(root, "sim-ds")); assert.equal((await calls()).length, 1, "A failed build never launches simulation");
await fs.rm(path.join(root, "fail-build"));
await assert.rejects(() => runRobotAction(root, "deploy; arbitrary-command"), /Unknown robot action/);

const native = path.join(root, "native"); await fs.mkdir(native); await fs.mkdir(path.join(root, "build/sim"));
for (const name of ["halsim_gui.dll", "halsim_ds_socket.dll"]) await fs.writeFile(path.join(native, name), "");
const info = [{ type: "java", mainClassName: "ActionFixture", libraryDir: native, environment: {}, extensions: [
  { name: "Sim GUI", libName: path.join(native, "halsim_gui.dll"), defaultEnabled: false },
  { name: "Use Real DriverStation", libName: path.join(native, "halsim_ds_socket.dll"), defaultEnabled: true }
] }];
const infoPath = path.join(root, "build/sim/release_java.json"); await fs.writeFile(infoPath, JSON.stringify(info));
const env = await robotEnvironment(root);
const javaHome = env.JAVA_HOME;
const source = path.join(fixture, "ActionFixture.java");
await fs.writeFile(source, `public class ActionFixture { public static void main(String[] args) throws Exception {
  java.nio.file.Files.writeString(java.nio.file.Path.of("build/simulation-env.txt"), System.getenv("HALSIM_EXTENSIONS"));
  Thread.sleep(1800);
} }`);
const compiled = spawnSync(path.join(javaHome, "bin/javac.exe"), ["-d", fixture, source], { encoding: "utf8" });
assert.equal(compiled.status, 0, compiled.stderr);
const jar = spawnSync(path.join(javaHome, "bin/jar.exe"), ["--create", "--file", path.join(root, "build/libs/robot.jar"), "-C", fixture, "ActionFixture.class"], { encoding: "utf8" });
assert.equal(jar.status, 0, jar.stderr);
assert.ok((await simulationLaunch(root, true, env)).env.HALSIM_EXTENSIONS.includes("halsim_ds_socket"));
assert.ok(!(await simulationLaunch(root, false, env)).env.HALSIM_EXTENSIONS.includes("halsim_ds_socket"), "Without DS overrides a project's DS-enabled default");
for (const action of ["sim-ds", "sim-no-ds"]) {
  await clear(); const result = await runRobotAction(root, action); assert.equal(result.started, true);
  assert.deepEqual(await calls(), ["--no-daemon --console=plain build simulateExternalJavaRelease"]);
  assert.equal((await fs.readFile(path.join(root, "build/simulation-env.txt"), "utf8")).includes("halsim_ds_socket"), action === "sim-ds");
  await assert.rejects(() => runRobotAction(root, action), /already running/);
  await new Promise(resolve => setTimeout(resolve, 1100));
}
info[0].mainClassName = "MissingMain"; await fs.writeFile(infoPath, JSON.stringify(info));
await assert.rejects(() => runRobotAction(root, "sim-no-ds"), /exited during startup/);
console.log("Robot actions passed: build-before-deploy/simulation, failure gates, WPILib JDK, spaced paths, explicit DS selection, background launch, duplicate protection and startup errors. No robot deployment was performed.");
