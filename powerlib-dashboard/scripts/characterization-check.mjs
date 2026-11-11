import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import {randomUUID} from "node:crypto";
import {build} from "esbuild";
import {pathToFileURL} from "node:url";
import {fitGains,analyzeTarget} from "../dist-electron/characterization/analysis.js";
import {startCharacterization,collectCharacterization,recordCharacterizationDiagnostic,finishCharacterization,canControlCharacterizationDriver} from "../dist-electron/characterization/files.js";
import {driverStationScript} from "../dist-electron/characterization/driverStation.js";
import {driverStationNative} from "../dist-electron/characterization/driverStationNative.js";
import {driverStationFailure} from "../dist-electron/characterization/driverStationErrors.js";
import {execFileSync} from "node:child_process";
import {startFakeRobot} from "./fake-robot.mjs";
import {replaceReport} from "../dist-electron/characterization/reportStorage.js";
const root=path.resolve(import.meta.dirname,"../..");
const fixture=path.join(root,"build/characterization-runtime-check");
const data=JSON.parse(await fs.readFile(path.join(fixture,"run-data.json"),"utf8"));
const settings={duration:5,ramp:1,step:4,settle:.2,medianWindow:1};
const target={id:"velocity",group:"velocity",name:"Velocity",kind:"velocity",motors:["Velocity"]};
let renameAttempts=0;const retryDelays=[];
await replaceReport('temporary','destination',async()=>{if(++renameAttempts<4)throw Object.assign(Error('Windows sharing lock'),{code:'EPERM'});},async ms=>{retryDelays.push(ms);});
assert.equal(renameAttempts,4);assert.deepEqual(retryDelays,[20,40,80]);
await assert.rejects(replaceReport('temporary','destination',async()=>{throw Object.assign(Error('missing'),{code:'ENOENT'});},async()=>{throw Error('Permanent errors must not retry');}),/missing/);
const locked=await startCharacterization(fixture,{simulation:true,host:'localhost',settings,targets:[target]});
const lockedPath=locked.path,originalRename=fs.rename;
fs.rename=async(from,to)=>{if(to===lockedPath)throw Object.assign(Error('fixture persistent Windows lock'),{code:'EPERM'});return originalRename(from,to);};
try {
 await recordCharacterizationDiagnostic(locked.id,{elapsedMs:0,stage:'test',event:'failed',message:'Preserve me during the lock',testId:'',targetId:'',phase:'',connected:true,host:'localhost',statusAgeMs:0,robot:null});
 assert.ok((await fs.readFile(path.join(path.dirname(lockedPath),'diagnostics.jsonl'),'utf8')).includes('Preserve me'));
 const recovered=await finishCharacterization(locked.id,'failed','fixture');
 assert.ok(recovered.path.endsWith('characterization-recovery.json'));assert.ok(recovered.storageWarning);
 assert.equal(JSON.parse(await fs.readFile(recovered.path,'utf8')).diagnostics.length,1);
} finally {fs.rename=originalRename;}
const report=await startCharacterization(fixture,{simulation:true,host:"localhost",settings:{...settings,targetLimits:{velocity:{duration:5,ramp:1,step:4,rampLimit:3}}},targets:[target]});
for(const test of data.tests)await collectCharacterization(report.id,{...test,targetId:target.id});
await assert.rejects(collectCharacterization(report.id,{...data.tests[0],targetId:target.id}),/already collected/);
const complete=await finishCharacterization(report.id,"complete");
assert.equal(complete.outcome,"complete",JSON.stringify(complete.results));
assert.equal(complete.analysis.excitation,"voltage");
assert.ok(complete.tests.every(test=>test.limits.duration===5&&test.limits.rampLimit===3&&test.limits.step===4));
const quality=complete.results[0].testQuality;
assert.equal(quality.length,4);
assert.ok(quality.every(test=>test.recordedSeconds>=4.9&&test.usableSamples>200&&test.peakVelocity>0));
assert.ok(quality.every(test=>test.warnings.length===0));
const shortened=analyzeTarget(target,complete.tests.map((test,index)=>index===0?{...test,samples:[test.samples[0].slice(0,100)]}:test),1);
assert.ok(shortened.testQuality[0].warnings.some(warning=>warning.includes("Under 3 s")));
assert.equal(shortened.gains.length,1);
const stopped=analyzeTarget(target,complete.tests.map((test,index)=>index===0?{...test,samples:[test.samples[0].map(sample=>({...sample,velocity:0}))]}:test),1);
assert.match(stopped.error,/motion/);
assert.equal(stopped.testQuality[0].usableSamples,0);
assert.ok(stopped.testQuality[0].warnings.length);
const gain=complete.results[0].gains[0];
for(const key of ["kS","kV","kA"])assert.ok(Math.abs(gain[key]-data.truth[key])<data.truth[key]*.12,`${key}: ${gain[key]} vs ${data.truth[key]}`);
assert.ok(gain.rSquared>.95);
const positionTarget={...target,kind:"position"};
for(const model of ["arm","elevator"]) {
  const positionTest={model,horizontal:.04,lower:-1,upper:1,margin:.05,speedLimit:.25,polarity:-1};
  const truth={kS:.22,kV:.63,kA:.16,kG:.51};
  const runs=complete.tests.map((test,index)=> {
    const direction=index%2 ? -1 : 1;
    const samples=Array.from({length:150},(_,i)=>{
      const time=i*.02, base=.05*(index+1), slope=.023*(index+1), curvature=.006;
      const position=.2*index+direction*(base*time+slope*time*time/2+curvature*time*time*time/6);
      const velocity=direction*(base+slope*time+curvature*time*time/2);
      const acceleration=direction*(slope+curvature*time);
      const gravity=model==="arm"?Math.cos(2*Math.PI*(position-positionTest.horizontal)):1;
      return {time,position,velocity,current:0,voltage:-(truth.kS*direction+truth.kV*velocity+truth.kA*acceleration+truth.kG*gravity)};
    });
    return {...test,samples:[samples]};
  });
  const fit=analyzeTarget(positionTarget,runs,1,positionTest);
  assert.equal(fit.error,undefined);
  for(const [key,value] of Object.entries(truth)) assert.ok(Math.abs(fit.gains[0][key]-value)<1e-6,model+" "+key);
  await assert.rejects(startCharacterization(fixture,{simulation:true,host:"localhost",settings,targets:[positionTarget]}),/manual control/);
  const saved=await startCharacterization(fixture,{simulation:true,host:"localhost",manualControl:true,settings:{...settings,positionTest},targets:[positionTarget]});
  assert.equal(canControlCharacterizationDriver(saved),false);
  assert.deepEqual(saved.settings.positionTest,positionTest);
  await finishCharacterization(saved.id,"cancelled");
}
const current=fitGains("Torque",complete.tests.map(test=>test.samples[0]),"A",1);
assert.equal(current.outputUnit,"A");
for(const [key,expected] of Object.entries({kS:.5,kV:.1,kA:.02}))assert.ok(Math.abs(current[key]-expected)<expected*.12,`${key}: ${current[key]} vs ${expected}`);
const dsData=JSON.parse(await fs.readFile(path.join(fixture,"external-ds-run-data.json"),"utf8"));
const dsSimulation=await startCharacterization(fixture,{simulation:true,controlMode:"driver-station",host:"localhost",settings,targets:[target]});
for(const test of dsData.tests)await collectCharacterization(dsSimulation.id,{...test,targetId:target.id});
const dsComplete=await finishCharacterization(dsSimulation.id,"complete");
assert.equal(dsComplete.outcome,"complete");assert.equal(dsComplete.simulation,true);assert.equal(dsComplete.controlMode,"driver-station");
assert.ok(dsComplete.tests.every(test=>test.localFile.endsWith(".wpilog")));
await assert.rejects(startCharacterization(fixture,{simulation:false,controlMode:"simulation",host:"localhost",settings,targets:[target]}),/control mode/);
const torqueOnly=analyzeTarget({...target,kind:"velocityTorque"},complete.tests.map(test=>({...test,samples:test.samples.map(run=>run.map(sample=>({...sample,voltage:0})))})),1);
assert.equal(torqueOnly.gains.length,1);assert.equal(torqueOnly.gains[0].outputUnit,"A");assert.equal(torqueOnly.error,undefined);
assert.ok(torqueOnly.gains[0].warnings.some(warning=>warning.includes("Secondary voltage fit unavailable")));
const swerveTests=JSON.parse(await fs.readFile(path.join(fixture,"swerve-run-data.json"),"utf8"));
const swerveTargets=["drive","steer"].map(kind=>({id:`drivetrain-${kind}`,group:"drivetrain",name:`Drivetrain ${kind}`,kind,motors:["Module 1","Module 2","Module 3","Module 4"]}));
const swerve=await startCharacterization(fixture,{simulation:true,host:"localhost",settings,targets:swerveTargets});
for(const test of swerveTests)await collectCharacterization(swerve.id,test);
const swerveReport=await finishCharacterization(swerve.id,"complete");
assert.equal(swerveReport.outcome,"complete",JSON.stringify(swerveReport.results));
assert.equal(swerveReport.results.flatMap(result=>result.gains).length,8);
const driveTests=swerveReport.tests.filter(test=>test.target.kind==="drive");
const combined={...swerveReport,manualControl:true};
assert.equal(canControlCharacterizationDriver({...combined,tests:driveTests.slice(0,3)}),false);
assert.equal(canControlCharacterizationDriver({...combined,tests:driveTests}),true);
assert.equal(canControlCharacterizationDriver({...combined,targets:[swerveTargets[0]],tests:driveTests}),false);
for(const test of complete.tests){assert.ok((await fs.stat(test.localFile)).size>100);assert.ok((await fs.readFile(test.csvFiles[0],"utf8")).startsWith("time_s,voltage_V"));}
assert.equal(JSON.parse(await fs.readFile(complete.path,"utf8")).outcome,"complete");
assert.throws(()=>fitGains("Stopped",[Array.from({length:30},(_,i)=>({time:i*.02,position:0,velocity:0,voltage:4,current:0}))],"V",1),/motion/);
const failed=await startCharacterization(fixture,{simulation:true,host:"localhost",settings,targets:[target]});
const failure=await finishCharacterization(failed.id,"failed","fixture failure");assert.equal(JSON.parse(await fs.readFile(failure.path,"utf8")).error,"fixture failure");
const traversal=await startCharacterization(fixture,{simulation:true,host:"localhost",settings,targets:[target]});
await assert.rejects(collectCharacterization(traversal.id,{...data.tests[0],id:randomUUID(),targetId:target.id,file:"../../outside.wpilog"}),/outside/);
await finishCharacterization(traversal.id,"cancelled");
// Hardware collection uses the selected robot host, not the generic log-viewer address scan.
const server=await startFakeRobot(path.join(fixture,"logs"),0);
try {
 const hardware=await startCharacterization(fixture,{simulation:false,host:`127.0.0.1:${server.address().port}`,settings,targets:[target]});
 for(const test of data.tests)await collectCharacterization(hardware.id,{...test,targetId:target.id,file:`/U/logs/power-tool-characterization/${test.id}.wpilog`});
 const downloaded=await finishCharacterization(hardware.id,"complete");
 assert.equal(downloaded.outcome,"complete");assert.equal(downloaded.tests.length,4);
} finally {await new Promise(resolve=>server.close(resolve));}
assert.ok(driverStationScript("check").includes("Get-Process -Name DriverStation"));
assert.ok(!driverStationScript("check").includes("::Press"));
assert.ok(driverStationScript("enable").includes("219,221,220"));assert.ok(driverStationScript("disable").includes("@(13)"));
assert.ok(driverStationScript("check").includes("::Focus($window,$stationProcessId)"));
assert.ok(driverStationScript("check").includes("::ResolveMainWindow($stationProcessId)"));
assert.ok(driverStationScript("enable").includes("::PressForWindow($window,$stationProcessId"));
assert.ok(driverStationScript("enable").includes("POWERTOOL_DS_ERROR:"));
assert.equal(driverStationFailure({stderr:'POWERTOOL_DS_ERROR: Driver Station is running as administrator and Power Tool is not.\n'}),'Driver Station is running as administrator and Power Tool is not.');
const xmlFailure=driverStationFailure({message:'Command failed: powershell.exe -EncodedCommand '+"A".repeat(20000),stderr:'#< CLIXML\n<Objs><S S="Error">Driver Station could not receive focus; no keys were sent._x000D__x000A_</S></Objs>'});
assert.ok(xmlFailure.includes('could not receive focus'));assert.ok(xmlFailure.length<2000);assert.ok(!xmlFailure.includes('EncodedCommand'));
assert.ok(!driverStationFailure({message:'Command failed: '+"A".repeat(20000)}).includes('A'.repeat(100)));
const oversized=await startCharacterization(fixture,{simulation:true,host:'localhost',settings,targets:[target]});
await recordCharacterizationDiagnostic(oversized.id,{elapsedMs:0,stage:'failure',event:'failed',message:'Details '.repeat(3000),testId:'',targetId:'',phase:'',host:'localhost',connected:true,statusAgeMs:0,robot:null});
const oversizedSaved=await finishCharacterization(oversized.id,'failed','fixture');
assert.ok(oversizedSaved.diagnostics[0].message.length<=4000);assert.ok(oversizedSaved.diagnostics[0].message.endsWith('(truncated)'));
if(process.platform==="win32"){
 const chordCheck=`
public static class CharacterizationChordCheck {
 public static void Run() {
  var events=new System.Collections.Generic.List<string>();
  CharacterizationDsKeys.INPUT[] down=null,up=null;
  CharacterizationDsKeys.DeliverChord(new ushort[]{219,221,220},inputs=>{
   bool released=(inputs[0].data.keyboard.flags&2)!=0;events.Add(released?"up":"down");
   foreach(var input in inputs)if(input.type!=1||input.data.keyboard.key!=0||input.data.keyboard.scan==0||input.data.keyboard.flags!=(released?10u:8u))throw new System.Exception("Invalid scan-code input");
   if(released)up=inputs;else down=inputs;
  },ms=>{if(ms!=200)throw new System.Exception("Chord must be held 200ms");events.Add("hold");});
  if(string.Join(",",events)!="down,hold,up")throw new System.Exception("Wrong chord delivery order");
  for(int i=0;i<3;i++)if(down[i].data.keyboard.scan!=up[2-i].data.keyboard.scan)throw new System.Exception("Keys must release in reverse order");
  bool releaseAfterFailure=false;
  try{CharacterizationDsKeys.DeliverChord(new ushort[]{219,221,220},inputs=>{if((inputs[0].data.keyboard.flags&2)!=0)releaseAfterFailure=true;},ms=>{throw new System.Exception("pause fault");});throw new System.Exception("Failure should propagate");}
  catch(System.Exception error){if(error.Message!="pause fault")throw;}
  if(!releaseAfterFailure)throw new System.Exception("Failure must release held keys");
 }
}`;
 const nativePath=path.join(fixture,"native-chord-check.cs");
 await fs.writeFile(nativePath,driverStationNative+chordCheck);
 const script=`$ErrorActionPreference='Stop'\n$ProgressPreference='SilentlyContinue'\nAdd-Type -TypeDefinition ([IO.File]::ReadAllText('${nativePath.replaceAll("'","''")}'))\nif([CharacterizationDsKeys]::MainWindowScore('FRC Driver Station - Version 24.0.2','LVDChild') -le [CharacterizationDsKeys]::MainWindowScore('DriverStation','LVFrame')){throw 'LabVIEW panel must take priority over wrapper'}\nif([CharacterizationDsKeys]::MainWindowScore('Context Help','LVDChild') -ne 0){throw 'Help window must not receive shortcuts'}\nif([CharacterizationDsKeys]::MainWindowScore('FRC Driver Station - Version 26.0.0','LVDChild') -ne 3){throw 'Version-independent panel selection failed'}\ntry {[CharacterizationDsKeys]::PressForWindow([IntPtr]::Zero,0,[uint16[]]@(219,221,220));throw 'Unexpected input success'}catch{if($_.Exception.GetBaseException().Message -notlike '*No keys were sent*'){throw}}\n[Runtime.InteropServices.Marshal]::SizeOf([type][CharacterizationDsKeys+INPUT])`;
 const scriptPath=path.join(fixture,"native-chord-check.ps1");await fs.writeFile(scriptPath,script+'\n[CharacterizationChordCheck]::Run()');
 const size=execFileSync("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",scriptPath],{encoding:"utf8",windowsHide:true}).trim();
 assert.equal(Number(size),process.arch==="x64"?40:28,"Native DS INPUT ABI compiles with the correct size without sending keys.");
}
const compiled=path.join(fixture,"run.mjs");await build({entryPoints:[path.join(root,"powerlib-dashboard/src/features/characterization/runCharacterization.ts")],outfile:compiled,bundle:true,platform:"node",format:"esm"});
const {runCharacterization}=await import(pathToFileURL(compiled));
await assert.rejects(runCharacterization({
 now:()=>0,observe:()=>({connected:true,host:"localhost",receivedAt:0,status:{simulation:true,controlMode:"simulation",enabled:false,test:true}}),
 api:{start:async()=>assert.fail("Incompatible robot must reject the settings before starting")}
},[target],{...settings,rampLimit:3},new AbortController().signal,()=>{}),/Rebuild the robot/);
for(const mode of ["sim-internal","sim-ds","physical-ds"])for(const cancel of [false,true]){
 const simulation=mode!=="physical-ds",controlMode=mode==="sim-internal"?"simulation":"driver-station";
 const calls=[],diagnostics=[],controller=new AbortController();let state={version:1,id:"",target:"",phase:"",state:"idle",error:"",file:"",simulation,controlMode,enabled:false,test:true,fms:false,estop:false};
 const makeComplete=()=>setTimeout(()=>{if(state.state==="running"){state={...state,state:"complete",file:"logs/test.wpilog"};}},4);
 let collected=0;
 const adapter={now:()=>performance.now(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,1))),uuid:randomUUID,
  observe:()=>({connected:true,host:"localhost",status:state,receivedAt:performance.now()}),
  api:{start:async data=>{assert.equal(data.controlMode,controlMode);assert.equal(data.simulation,simulation);return {...report,simulation,controlMode,tests:[],results:[]};},collect:async()=>{collected++;},diagnostic:async(_id,entry)=>{diagnostics.push(entry);},finish:async(_id,outcome,error)=>({...report,outcome,error}),
   driver:async(_id,action)=>{assert.equal(controlMode,"driver-station");calls.push(action);if(action==="enable"){state={...state,enabled:true,state:"running"};if(cancel)controller.abort();else makeComplete();}if(action==="disable")state={...state,enabled:false};}},
  publish:async(name,_type,value)=>{
   if(name.endsWith("/request")){const request=JSON.parse(value);if(!request.cancel)state={...state,id:request.id,target:request.target,phase:request.phase,state:"prepared"};}
   if(name.endsWith("/simulationControl")){assert.equal(controlMode,"simulation","DS-controlled runs must never publish internal enable/disable");const enabled=String(value).includes("|enable|");calls.push(enabled?"enable":"disable");state={...state,enabled,state:enabled?"running":state.state};if(enabled){if(cancel)controller.abort();else makeComplete();}}
  }};
 const result=await runCharacterization(adapter,[target],{...settings,settle:0},controller.signal,()=>{});
 assert.equal(result.outcome,cancel?"cancelled":"complete");assert.equal(state.enabled,false);
 assert.equal(calls.filter(action=>action==="enable").length,cancel?1:4);assert.equal(collected,cancel?0:4);
 assert.equal(calls.at(-1),"disable");
 assert.equal(calls.includes("check"),controlMode==="driver-station");
 assert.ok(diagnostics.some(entry=>entry.event==="control-request"));
 assert.equal(diagnostics.at(-1).event,"analysis-started");
}
// Manual drivetrain control never sends an enable or disable through either bridge.
for(const mode of ["simulation","driver-station"])for(const stop of [false,true]){
 const controller=new AbortController(),steps=[],requests=[];
 let armed=false,collected=0,cancelRequests=0;
 let state={version:1,id:"",target:"",phase:"",state:"idle",error:"",file:"",simulation:true,controlMode:mode,
   enabled:false,test:true,fms:false,estop:false,manualDrivetrain:true,separateRampLimit:true,commandScheduled:false};
 const later=callback=>setTimeout(callback,5);
 const result=await runCharacterization({
  now:()=>performance.now(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,1))),uuid:randomUUID,
  observe:()=>({connected:true,host:"localhost",status:state,receivedAt:performance.now()}),
  publish:async(name,_type,value)=>{
   assert.ok(!name.endsWith("/simulationControl"),"Manual run must never send internal enable/disable");
   if(!name.endsWith("/request"))return;
   const request=JSON.parse(value);
   if(request.cancel){cancelRequests++;state={...state,state:"cancelled"};return;}
   assert.ok(armed&&!state.enabled&&!state.commandScheduled);
   assert.equal(request.manualControl,true);
   requests.push(request);
   state={...state,id:request.id,target:request.target,phase:request.phase,state:"prepared"};
  },
  api:{start:async data=>{assert.equal(data.manualControl,true);return {...report,...data};},
   collect:async()=>{assert.ok(!state.enabled&&!state.commandScheduled);collected++;},
   finish:async(_id,outcome,error)=>({...report,outcome,error}),diagnostic:async()=>{},
   driver:async()=>assert.fail("Manual run must never send a Driver Station shortcut")}
 },[swerveTargets[0]],{...settings,settle:0},controller.signal,()=>{},{
  update(step){
   steps.push(step.state);
   if(step.state==="arm"){
    armed=false;assert.equal(requests.length,step.number-1);later(()=>{armed=true;});
   }
   if(step.state==="enable")later(()=>{state={...state,enabled:true,state:"running",commandScheduled:true};});
   if(step.state==="running")later(()=>{
    if(stop)controller.abort();
    else state={...state,state:"complete",file:"logs/test.wpilog"};
   });
   if(step.state==="disable")later(()=>{
    state={...state,enabled:false};later(()=>{state={...state,commandScheduled:false};});
   });
   if(step.state==="cancel"){
    assert.ok(state.enabled,"Stopping the test must leave enable state under operator control");
    later(()=>{state={...state,enabled:false,commandScheduled:false};});
   }
  },
  armRequested:()=>armed
 });
 assert.equal(result.outcome,stop?"cancelled":"complete",result.error);
 assert.equal(requests.length,stop?1:4);
 assert.equal(collected,stop?0:4);
 assert.equal(cancelRequests,stop?1:0);
 assert.equal(state.enabled,false);
 assert.deepEqual(steps.slice(0,5),stop?["arm","prepare","enable","running","cancel"]:["arm","prepare","enable","running","disable"]);
}
// With the internal simulator, only steering uses automatic control, even if selected first.
for(const includeDrive of [false,true]){
 const sequence=[],collected=[],steps=[];
 let arm=false;
 let state={version:1,id:"",target:"",phase:"",state:"idle",error:"",file:"",simulation:true,controlMode:"simulation",
   enabled:false,test:false,fms:false,estop:false,manualDrivetrain:includeDrive,commandScheduled:false};
 const later=callback=>setTimeout(callback,5);
 const completeTest=()=>later(()=>{state={...state,state:"complete",file:"logs/test.wpilog"};});
 const result=await runCharacterization({
  now:()=>performance.now(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,Math.min(ms,1))),uuid:randomUUID,
  observe:()=>({connected:true,host:"localhost",status:state,receivedAt:performance.now()}),
  api:{start:async data=>{assert.equal(!!data.manualControl,includeDrive);return {...report,...data};},
   collect:async(_id,test)=>{assert.equal(state.enabled,false);collected.push(test.targetId);},
   finish:async(_id,outcome,error)=>({...report,outcome,error}),diagnostic:async()=>{},
   driver:async()=>assert.fail("Internal simulation uses NetworkTables control")},
  publish:async(name,_type,value)=>{
   if(name.endsWith("/request")){
    const request=JSON.parse(value);
    if(request.cancel)return;
    assert.equal(!!request.manualControl,request.target==="drivetrain-drive");
    if(request.target==="drivetrain-steer"&&includeDrive)assert.equal(collected.filter(target=>target==="drivetrain-drive").length,4);
    sequence.push(request.target);
    state={...state,id:request.id,target:request.target,phase:request.phase,state:"prepared"};
   }
   if(name.endsWith("/simulationControl")){
    assert.equal(state.target,"drivetrain-steer");
    const enabled=String(value).includes("|enable|");
    state={...state,enabled,state:enabled?"running":state.state,commandScheduled:enabled};
    if(enabled)completeTest();
   }
  }
 },includeDrive?[swerveTargets[1],swerveTargets[0]]:[swerveTargets[1]],{...settings,settle:0},new AbortController().signal,()=>{},{
  update(step){
   if(!step)return;
   steps.push(step.state);
   if(step.state==="arm"){arm=false;later(()=>{arm=true;});}
   if(step.state==="enable")later(()=>{state={...state,enabled:true,test:true,state:"running",commandScheduled:true};});
   if(step.state==="running")completeTest();
   if(step.state==="disable")later(()=>{state={...state,enabled:false,commandScheduled:false};});
  },
  armRequested:()=>arm
 });
 assert.equal(result.outcome,"complete",result.error);
 assert.equal(steps.filter(step=>step==="arm").length,includeDrive?4:0);
 assert.deepEqual(sequence,[...(includeDrive?Array(4).fill("drivetrain-drive"):[]),...Array(4).fill("drivetrain-steer")]);
 assert.deepEqual(collected,sequence);
}
// A missing prepare/completion/disable acknowledgement must identify its stage and
// save the requested test plus last robot status, even when no WPILOG exists.
for(const failure of ["prepare","enable","complete","disable"]){
 let state={version:1,id:"",target:"",phase:"",state:"idle",error:"",file:"",simulation:true,controlMode:"simulation",enabled:false,test:true,fms:false,estop:false,dsAttached:true,commandScheduled:false,commandStarted:false};
 const now=()=>performance.now()*1000;
 let saved;
 const result=await runCharacterization({now,sleep:()=>new Promise(resolve=>setTimeout(resolve,1)),uuid:randomUUID,
  observe:()=>({connected:true,host:"localhost",status:state,receivedAt:now()}),
  api:{start:async data=>{saved=await startCharacterization(fixture,data);return saved;},diagnostic:recordCharacterizationDiagnostic,finish:finishCharacterization,
   collect:async()=>{throw Error("Timed-out tests must not collect logs.");},driver:async()=>{throw Error("No physical control in timeout fixture.");}},
  publish:async(name,_type,value)=>{
   if(name.endsWith("/request")){const request=JSON.parse(value);if(!request.cancel&&failure!=="prepare")state={...state,id:request.id,target:request.target,phase:request.phase,state:"prepared"};}
   if(name.endsWith("/simulationControl")){
    if(String(value).includes("|enable|")){
     if(failure==="disable")state={...state,enabled:true,state:"complete",commandScheduled:true,commandStarted:true};
     if(failure==="complete")state={...state,enabled:true,state:"running",commandScheduled:true,commandStarted:true};
    }else if(failure!=="disable")state={...state,enabled:false};
   }
  }},[target],settings,new AbortController().signal,()=>{});
 assert.equal(result.outcome,"failed");
 assert.ok(result.error.includes(failure==="disable"?"to become disabled":`Velocity / quasistatic forward to ${failure}`),result.error);
 assert.ok(result.error.includes("Last robot status:"),result.error);
 const persisted=JSON.parse(await fs.readFile(saved.path,"utf8"));
 const timeout=persisted.diagnostics.find(entry=>entry.event==="timeout");
 assert.ok(timeout);assert.equal(timeout.targetId,"velocity");assert.equal(timeout.phase,"quasistatic-forward");
 assert.equal(timeout.robot.commandStarted,["complete","disable"].includes(failure));assert.ok(timeout.testId);assert.ok(timeout.statusAgeMs>=0);
 assert.ok(persisted.diagnostics.some(entry=>entry.event==="cancel-request"));
}
// A DS focus failure must remain readable and not claim a failed disable when
// fresh telemetry confirms that the robot never left Disabled.
{
 let state={version:1,id:'',target:'',phase:'',state:'idle',error:'',file:'',simulation:true,controlMode:'driver-station',enabled:false,test:true,fms:false,estop:false};
 const now=()=>performance.now()*1000;
 let saved;
 const result=await runCharacterization({now,sleep:()=>new Promise(resolve=>setTimeout(resolve,1)),uuid:randomUUID,
  observe:()=>({connected:true,host:'localhost',status:state,receivedAt:now()}),
  api:{start:async data=>{saved=await startCharacterization(fixture,data);return saved;},diagnostic:recordCharacterizationDiagnostic,finish:finishCharacterization,collect:async()=>{throw Error('No log expected');},
   driver:async(_id,action)=>{if(action!=='check')throw Error("Error invoking remote method 'powerlib:characterization-driver': Error: Driver Station lost keyboard focus. No keys were sent.");}},
  publish:async(name,_type,value)=>{if(name.endsWith('/request')){const request=JSON.parse(value);state={...state,id:request.id,state:request.cancel?'cancelled':'prepared'};}}
 },[target],settings,new AbortController().signal,()=>{});
 assert.equal(result.outcome,'failed');assert.ok(result.error.includes('lost keyboard focus'));
 assert.ok(!result.error.includes('remote method'));assert.ok(!result.error.includes('Disable was not acknowledged'));
 assert.ok(!result.error.includes('Some diagnostics could not be saved'));
 const persisted=JSON.parse(await fs.readFile(saved.path,'utf8'));
 assert.ok(persisted.diagnostics.some(entry=>entry.event==='failed'));
 assert.ok(persisted.diagnostics.some(entry=>entry.event==='disabled-confirmed'));
 assert.ok(persisted.diagnostics.findIndex(entry=>entry.event==='cancel-request')<persisted.diagnostics.findIndex(entry=>entry.stage.startsWith('cleanup:')));
}
console.log("Characterization pipeline passed: real SysId WPILOG collection/CSV conversion, known kS/kV/kA recovery, current units, failed/cancelled JSON reports, path guards, Driver Station key generation and sequential enable/disable/cancellation in both control modes. No physical DS keys were sent.");
