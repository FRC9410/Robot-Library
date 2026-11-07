import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
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
const configurations = [{ name: "Flywheel", type: "velocityTorque" }, { name: "Intake", type: "velocity" }];
const specializedTopics = [topic("Flywheel", "Feedforward/Torque", 3.5), topic("Intake", "Feedforward/Torque", 99), topic("Shooter", "Position/Default", .25)];
assert.ok(mechanismTuningValues("Flywheel", specializedTopics, configurations).some(row => row.key === "Feedforward/Torque" && row.writable));
assert.ok(mechanismTuningValues("Intake", specializedTopics, configurations).every(row => row.key !== "Feedforward/Torque"), "Ordinary velocity subsystems hide Torque FF even when its topic exists");
assert.ok(mechanismTuningValues("Flywheel", specializedTopics).every(row => row.key !== "Feedforward/Torque"), "A torque topic alone cannot identify the control type");
assert.equal(mechanismTuningValues("Shooter", specializedTopics).find(row => row.key === "Position/Default").group, "Position");
assert.ok(mechanismTuningValues("Intake", specializedTopics, configurations).every(row => row.key !== "Position/Default"), "Default position is scoped to the publishing owner");
const torqueEdit = mechanismTuningChanges("Flywheel", specializedTopics, { "Feedforward/Torque": "6" }, configurations);
assert.deepEqual(torqueEdit.errors, {});
assert.deepEqual(torqueEdit.changes.map(change => [change.topic.name, change.value]), [["/PowerLib/Subsystems/Flywheel/Variables/Feedforward/Torque", 6]]);
assert.ok(mechanismTuningChanges("Flywheel", [], { "Feedforward/Torque": "6" }, configurations).errors["Feedforward/Torque"], "Missing torque variables stay unavailable");
const positionEdit = mechanismTuningChanges("Shooter", specializedTopics, { "Position/Default": ".5" });
assert.deepEqual(positionEdit.changes.map(change => [change.topic.name, change.value]), [["/PowerLib/Subsystems/Shooter/Variables/Position/Default", .5]]);
assert.ok(mechanismTuningChanges("Shooter", specializedTopics, { "Position/Default": "" }).errors["Position/Default"]);
const driveBundle = await build({ entryPoints: [fileURLToPath(new URL("../src/features/dashboard/drivetrainTunables.ts", import.meta.url))], bundle: true, write: false, format: "esm", platform: "node" });
const { drivetrainSettings, drivetrainTuningChanges, drivetrainTuningValues } = await import(`data:text/javascript;base64,${Buffer.from(driveBundle.outputFiles[0].contents).toString("base64")}`);
const swerveSource = readFileSync(new URL("../../templates/replacements/src/main/java/frc/robot/subsystems/Swerve.java", import.meta.url), "utf8");
const registered = [...swerveSource.matchAll(/setSubsystemVariableDefault\(\s*kTuningSubsystemName,\s*"([^"]+)"/g)].map(match => match[1]);
assert.deepEqual(drivetrainSettings.map(row => row.key).sort(), registered.sort(), "Dashboard covers every drivetrain setting registered by the robot");
const driveTopics = drivetrainSettings.map(row => topic("Swerve", row.key));
assert.equal(drivetrainTuningValues(driveTopics).filter(row => row.writable).length, 15);
assert.deepEqual([...new Set(drivetrainTuningValues(driveTopics).map(row => row.group))], ["Driver", "Requests", "Drive to Point", "Heading PID", "Localization"]);
assert.equal(drivetrainTuningValues([topic("Drive", "Heading/kP")]).filter(row => row.writable).length, 0, "Drive telemetry owner is not the tuning owner");
assert.ok(drivetrainTuningValues([topic("Swerve", "Custom/EXTRA")]).some(row => row.group === "Custom"));
assert.ok(drivetrainTuningValues([topic("Intake", "Custom/EXTRA")]).every(row => row.group !== "Custom"));
const driveEdits = drivetrainTuningChanges(driveTopics, { "Driver/VelocityScale": "0.8", "Requests/TranslationDeadbandMetersPerSecond": "0.2", "DriveToPoint/SlowSpeedCoefficient": "0.15", "Heading/kP": "7" });
assert.deepEqual(driveEdits.errors, {});
assert.equal(driveEdits.changes.length, 4);
assert.ok(driveEdits.changes.every(change => change.topic.name.startsWith("/PowerLib/Subsystems/Swerve/Variables/")));
assert.equal(drivetrainTuningChanges(driveTopics, { "Driver/VelocityScale": "", "Heading/kP": "7" }).changes.length, 0);
assert.ok(drivetrainTuningChanges([], { "Driver/VelocityScale": "0.8" }).errors["Driver/VelocityScale"]);
assert.ok(drivetrainTuningChanges([topic("Swerve", "Heading/kP", "1", "string")], { "Heading/kP": "2" }).errors["Heading/kP"]);
const locationTopics = [topic("Vision", "Position/TargetAreaThreshold", 0), topic("Vision", "Position/MaxTargetDistanceMeters", 6.25)];
const locationEdits = drivetrainTuningChanges([...driveTopics, ...locationTopics], { "Heading/kP": "7", "Position/TargetAreaThreshold": "1", "Position/MaxTargetDistanceMeters": "5" });
assert.deepEqual(locationEdits.errors, {});
assert.deepEqual(locationEdits.changes.map(change => [change.topic.name, change.value]), [
  ["/PowerLib/Subsystems/Swerve/Variables/Heading/kP", 7],
  ["/PowerLib/Subsystems/Vision/Variables/Position/TargetAreaThreshold", 1],
  ["/PowerLib/Subsystems/Vision/Variables/Position/MaxTargetDistanceMeters", 5]
]);
for (const area of ["-1", "101"]) assert.ok(drivetrainTuningChanges(locationTopics, { "Position/TargetAreaThreshold": area }).errors["Position/TargetAreaThreshold"]);
for (const distance of ["0", "-1"]) assert.ok(drivetrainTuningChanges(locationTopics, { "Position/MaxTargetDistanceMeters": distance }).errors["Position/MaxTargetDistanceMeters"]);
const headingTopics = [topic("Vision", "Heading/MaxTagDistanceMeters", 4), topic("Vision", "Heading/SingleTagMaxDistanceMeters", 2)];
const headingEdits = drivetrainTuningChanges(headingTopics, { "Heading/MaxTagDistanceMeters": "5", "Heading/SingleTagMaxDistanceMeters": "3" });
assert.deepEqual(headingEdits.errors, {});
assert.deepEqual(headingEdits.changes.map(change => [change.topic.name, change.value]), [
  ["/PowerLib/Subsystems/Vision/Variables/Heading/MaxTagDistanceMeters", 5],
  ["/PowerLib/Subsystems/Vision/Variables/Heading/SingleTagMaxDistanceMeters", 3]
]);
for (const key of ["Heading/MaxTagDistanceMeters", "Heading/SingleTagMaxDistanceMeters"]) {
  for (const value of ["0", "-1", "NaN"]) assert.ok(drivetrainTuningChanges(headingTopics, { [key]: value }).errors[key]);
}
assert.ok(drivetrainTuningChanges([], { "Position/MaxTargetDistanceMeters": "5" }).errors["Position/MaxTargetDistanceMeters"]);
console.log("Subsystem tuning checks passed: drivetrain registration coverage, owner-specific writes, mechanism settings, conditional Sensor/Custom sections, typed edits, atomic validation and missing topics.");
