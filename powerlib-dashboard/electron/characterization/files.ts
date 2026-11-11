import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { parseWpilog } from "../logs/wpilog.js";
import { downloadRobotLogs, isRobotLogPath } from "../robotLogs.js";
import { analyzeTarget } from "./analysis.js";
import { replaceReport } from "./reportStorage.js";
import { resolveTargetLimits, validPositionTest, validSettings } from "./limits.js";
import { phases, type Report, type Settings, type Target, type TestRecord, type Sample, type Phase, type Diagnostic, type ControlMode } from "./types.js";
const sessions=new Map<string,{root:string;report:Report}>();
const idPattern=/^[a-zA-Z0-9-]{1,90}$/;
const writes=new Map<string,Promise<void>>();
async function save(report:Report){
  const contents=JSON.stringify(report,null,2),temporary=report.path+".tmp";
  const write=(writes.get(report.path)??Promise.resolve()).catch(()=>{}).then(async()=>{
    await fs.writeFile(temporary,contents);await replaceReport(temporary,report.path);
  });
  writes.set(report.path,write);
  try {await write;} finally {if(writes.get(report.path)===write)writes.delete(report.path);}
}
async function persist(report:Report){
  try { await save(report); }
  catch(error) {
    if(!["EPERM","EACCES","EBUSY"].includes((error as NodeJS.ErrnoException).code||""))throw error;
    const recovery=path.join(path.dirname(report.path),"characterization-recovery.json");
    if(report.path===recovery)throw error;
    report.path=recovery;
    report.storageWarning="Windows kept the original report locked. This run was saved to characterization-recovery.json; the diagnostic journal is also retained.";
    await save(report);
  }
}
export function session(id:string){const entry=sessions.get(id);if(!entry)throw Error("Unknown characterization session.");return entry;}
export function canControlCharacterizationDriver(report: Report): boolean {
  if (report.targets.some(target => target.kind === "position")) return false;
  if (!report.manualControl) return true;
  const drive = report.targets.filter(target => target.kind === "drive");
  return drive.length > 0 && report.targets.some(target => target.kind === "steer")
    && drive.every(target => phases.every(phase => report.tests.some(test => test.target.id === target.id && test.phase === phase)));
}
export async function startCharacterization(root:string, data:{simulation:boolean;controlMode?:ControlMode;manualControl?:boolean;host:string;settings:Settings;targets:Target[]}) {
  if(!data||typeof data.simulation!=="boolean"||!data.host||!Array.isArray(data.targets)||!data.targets.length)throw Error("Select at least one subsystem.");
  const controlMode=data.controlMode??(data.simulation?"simulation":"driver-station");
  if(!["simulation","driver-station"].includes(controlMode)||(!data.simulation&&controlMode!=="driver-station"))throw Error("Invalid enable/disable control mode.");
  for(const target of data.targets)if(!idPattern.test(target.id)||!idPattern.test(target.group)||!target.name||!["velocity","velocityTorque","drive","steer","position"].includes(target.kind)||!Array.isArray(target.motors)||!target.motors.length)throw Error("Invalid characterization target.");
  const position = data.targets.some(target => target.kind === "position");
  if (position && (data.targets.length !== 1 || data.manualControl !== true || !validPositionTest(data.settings?.positionTest)))
    throw Error("Position SysId requires one mechanism, manual control and a valid travel window.");
  if(data.manualControl!==undefined&&(typeof data.manualControl!=="boolean"||data.manualControl&&data.targets.some(target=>target.kind!=="drive"&&target.kind!=="steer"&&target.kind!=="position")))
    throw Error("Manual control requires drivetrain or position targets.");
  if(!validSettings(data.settings,data.targets.flatMap(target=>[target.id,target.group])))throw Error("Invalid test settings.");
  const id=randomUUID(),folder=path.join(root,"power-tool/characterization",new Date().toISOString().replace(/[:.]/g,"-")+"-"+id);
  await fs.mkdir(folder,{recursive:true});
  const report:Report={formatVersion:1,id,path:path.join(folder,"characterization.json"),startedAt:new Date().toISOString(),outcome:"running",...data,controlMode,tests:[],results:[],diagnostics:[],
    analysis: position ? {
      model: data.settings.positionTest!.model === "arm" ? "arm cosine gravity" : "elevator constant gravity",
      implementation: "Acceleration OLS with gravity, centered median filter and three-point derivative",
      source: "https://docs.wpilib.org/en/stable/docs/software/advanced-controls/system-identification/introduction.html",
      excitation: "voltage"
    } : {model:"acceleration = alpha*velocity + beta*input + gamma*sign(velocity)",implementation:"SysId simple-motor acceleration OLS, centered median filter and three-point derivative; fixed whole-test window",source:"https://github.com/wpilibsuite/allwpilib/blob/v2026.2.1/sysid/src/main/native/cpp/analysis/FeedforwardAnalysis.cpp",excitation:"voltage"}};
  sessions.set(id,{root,report});await persist(report);return report;
}
export async function recordCharacterizationDiagnostic(id:string,entry:Omit<Diagnostic,"at">){
  const {report}=session(id);
  if(report.outcome!=="running"||!entry||!Number.isFinite(entry.elapsedMs)||!Number.isFinite(entry.statusAgeMs)
    ||typeof entry.message!=="string"||[entry.stage,entry.event,entry.testId,entry.targetId,entry.phase,entry.host].some(value=>typeof value!=="string"||value.length>4000)
    ||typeof entry.connected!=="boolean"||report.diagnostics.length>=10000)throw Error("Invalid characterization diagnostic.");
  const diagnostic={...entry,message:entry.message.length>4000?entry.message.slice(0,3950)+"… (truncated)":entry.message,at:new Date().toISOString()};
  report.diagnostics.push(diagnostic);
  // Preserve each event without repeatedly replacing a file watched by Windows.
  await fs.appendFile(path.join(path.dirname(report.path),"diagnostics.jsonl"),JSON.stringify(diagnostic)+"\n");
}
export async function collectCharacterization(id:string, test:{id:string;targetId:string;phase:Phase;file:string}) {
  const {root,report}=session(id);
  if(report.outcome!=="running"||!idPattern.test(test.id)||!phases.includes(test.phase))throw Error("Invalid test collection request.");
  const target=report.targets.find(item=>item.id===test.targetId);if(!target)throw Error("Target was not selected.");
  if(report.tests.some(item=>item.id===test.id))throw Error("Test already collected.");
  if(report.tests.some(item=>item.target.id===target.id&&item.phase===test.phase))throw Error("This target's test phase was already collected.");
  const folder=path.join(path.dirname(report.path),"logs");await fs.mkdir(folder,{recursive:true});
  const localFile=path.join(folder,test.id+".wpilog");
  if(report.simulation){
    const allowed=path.resolve(root,"logs/power-tool-characterization",test.id+".wpilog");
    const candidate=path.resolve(root,test.file);
    if(candidate.toLowerCase()!==allowed.toLowerCase())throw Error("Simulation log is outside this test's log folder.");
    await fs.copyFile(allowed,localFile);
  }else{
    if(!isRobotLogPath(test.file)||!test.file.endsWith("/power-tool-characterization/"+test.id+".wpilog"))throw Error("Invalid robot characterization log path.");
    await downloadRobotLogs([{remotePath:test.file,localFolder:"logs"}],path.dirname(report.path),()=>{},report.host);
  }
  const bytes=await fs.readFile(localFile);const log=parseWpilog(bytes);
  if(log.truncated)throw Error("The characterization log is incomplete.");
  const samples:Sample[][]=[],csvFiles:string[]=[];
  for(let i=0;i<target.motors.length;i++) {
    const fields=["voltage","position","velocity","current"] as const;
    const signals=fields.map(field=>log.signals.get(`Characterization/${i}/${field}`));
    if(signals.some(signal=>!signal))throw Error("The log is missing characterization signals.");
    const voltage=signals[0]!;
    if(signals.some(signal=>signal!.times.length!==voltage.times.length||signal!.times.some((time,j)=>time!==voltage.times[j])))throw Error("Characterization signal timestamps do not match.");
    const rows=voltage.times.map((time,j)=>({time,voltage:Number(voltage.values[j]),position:Number(signals[1]!.values[j]),velocity:Number(signals[2]!.values[j]),current:Number(signals[3]!.values[j])}));
    if(rows.some(row=>!Object.values(row).every(Number.isFinite)))throw Error("Invalid numeric samples.");
    samples.push(rows);const csv=path.join(folder,test.id+`-motor-${i}.csv`);csvFiles.push(csv);
    await fs.writeFile(csv,"time_s,voltage_V,position_rot,velocity_rot_per_s,torque_current_A\n"+rows.map(row=>[row.time,row.voltage,row.position,row.velocity,row.current].join(",")).join("\n"));
  }
  const record:TestRecord={...test,target,localFile,csvFiles,samples,limits:resolveTargetLimits(report.settings,target)};report.tests.push(record);await persist(report);return record;
}
export async function finishCharacterization(id:string,outcome:Report["outcome"],error?:string) {
  const {report}=session(id);
  if(!["complete","cancelled","failed"].includes(outcome))throw Error("Invalid session outcome.");
  report.outcome=outcome;report.completedAt=new Date().toISOString();report.error=error;
  report.results=report.targets.map(target=>analyzeTarget(target,report.tests,report.settings.medianWindow,report.settings.positionTest));
  if(outcome==="complete"&&report.results.some(result=>result.error))report.outcome="failed";
  await persist(report);
  return report;
}
