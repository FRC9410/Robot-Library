import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const bundle = await build({ entryPoints: [fileURLToPath(new URL("../electron/stateFiles.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const { readStateConfig, saveStateConfig } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`);
const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "power-tool-state-config-"));
try {
  assert.deepEqual((await readStateConfig(fixture)).config.states, ["IDLE"]);
  const directory = path.join(fixture, "src/main/java/frc/robot/subsystems");
  await fs.mkdir(directory, { recursive: true });
  const machine = path.join(directory, "StateMachine.java");
  await fs.writeFile(machine, 'class StateMachine { enum RobotState { IDLE, /* old state: TEST */ READY, // comment\n SHOOTING; } }');
  const initial = await readStateConfig(fixture);
  assert.deepEqual(initial.config.states, ["IDLE", "READY", "SHOOTING"]);
  const otherSections = { subsystems: [{ name: "Intake" }], vision: { fovDegrees: 60 }, swerve: { heading: { kP: 7 } } };
  await fs.writeFile(initial.path, JSON.stringify(otherSections));
  const config = { states: ["IDLE", "HOMING"] };
  await saveStateConfig(fixture, config);
  assert.deepEqual((await readStateConfig(fixture)).config, config);
  assert.deepEqual(JSON.parse(await fs.readFile(initial.path, "utf8")), { ...otherSections, states: config.states });
  for (const states of [[], ["IDLE", "IDLE"], ["idle"], ["1_READY"], ["READY STATE"], ["READY-STATE"], [null]]) {
    await assert.rejects(saveStateConfig(fixture, { states }));
  }
  assert.deepEqual((await readStateConfig(fixture)).config, config, "Invalid edits preserve the saved list");
  await fs.writeFile(initial.path, "{broken");
  await assert.rejects(saveStateConfig(fixture, config));
  assert.equal(await fs.readFile(initial.path, "utf8"), "{broken", "Do not overwrite corrupt project configuration");
  await fs.writeFile(initial.path, JSON.stringify(otherSections));
  await fs.writeFile(machine, 'class StateMachine { enum RobotState { IDLE(1); RobotState(int value) {} } }');
  await assert.rejects(readStateConfig(fixture), /RobotState/);
  console.log("State config checks passed: Java enum import, default state, project persistence, unrelated settings preservation, names, duplicates and failed saves.");
} finally {
  if (path.dirname(fixture) === path.resolve(os.tmpdir()) && path.basename(fixture).startsWith("power-tool-state-config-")) await fs.rm(fixture, { recursive: true, force: true });
}
