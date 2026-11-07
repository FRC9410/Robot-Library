import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const result = await build({ entryPoints: [fileURLToPath(new URL("../src/features/dashboard/mechanismTunables.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const { canTuneMechanism, mechanismTuningChanges, mechanismTuningValues } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
const topic = (owner, key, value = 1, type = "double") => ({ name: `/PowerLib/Subsystems/${owner}/Variables/${key}`, value, type });
const values = [topic("Intake", "PID/kP"), topic("Shooter", "PID/kP", 9), topic("Intake", "Control/FOCEnabled", true, "boolean"),
  topic("Intake", "Custom/EXTRA"), topic("Intake", "Feedforward/Torque")];
assert.equal(mechanismTuningValues("Intake", []).length, 9);
assert.equal(mechanismTuningValues("Intake", values).length, 10);
assert.ok(mechanismTuningValues("Intake", values).every(row => !["Control", "Ratios"].includes(row.group)));
assert.equal(mechanismTuningValues("Intake", values).filter(row => row.writable).length, 2);
const edits = mechanismTuningChanges("Intake", values, { "PID/kP": "2.5", "Control/FOCEnabled": "false", "Custom/EXTRA": "7", "Feedforward/Torque": "9" });
assert.deepEqual(edits.errors, {});
assert.deepEqual(edits.changes.map(change => [change.topic.name, change.value]), [
  ["/PowerLib/Subsystems/Intake/Variables/PID/kP", 2.5], ["/PowerLib/Subsystems/Intake/Variables/Custom/EXTRA", 7]
]);
assert.equal(mechanismTuningChanges("Intake", values, { "PID/kP": "" , "Control/FOCEnabled": "false" }).changes.length, 0, "An invalid field blocks the whole apply");
assert.ok(mechanismTuningChanges("Intake", values, { "PID/kI": "3" }).errors["PID/kI"], "Do not create absent robot variables");
assert.ok(mechanismTuningChanges("Intake", [topic("Intake", "PID/kP", "1", "string")], { "PID/kP": "2" }).errors["PID/kP"]);
assert.ok(mechanismTuningChanges("Intake", [topic("Intake", "PID/kP", 1, "int")], { "PID/kP": "2.5" }).errors["PID/kP"]);
for (const value of ["NaN", "Infinity", "bad"]) assert.ok(mechanismTuningChanges("Intake", values, { "PID/kP": value }).errors["PID/kP"]);
for (const owner of ["Drive", "Swerve", "Drivetrain", "Vision", "LED", "leds"]) {
  assert.equal(canTuneMechanism(owner), false);
  assert.equal(mechanismTuningChanges(owner, [topic(owner, "PID/kP")], { "PID/kP": "2" }).changes.length, 0);
}
assert.equal(canTuneMechanism("IntakeWrist"), true);
const custom = mechanismTuningChanges("Intake", [topic("Intake", "Custom/ENABLED", false, "boolean"), topic("Intake", "Custom/LABEL", "old", "string"),
  topic("Intake", "Custom/ARRAY", [1], "double[]"), topic("Shooter", "Custom/FOREIGN", 1)], { "Custom/ENABLED": "true", "Custom/LABEL": "ready" });
assert.deepEqual(custom.changes.map(change => [change.type, change.value]), [["boolean", true], ["string", "ready"]]);
assert.equal(mechanismTuningValues("Intake", [topic("Shooter", "Custom/FOREIGN")]).filter(row => row.group === "Custom").length, 0);
assert.equal(mechanismTuningValues("Intake", [topic("Intake", "Custom/ARRAY", [1], "double[]")]).filter(row => row.group === "Custom").length, 0);
const sensors = [topic("Shooter", "Cancoder/MagnetOffset", 0.1), topic("Shooter", "Cancoder/DiscontinuityPoint", 0.5)];
assert.equal(mechanismTuningValues("Intake", sensors).filter(row => row.group === "Sensor").length, 0, "Foreign sensor topics do not add a section");
assert.equal(mechanismTuningValues("Shooter", sensors).filter(row => row.group === "Sensor" && row.writable).length, 2);
const partialSensor = mechanismTuningValues("Shooter", sensors.slice(0, 1)).filter(row => row.group === "Sensor");
assert.equal(partialSensor.length, 2);
assert.equal(partialSensor[1].writable, false, "Missing sensor settings stay unavailable");
assert.equal(mechanismTuningValues("Intake", [topic("Intake", "Cancoder/Unknown")]).filter(row => row.group === "Sensor").length, 0);
const sensorEdits = mechanismTuningChanges("Shooter", sensors, { "Cancoder/MagnetOffset": "-0.25", "Cancoder/DiscontinuityPoint": "1" });
assert.deepEqual(sensorEdits.errors, {});
assert.deepEqual(sensorEdits.changes.map(change => [change.topic.name, change.value]), [
  ["/PowerLib/Subsystems/Shooter/Variables/Cancoder/MagnetOffset", -0.25],
  ["/PowerLib/Subsystems/Shooter/Variables/Cancoder/DiscontinuityPoint", 1]
]);
console.log("Mechanism tuning checks passed: nine shared settings, conditional owner-scoped Sensor and Custom sections, typed edits, atomic validation, missing topics and excluded cards.");
