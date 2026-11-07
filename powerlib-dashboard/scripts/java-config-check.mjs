import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readSubsystemDocument, saveSubsystemDocument, readStateConfig, saveStateConfig, readVisionConfig, saveVisionConfig, readLocalizationConfig, saveLocalizationConfig } from "../dist-electron/java-config/service.js";
import { readConstantsFiles, saveConstantsFile } from "../dist-electron/constantsFiles.js";
import { SourceProject, robotSource, stateMachinePath, sourceOperation, recoverSourceTransactions } from "../dist-electron/java-config/project.js";
import { maskJava, javaFields, literalValue, validateJava } from "../dist-electron/java-config/source.js";

const repository = fileURLToPath(new URL("../../", import.meta.url));
const root = process.env.POWERLIB_JAVA_FIXTURE || await fs.mkdtemp(path.join(repository, "build/java-config-check-"));
if (!path.resolve(root).toLowerCase().startsWith(path.join(repository, "build").toLowerCase() + path.sep)) throw Error("Source check fixture must stay under the repository build directory.");
const file = relative => path.join(root, robotSource, relative);
if (!await fs.stat(file("subsystems/StateMachine.java")).catch(() => null)) await fs.cp(path.join(repository, "templates/replacements/src/main/java/frc/robot"), file(""), { recursive: true });
const snapshot = async () => {
  const names = (await fs.readdir(file(""), { recursive: true })).filter(name => name.endsWith(".java"));
  return new Map(await Promise.all(names.map(async name => [name, await fs.readFile(file(name), "utf8")])));
};
const configuration = (name, type, id) => ({ id: name.toLowerCase(), name, type,
  motors: [{ role: "leader", id, motorType: "X44", neutralMode: "Brake", reversed: false }], focEnabled: true,
  pid: { kP: 1, kI: 0, kD: 0, kG: 0, kS: null, kV: 0, kA: 0 }, ratios: { sensorToMechanism: -1, rotorToSensor: 1 }, motionMagic: { cruiseVelocity: 1, acceleration: 2 },
  ...(type === "velocityTorque" ? { torqueFF: 3, statorCurrentLimitAmps: 35 } : {}),
  ...(type === "absolutePosition" ? { cancoder: { id: id + 1, magnetOffset: 0, discontinuityPoint: 0.5 }, absolutePosition: { units: "rotations", default: null } } : {}),
  ...(type === "relativePosition" ? { slowMotionMagic: { cruiseVelocity: 0.5, acceleration: 1 }, relativePosition: { units: "meters", homePosition: 0, forwardSoftLimit: 2, reverseSoftLimit: -1, slowThreshold: 0.5, tolerance: 0.01, stopVoltage: 0 } } : {}) });

let document = await readSubsystemDocument(root);
assert.equal(document.subsystems.length, 0);
for (const [index, type] of ["velocity", "velocityTorque", "absolutePosition", "relativePosition"].entries()) {
  document = await saveSubsystemDocument(root, [...document.subsystems, configuration(`Check${index}`, type, 10 + index * 5)], undefined, document.revision);
  assert.ok(!document.subsystems.some(data => data.sourceError), "Generated source is readable");
}
assert.deepEqual(document.subsystems.map(item => item.type), ["velocity", "velocityTorque", "absolutePosition", "relativePosition"]);
assert.equal(document.subsystems[0].pid.kS, null);
const customPath = file("constants/Check0Constants.java");
let custom = await fs.readFile(customPath, "utf8");
custom = custom.replace("\n}", '\n  // mécänisme code remains team-owned\n  public String customUrl() { return "http://example.test/{x}"; }\n}\n');
await fs.writeFile(customPath, custom);
document = await readSubsystemDocument(root);
const before = await snapshot();
document.subsystems[0].pid.kP = 7.25;
document = await saveSubsystemDocument(root, document.subsystems, undefined, document.revision);
const after = await snapshot();
assert.deepEqual([...after].filter(([name, contents]) => before.get(name) !== contents).map(([name]) => name.replaceAll("\\", "/")), ["constants/Check0Constants.java"], "One gain save touches only its constants file");
assert.equal(await fs.readFile(customPath, "utf8"), custom.replace("KP = 1.0;", "KP = 7.25;"));
const stale = structuredClone(document);
await fs.writeFile(customPath, (await fs.readFile(customPath, "utf8")).replace("KP = 7.25;", "KP = 8.0;"));
stale.subsystems[0].pid.kP = 9;
await assert.rejects(saveSubsystemDocument(root, stale.subsystems), /changed since/);
document = await readSubsystemDocument(root);
assert.equal(document.subsystems[0].pid.kP, 8);
document.subsystems[0].motors.push({ role: "follower", id: 11, motorType: "X60", neutralMode: "Coast", reversed: true });
document = await saveSubsystemDocument(root, document.subsystems);
assert.equal(document.subsystems[0].motors[1].neutralMode, "Coast");
assert.ok((await fs.readFile(customPath, "utf8")).includes("customUrl()"));

// Structural changes retain field annotations/modifiers and custom members.
let annotated = await fs.readFile(customPath, "utf8");
annotated = annotated.replace("public static final double KP", "@frc.powerlib.tuning.TunableConstant\n  public static volatile double KP");
await fs.writeFile(customPath, annotated);
document = await readSubsystemDocument(root);
document.subsystems[0].type = "velocityTorque";
document.subsystems[0].torqueFF = 4;
document = await saveSubsystemDocument(root, document.subsystems);
assert.equal(document.subsystems[0].type, "velocityTorque");
assert.ok((await fs.readFile(customPath, "utf8")).includes("public static volatile double KP"));
document.subsystems[0].type = "velocity";
document = await saveSubsystemDocument(root, document.subsystems);
assert.equal(document.subsystems[0].type, "velocity");
// Confirmed subsystem removal still checks handwritten references.
document = await saveSubsystemDocument(root,[...document.subsystems,configuration("CheckDelete","velocity",45)]);
const external = file("commands/ExternalMechanism.java");
await fs.writeFile(external,"class ExternalMechanism { Object x = frc.robot.Constants.CheckDelete.CONFIG; }");
await assert.rejects(saveSubsystemDocument(root,document.subsystems.filter(item=>item.id!=="checkdelete"),undefined,document.revision,["checkdelete"]),/still reference/);
await fs.rm(external);
document = await saveSubsystemDocument(root,document.subsystems.filter(item=>item.id!=="checkdelete"),undefined,document.revision,["checkdelete"]);
assert.equal(document.subsystems.length,4);

// A chain shared by two settings must not change both through one field edit.
const aliasBefore=await fs.readFile(customPath,"utf8");
const withAlias=aliasBefore.replace("public class Check0Constants {","public class Check0Constants {\n  public static final double SHARED_GAIN = 8.0;").replace("KP = 8.0;","KP = SHARED_GAIN;").replace("KI = 0.0;","KI = SHARED_GAIN;");
await fs.writeFile(customPath,withAlias);
document=await readSubsystemDocument(root);
document.subsystems[0].pid.kP=9;
document=await saveSubsystemDocument(root,document.subsystems);
assert.equal(document.subsystems[0].pid.kI,8,"Editing KP detaches its initializer from the shared alias");
assert.ok((await fs.readFile(customPath,"utf8")).includes("SHARED_GAIN = 8.0;"));
const directAlias=withAlias.replace("new LeadMotorConfig(KP, KI,","new LeadMotorConfig(SHARED_GAIN, SHARED_GAIN,");
assert.notEqual(directAlias,withAlias);
await fs.writeFile(customPath,directAlias);
document=await readSubsystemDocument(root);document.subsystems[0].pid.kP=9;
await assert.rejects(saveSubsystemDocument(root,document.subsystems),/share a Java initializer/);
assert.equal(await fs.readFile(customPath,"utf8"),directAlias);
await fs.writeFile(customPath,aliasBefore);

let states = await readStateConfig(root);
states = await saveStateConfig(root, { ...states.config, states: ["READY", "SHOOTING", "IDLE"] });
const handler = file("subsystems/states/ReadyState.java");
const handlerCode = (await fs.readFile(handler, "utf8")).replace("// TODO: implement READY actions and readiness conditions.", 'System.out.println("custom execute");');
await fs.writeFile(handler, handlerCode);
await saveStateConfig(root, { ...states.config, states: ["READY", "SHOOTING", "HOMING", "IDLE"] });
assert.equal(await fs.readFile(handler, "utf8"), handlerCode);
states = await readStateConfig(root);
await assert.rejects(saveStateConfig(root, { ...states.config, states: ["SHOOTING", "HOMING", "IDLE"] }), /Confirm deletion/);
const command = file("commands/ExternalState.java");
await fs.writeFile(command, "package frc.robot.commands; class ExternalState { Object request = frc.robot.subsystems.StateMachine.RobotState.READY; }");
await assert.rejects(saveStateConfig(root, { ...states.config, states: ["SHOOTING", "HOMING", "IDLE"], deleteHandlers: ["READY"] }), /still references/);
assert.equal(await fs.readFile(handler, "utf8"), handlerCode);
await fs.rm(command);
await saveStateConfig(root, { ...states.config, states: ["SHOOTING", "HOMING", "IDLE"], deleteHandlers: ["READY"] });
await assert.rejects(fs.access(handler));
states = await readStateConfig(root);
await saveStateConfig(root, { ...states.config, states: ["SHOOTING", "CLIMB", "IDLE"], renameHandlers: { HOMING: "CLIMB" } });
assert.ok((await fs.readFile(file("subsystems/states/ClimbState.java"), "utf8")).includes("RobotState.CLIMB"));
assert.equal((await readStateConfig(root)).config.states.at(-1), "IDLE");

// A custom handler must not gain an unconditional fallback that bypasses its guard.
const shot = file("subsystems/states/ShootingState.java");
const guarded = (await fs.readFile(shot,"utf8")).replaceAll("ShootingState","GuardedShotState").replace("requestedState == RobotState.SHOOTING", 'requestedState.name().equals("SHOOTING") && false');
await fs.writeFile(file("subsystems/states/GuardedShotState.java"),guarded);
await fs.rm(shot);
let machine = await fs.readFile(file("subsystems/StateMachine.java"),"utf8");
machine=machine.replaceAll("ShootingState","GuardedShotState").replace("SHOOTING,","MANUAL,\n    SHOOTING,");
await fs.writeFile(file("subsystems/StateMachine.java"),machine);
states=await readStateConfig(root);
assert.equal(states.repairable,false,"An opaque custom guard requires Java review");
await saveStateConfig(root,{...states.config,states:[...states.config.states.filter(item=>item!=="IDLE"),"NEW_STATE"]});
await assert.rejects(fs.access(shot));
assert.equal(await fs.readFile(file("subsystems/states/GuardedShotState.java"),"utf8"),guarded);
assert.ok(await fs.readFile(file("subsystems/states/NewStateState.java"),"utf8"),"New UI states still get a starter");
// Manually added states get a repair diagnostic and starter when registry is transparent.
await fs.writeFile(file("subsystems/states/GuardedShotState.java"),guarded.replace('requestedState.name().equals("SHOOTING") && false','requestedState == RobotState.SHOOTING && false'));
states=await readStateConfig(root);
assert.ok(states.diagnostics.some(message=>message.includes("MANUAL")));
await saveStateConfig(root,states.config);
assert.ok(await fs.readFile(file("subsystems/states/ManualState.java"),"utf8"));

let vision = await readVisionConfig(root);
vision = await saveVisionConfig(root, { ...vision.vision, limelights: [{ name: "limelight-front" }, { name: "limelight-back" }], fovDegrees: 63.4 });
assert.equal(vision.vision.fovDegrees, 63.4);
let localization = await readLocalizationConfig(root);
localization.config.heading.maxTagDistanceMeters = 4.5;
localization = await saveLocalizationConfig(root, localization.config);
assert.equal(localization.config.heading.maxTagDistanceMeters, 4.5);

let files = await readConstantsFiles(root);
let native = files.find(item => item.id === "robot:StateMachine");
native = await saveConstantsFile(root, native.id, native.source, [...native.constants, { originalName: null, name: "MY_GAIN", type: "double", value: "2.5", tunable: true, custom: true }]);
assert.ok((await fs.readFile(file("constants/StateMachineConstants.java"), "utf8")).includes("MY_GAIN = 2.5"));
assert.ok((await fs.readFile(file("constants/GeneratedTunableConstants.java"), "utf8")).includes("StateMachineConstants.class"));
const existing = await snapshot();
await saveSubsystemDocument(root, (await readSubsystemDocument(root)).subsystems);
assert.deepEqual(await snapshot(), existing, "No-op saves preserve source byte-for-byte");
const project = new SourceProject(root);
await project.read(stateMachinePath);
await project.set(stateMachinePath, (await project.read(stateMachinePath)) + "\n// planned edit\n");
await fs.appendFile(file("subsystems/StateMachine.java"), "\n// external edit\n");
await assert.rejects(project.commit(), /changed during/);
// A failed second write rolls back the first, including its original bytes.
const firstFile="src/main/java/frc/robot/constants/Check0Constants.java";
const secondFile="src/main/java/frc/robot/constants/Check1Constants.java";
const transaction=new SourceProject(root);
const originalFirst=await transaction.read(firstFile);
await transaction.set(firstFile,originalFirst+"\n// transaction one\n");
await transaction.set(secondFile,(await transaction.read(secondFile))+"\n// transaction two\n");
const rename=fs.rename;
let writes=0;
fs.rename=async (...args)=>{if(++writes===2)throw Error("injected write failure");return rename(...args);};
try {await assert.rejects(transaction.commit(),/injected write failure/);} finally {fs.rename=rename;}
assert.equal(await fs.readFile(path.join(root,firstFile),"utf8"),originalFirst);
const interrupted=path.join(root,"build/power-tool-edits/interrupted-check");
await fs.mkdir(interrupted,{recursive:true});
const interruptedAfter=originalFirst+"\n// interrupted\n";
await fs.writeFile(path.join(root,firstFile),interruptedAfter);
await fs.writeFile(path.join(interrupted,"journal.json"),JSON.stringify([{relative:firstFile,before:originalFirst,after:interruptedAfter}]));
await recoverSourceTransactions(root);
assert.equal(await fs.readFile(path.join(root,firstFile),"utf8"),originalFirst);
await fs.rm(path.join(interrupted,"complete"));
await fs.writeFile(path.join(root,firstFile),originalFirst+"\n// external later change\n");
await assert.rejects(recoverSourceTransactions(root),/conflicts with an external edit/);
await fs.writeFile(path.join(root,firstFile),originalFirst);
await recoverSourceTransactions(root);

assert.throws(() => validateJava('class Broken { String x = "unfinished; }'), /unterminated/);
assert.equal(literalValue('class A { public static final String URL = "http://x/{y}"; }', javaFields('class A { public static final String URL = "http://x/{y}"; }')[0].expression), "http://x/{y}");
await assert.rejects(fs.access(path.join(root, "power-tool/generated/powerlib-subsystems.json")));
await assert.rejects(fs.access(path.join(root, "power-tool/generated/powerlib-constants.json")));
console.log(`Java configuration checks passed: four mechanism types, field-only saves, custom source, stale revisions, motor structure, state add/rename/confirmed deletion, Vision/localization, constants and JSON-free operation. Fixture: ${root}`);
