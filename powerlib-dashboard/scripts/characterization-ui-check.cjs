// Production Logs UI, preload, IPC, WPILOG conversion and report writer; no robot or DS traffic.
const {app,ipcMain,session}=require('electron');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const {buildSync}=require('esbuild');
const childProcess=require('node:child_process');
const {promisify}=require('node:util');
const originalExecFile=childProcess.execFile,originalExecute=promisify(originalExecFile),driverCalls=[];
let driverFailure='';
const unelevatedFixture=process.argv.includes('--fixture-unelevated');
let restartRequests=0;
let lockReports=false;
// Exercise production Driver Station IPC and script generation without ever
// executing those scripts or sending keyboard input to a real application.
childProcess.execFile=(...args)=>originalExecFile(...args);
childProcess.execFile[promisify.custom]=async(command,args,options)=>{
 const encodedIndex=args?.indexOf('-EncodedCommand')??-1;
 const fileIndex=args?.indexOf('-File')??-1;
 const script=fileIndex>=0?fs.readFileSync(args[fileIndex+1],'utf8'):encodedIndex>=0?Buffer.from(args[encodedIndex+1],'base64').toString('utf16le'):'';
 if(script.includes('WindowsBuiltInRole]::Administrator')) return {stdout:unelevatedFixture?'False':'True',stderr:''};
 if(script.includes('-Verb RunAs')) { restartRequests++; return {stdout:'cancelled',stderr:''}; }
 if(script.includes('Get-Process -Name DriverStation')){
   const action=script.includes('219,221,220')?'enable':script.includes('[uint16[]]@(13)')?'disable':'check';
   driverCalls.push(action);
   if(driverFailure==='administrator'||(driverFailure==='focus'&&action!=='check')){
     const failure=Error('Command failed: powershell.exe -EncodedCommand '+'A'.repeat(20000));
     failure.stderr='POWERTOOL_DS_ERROR: '+(driverFailure==='administrator'?'Driver Station is running as administrator and Power Tool is not. Run both at the same privilege level. No keys were sent.':'Driver Station could not receive keyboard focus. No keys were sent.');
     throw failure;
   }
   if(action!=='check')await window.webContents.executeJavaScript(`window.fixtureDsControl(${action==='enable'})`);
   return {stdout:'',stderr:''};
 }
 return originalExecute(command,args,options);
};
require('node:module').syncBuiltinESMExports();
const project=path.resolve(__dirname,'..'),root=path.resolve(project,'..');
const fixture=path.join(root,'build/dashboard-checks/characterization-'+Date.now());
const originalRename=fs.promises.rename;
fs.promises.rename=async(from,to)=>{
 if(lockReports&&String(to).startsWith(fixture)&&path.basename(to)==='characterization.json')throw Object.assign(Error('Injected Windows report lock'),{code:'EPERM'});
 return originalRename(from,to);
};
const runtime=JSON.parse(fs.readFileSync(path.join(root,'build/characterization-runtime-check/run-data.json'),'utf8'));
const swerve=JSON.parse(fs.readFileSync(path.join(root,'build/characterization-runtime-check/swerve-run-data.json'),'utf8'));
fs.mkdirSync(fixture,{recursive:true});fs.writeFileSync(path.join(fixture,'build.gradle'),'// isolated characterization UI check');
process.chdir(fixture);app.setPath('userData',path.join(fixture,'profile'));
const extra=path.join(fixture,'fixture-preload.cjs');
fs.writeFileSync(extra,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('characterizationFixture',{prepare:data=>ipcRenderer.invoke('fixture:prepare',data)});`);
ipcMain.handle('fixture:prepare',(_event,test)=>{
  assert.match(test.id,/^[a-zA-Z0-9-]+$/);
  const template=test.target.startsWith('drivetrain-')?swerve.find(item=>item.phase===test.phase&&item.targetId===test.target)
    :runtime.tests.find(item=>item.phase===test.phase);
  assert.ok(template);
  const file=path.join(fixture,'logs/power-tool-characterization',test.id+'.wpilog');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.resolve(root,'build/characterization-runtime-check',template.file),file);return file;
});
app.whenReady().then(()=>session.defaultSession.registerPreloadScript({type:'frame',filePath:extra}));
const ui=path.join(fixture,'ui');fs.mkdirSync(ui);
buildSync({stdin:{contents:`
import React,{useEffect,useState} from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,createTheme,CssBaseline} from '@mui/material';
import {NetworkTablesProvider,useNetworkTables} from ${JSON.stringify(path.join(project,'src/features/networktables/NetworkTablesContext.tsx'))};
import {LoadedLogsProvider} from ${JSON.stringify(path.join(project,'src/features/logs/LoadedLogsProvider.tsx'))};
import {LogsPanel} from ${JSON.stringify(path.join(project,'src/features/logs/LogsPanel.tsx'))};
import ${JSON.stringify(path.join(project,'src/styles.css'))};
const base='/PowerLib/Characterization/';
let state={version:1,id:'',target:'',phase:'',state:'idle',error:'',file:'',simulation:true,controlMode:'simulation',enabled:false,test:true,fms:false,estop:false,dsAttached:true,commandScheduled:false,commandStarted:false,separateRampLimit:true,manualDrivetrain:true,crawlSpeedCutoff:true,positionSysId:true};
window.fixtureCalls=[];
window.fixtureCrawlCalls=[];
window.fixtureCrawlEnable=()=>{state={...state,enabled:true,test:true,state:'ready',crawlFeedback:{position:0,velocity:0}};};
window.fixtureSetDsMode=test=>{state={...state,simulation:true,controlMode:'driver-station',test};};
window.fixtureDsControl=enabled=>{
 state={...state,enabled,commandScheduled:enabled,commandStarted:enabled,state:enabled?'running':state.state};
 const id=state.id;
 if(enabled)setTimeout(()=>{if(state.id===id&&state.enabled)state={...state,state:'complete'};},100);
};
async function publish(name,type,value){
 if(!name.startsWith(base))return;
 if(name===base+'request'){
   const request=JSON.parse(value);window.fixtureCalls.push(request);
   if(request.cancel){state={...state,enabled:false,state:'cancelled'};return;}
   if(request.phase==='crawl'){
     state={...state,...request,state:'prepared',enabled:false,commandScheduled:false,commandStarted:false};
     return;
   }
   const file=await window.characterizationFixture.prepare(request);
   state={...state,...request,file,state:'prepared',enabled:false,commandScheduled:false,commandStarted:false};
 }
 if(name===base+'crawlNudge'){
   window.fixtureCrawlCalls.push(JSON.parse(value));
 }
 if(name===base+'simulationControl'){
   if(state.controlMode!=='simulation')throw Error('DS-controlled simulation received an internal enable/disable request');
   const [id,action]=value.split('|');if(id!==state.id)throw Error('Wrong test control');
   state={...state,enabled:action==='enable',commandScheduled:action==='enable',commandStarted:action==='enable',state:action==='enable'?'running':state.state};
   if(action==='enable'&&!window.fixtureStall)setTimeout(()=>{if(state.id===id&&state.enabled)state={...state,state:'complete'};},100);
 }
};
const subsystems=[{id:'velocity',name:'Shooter',type:'velocity'},{id:'torque',name:'Feeder',type:'velocityTorque'},{id:'position',name:'Arm',type:'absolutePosition'}];
const catalog=[{id:'position',group:'position',name:'Arm',kind:'position',motors:['Arm']},{id:'velocity',group:'velocity',name:'Shooter',kind:'velocity',motors:['Shooter']},{id:'torque',group:'torque',name:'Feeder',kind:'velocityTorque',motors:['Feeder']},...['drive','steer'].map(kind=>({id:'drivetrain-'+kind,group:'drivetrain',name:'Drivetrain '+kind,kind,motors:['Module 1','Module 2','Module 3','Module 4']}))];
function Fixture(){const network=useNetworkTables();const [additional,setAdditional]=useState([]);useEffect(()=>{
 network.clientRef.current.publish=publish;
 window.fixtureSetMoreSubsystems=()=>setAdditional(Array.from({length:9},(_,index)=>({id:'extra-'+index,name:'Extra mechanism '+index,type:'velocity'})));
 network.setStatus('connected');
 const update=()=>network.setTopics([{name:base+'catalog',type:'string',value:JSON.stringify(catalog),receivedAt:performance.now()},{name:base+'status',type:'string',value:JSON.stringify(state),receivedAt:performance.now()},{name:base+'crawlCatalog',type:'string',value:JSON.stringify([{id:'position',name:'Arm'},{id:'elevator',name:'Elevator',lower:-.5,upper:.5}]),receivedAt:performance.now()},{name:base+'positionFeedback',type:'string',value:JSON.stringify({positions:window.fixturePositions??{position:{position:0,velocity:0},elevator:{position:-.4,velocity:0}}}),receivedAt:performance.now()}]);
 update();const timer=setInterval(update,25);return()=>clearInterval(timer);
},[]);return <LogsPanel active subsystems={[...subsystems,...additional]}/>;}
createRoot(document.getElementById('root')).render(<ThemeProvider theme={createTheme({palette:{mode:'dark',primary:{main:'#facc15'}}})}><CssBaseline/><NetworkTablesProvider><LoadedLogsProvider><Fixture/></LoadedLogsProvider></NetworkTablesProvider></ThemeProvider>);
`,loader:'jsx',resolveDir:project},bundle:true,platform:'browser',format:'iife',loader:{'.png':'file'},outfile:path.join(ui,'fixture.js'),define:{'process.env.NODE_ENV':'"production"'}});
fs.writeFileSync(path.join(ui,'index.html'),'<html><head><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>');
let window;
const evaluate=code=>window.webContents.executeJavaScript(code);
const wait=async predicate=>{for(let i=0;i<600;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Characterization UI wait timed out');};
const click=label=>evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(label)}&&!el.disabled).click()`);
async function choose(label,option){
  await evaluate(`document.querySelector('[role=combobox][aria-label="${label}"]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}))`);
  await wait(()=>evaluate(`!!document.querySelector('[role=listbox]')`));
  await evaluate(`[...document.querySelectorAll('[role=option]')].find(el=>el.textContent===${JSON.stringify(option)}).click()`);
}
const fill=(label,value)=>evaluate(`(()=>{const input=[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent===${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
async function assertDialogFits(label){
  const overflow=await evaluate(`(()=>{
    const content=document.querySelector('[role=dialog] .MuiDialogContent-root');
    return { vertical:content.scrollHeight-content.clientHeight, horizontal:content.scrollWidth-content.clientWidth };
  })()`);
  assert.ok(overflow.vertical<=1&&overflow.horizontal<=1,`${label} does not fit the minimum window size: ${JSON.stringify(overflow)}`);
}
const reports=()=>{const folder=path.join(fixture,'power-tool/characterization');return fs.existsSync(folder)?fs.readdirSync(folder).map(name=>{const recovery=path.join(folder,name,'characterization-recovery.json');return fs.existsSync(recovery)?recovery:path.join(folder,name,'characterization.json');}).filter(file=>fs.existsSync(file)).map(file=>JSON.parse(fs.readFileSync(file,'utf8'))):[];};
async function run(){
 window.setContentSize(960,640);
 if(unelevatedFixture){
   await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Characterize Robot')`));
   await click('Characterize Robot');
   await wait(()=>evaluate(`document.body.innerText.includes('Restart Power Tool as administrator?')`));
   assert.equal(await evaluate(`!!document.querySelector('#characterization-title')`),false);
   await click('Restart as administrator');
   await wait(()=>evaluate(`document.body.innerText.includes('Administrator restart canceled.')`));
   assert.equal(restartRequests,1);
   await click('Cancel');
   await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
   assert.equal(reports().length,0);
   console.log('Unelevated characterization is blocked and Windows elevation cancellation preserves the window.');
   return;
 }
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Characterize Robot')`));
 assert.deepEqual(await evaluate(`[...document.querySelectorAll('button')].map(el=>el.textContent).filter(text=>text.startsWith('Characterize'))`),['Characterize Robot']);
 await click('Characterize Robot');
 await wait(()=>evaluate(`document.querySelectorAll('[role=dialog] input[type=checkbox]').length===3`));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input:checked').length`),0);
 assert.ok(!(await evaluate(`document.querySelector('[role=dialog]').innerText`)).includes('Arm ('));
 assert.ok(!(await evaluate(`document.querySelector('[role=dialog]').innerText`)).includes('Drivetrain'));
 const labels=()=>evaluate(`[...document.querySelectorAll('[role=dialog] label')].map(el=>el.textContent)`);
 await choose('Subsystem types','Arms & elevators');
 await wait(()=>evaluate(`document.body.innerText.includes('0.010 rot/s')`));
 await assertDialogFits('Arms and elevators crawl setup');
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Start characterization')`),false);
 await choose('Mechanism','Elevator');
 const valueOf=label=>evaluate(`[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent===${JSON.stringify(label)}).value`);
 assert.equal(await valueOf('Min (rot)'),'-0.5');
 await fill('Lower stop (rot)',-.35);
 await fill('Upper stop (rot)',.35);
 await wait(()=>evaluate(`document.body.innerText.includes('Position -0.400000 rot')`));
 await evaluate(`document.querySelector('[aria-label="Use current position for Min"]').click()`);
 assert.equal(await valueOf('Min (rot)'),'-0.4');
 await evaluate(`window.fixturePositions={position:{position:.2,velocity:0},elevator:{position:.45,velocity:0}}`);
 await wait(()=>evaluate(`document.body.innerText.includes('Position 0.450000 rot')`));
 await evaluate(`document.querySelector('[aria-label="Use current position for Max"]').click()`);
 assert.equal(await valueOf('Max (rot)'),'0.45');
 await choose('Mechanism','Arm');
 await wait(()=>evaluate(`document.body.innerText.includes('Position 0.200000 rot')`));
 await choose('Mechanism','Elevator');
 assert.equal(await valueOf('Lower stop (rot)'),'-0.35');
 assert.equal(await valueOf('Max (rot)'),'0.45');
 await evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click()`);
 await click('Arm Crawl');
 await wait(()=>evaluate(`document.body.innerText.includes('Enable Test mode in the WPILib Simulation GUI')`));
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Nudge').disabled`),true);
 await evaluate('window.fixtureCrawlEnable()');
 await wait(()=>evaluate(`document.body.innerText.includes('Ready to nudge')`));
 for (let step=0; step<21; step++) await click('Speed Up');
 await click('Flip Direction');
 assert.equal(await evaluate('window.fixtureCrawlCalls.length'),0,'Speed and direction controls only affect the next nudge');
 await click('Nudge');
 await wait(()=>evaluate('window.fixtureCrawlCalls.length===1'));
 const nudge=await evaluate('window.fixtureCrawlCalls[0]');
 assert.equal(nudge.speedLimit,.115);assert.equal(nudge.direction,-1);
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Speed Down'&&!el.disabled)`));
 await click('Speed Down');
 assert.ok(await evaluate(`document.body.innerText.includes('0.110 rot/s')`));
 await click('Stop Crawl');
 await wait(()=>evaluate(`window.fixtureCalls.some(request=>request.cancel&&request.id===window.fixtureCrawlCalls[0].id)`));
 await evaluate('window.fixtureCalls=[]');
 await choose('Subsystem types','Velocity');
 assert.ok((await labels()).includes('Shooter (velocity)'));
 assert.ok(!(await labels()).includes('Feeder (velocityTorque)'));
 await evaluate(`[...document.querySelectorAll('[role=dialog] input[type=checkbox]')].forEach(input=>input.click())`);
 await choose('Subsystem types','Velocity torque');
 assert.ok((await labels()).includes('Feeder (velocityTorque)'));
 assert.ok(!(await labels()).includes('Shooter (velocity)'));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input:checked').length`),0,'Changing type clears selections and the acknowledgement');
 await choose('Subsystem types','All velocity subsystems');
 assert.equal(await evaluate(`[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent==='Test duration (s)').value`),'5');
 await assertDialogFits('Setup');
 assert.ok(await evaluate(`(()=>{
   const dialog=document.querySelector('[role=dialog]');
   const boxes=[...dialog.querySelectorAll('input[type=checkbox]')].map(input=>input.getBoundingClientRect());
   const acknowledgement=boxes.pop();
   const fields=[...dialog.querySelectorAll('input[type=number]')].map(input=>input.getBoundingClientRect());
   const isColumn=rows=>rows.every((row,index)=>row.left===rows[0].left&&(!index||row.top>rows[index-1].top));
   const warning=dialog.querySelector('[role=alert]');
   const filter=dialog.querySelector('[role=combobox][aria-label="Subsystem types"]').getBoundingClientRect();
   return isColumn(boxes)&&isColumn(fields)&&boxes[0].right<fields[0].left
     &&filter.bottom<boxes[0].top&&dialog.querySelectorAll('[role=combobox]').length===1
     &&acknowledgement.left>boxes[0].right&&acknowledgement.top>fields.at(-1).bottom
     &&warning.textContent.includes('The robot will move')&&warning.getBoundingClientRect().bottom<boxes[0].top
     &&!dialog.innerText.includes('Runs slow ramps');
 })()`),'Setup puts the warning first and stacks the subsystems and settings in adjacent columns');
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Start characterization').disabled`),true);
 await wait(()=>evaluate(`getComputedStyle(document.querySelector('[role=dialog]').parentElement).opacity==='1'`));
 fs.writeFileSync(path.join(fixture,'modal.png'),(await window.webContents.capturePage()).toPNG());
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[1].click();checks.at(-1).click();})()`);
 await fill('Ramp (V/s)',1.2);await fill('Ramp voltage ceiling (V)',3.25);await fill('Dynamic step (V)',3.5);
 await fill('Disabled gap (s)',.2);await fill('Median window',1);
 await assertDialogFits('Setup with multiple subsystems selected');
 await click('Start characterization');
 await wait(()=>evaluate(`document.body.innerText.includes('Characterization running')`));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input').length`),0);
 await assertDialogFits('Progress');
 await wait(()=>reports().length===1&&reports()[0].outcome==='complete');
 await wait(()=>evaluate(`document.body.innerText.includes('Characterization complete.')`));
 const report=reports()[0];assert.equal(report.tests.length,8);assert.equal(report.results.length,2);
 const limits={duration:5,ramp:1.2,rampLimit:3.25,step:3.5};
 assert.deepEqual(report.settings,{...limits,settle:.2,medianWindow:1});
 const requests=await evaluate('window.fixtureCalls.filter(request=>!request.cancel)');
 assert.equal(requests.length,8);
 for(const request of requests){
   const {duration,ramp,rampLimit,step}=request;
   assert.deepEqual({duration,ramp,rampLimit,step},limits);
 }
 assert.ok(report.tests.every(test=>test.limits.step===3.5));
 const settingsValues=()=>evaluate(`[...document.querySelectorAll('[aria-labelledby="characterization-run-settings"] dd')].map(el=>el.textContent)`);
 assert.deepEqual(await settingsValues(),['5 s','1.2 V/s','3.25 V','3.5 V','0.2 s','1 sample']);
 assert.equal(report.results[0].gains[0].outputUnit,'V');assert.equal(report.results[1].gains[0].outputUnit,'A');
 assert.ok(await evaluate(`document.querySelector('[aria-label="Characterization results"]').innerText.includes('Feeder')`));
 await assertDialogFits('Results');
 await choose('Report subsystem','Feeder');
 assert.deepEqual(await settingsValues(),['5 s','1.2 V/s','3.25 V','3.5 V','0.2 s','1 sample']);
 assert.ok(await evaluate(`document.querySelector('[role=dialog]').innerText.includes('Measured torque current fit')`));
 await click('Show test data');
 assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Characterization test data"] tbody tr').length`),4);
 await assertDialogFits('Four-phase test data');
 await click('Show gains');
 fs.writeFileSync(path.join(fixture,'results.png'),(await window.webContents.capturePage()).toPNG());
 await click('Run again');
 await wait(()=>evaluate(`document.querySelectorAll('[role=dialog] input[type=checkbox]').length===3`));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input:checked').length`),2,'Run again retains selections and clears the safety confirmation');
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input:checked').length`),0);
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks.at(-1).click();})()`);
 await click('Start characterization');await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Stop characterization')`));
 await click('Stop characterization');await wait(()=>reports().length===2&&reports().some(report=>report.outcome==='cancelled'));
 const cancelled=reports().find(report=>report.outcome==='cancelled');assert.ok(cancelled.tests.length<4);
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Close')`));
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{window.fixtureStall=true;const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks.at(-1).click();})()`);
 await fill('Test duration (s)',.5);await click('Start characterization');
 await wait(()=>reports().some(report=>report.outcome==='failed'));
 await wait(()=>evaluate(`document.body.innerText.includes('Last robot status:')`));
 const failed=reports().find(report=>report.outcome==='failed');
 assert.ok(failed.error.includes('Shooter / quasistatic forward to complete'));
 assert.ok(failed.diagnostics.some(entry=>entry.event==='timeout'&&entry.robot.commandStarted===true));
 assert.ok(failed.diagnostics.some(entry=>entry.event==='control-request'&&entry.message.includes('disable')));
 await assertDialogFits('Timeout with diagnostics');
 fs.writeFileSync(path.join(fixture,'timeout.png'),(await window.webContents.capturePage()).toPNG());
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await evaluate(`window.fixtureSetDsMode(false)`);
 await click('Characterize Robot');await wait(()=>evaluate(`document.body.innerText.includes('FRC Driver Station (simulation)')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks.at(-1).click();})()`);
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Start characterization').disabled`),true,'DS-controlled simulation requires Test mode');
 await evaluate(`window.fixtureSetDsMode(true)`);
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Start characterization'&&!el.disabled)`));
 await fill('Disabled gap (s)',.2);await fill('Median window',1);await click('Start characterization');
 await wait(()=>reports().length===4&&reports().filter(report=>report.outcome==='complete').length===2);
 const dsReport=reports().find(report=>report.controlMode==='driver-station');
 assert.ok(dsReport.simulation);assert.equal(dsReport.tests.length,4);
 assert.equal(driverCalls[0],'check');assert.equal(driverCalls.filter(action=>action==='enable').length,4);
 assert.equal(driverCalls.at(-1),'disable');
 fs.writeFileSync(path.join(fixture,'ds-simulation.png'),(await window.webContents.capturePage()).toPNG());
 await wait(()=>evaluate(`document.body.innerText.includes('Characterization complete.')`));
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 driverFailure='focus';
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks.at(-1).click();})()`);
 await click('Start characterization');
 await wait(()=>reports().length===5&&reports().filter(report=>report.outcome==='failed').length===2);
 const focusFailure=reports().find(report=>report.error?.includes('could not receive keyboard focus'));
 assert.ok(focusFailure);assert.ok(focusFailure.error.length<1500);
 assert.ok(!focusFailure.error.includes('EncodedCommand'));assert.ok(!focusFailure.error.includes('remote method'));
 assert.ok(!focusFailure.error.includes('Disable was not acknowledged'));
 assert.ok(focusFailure.diagnostics.some(entry=>entry.event==='disabled-confirmed'));
 await wait(()=>evaluate(`document.body.innerText.includes('could not receive keyboard focus')`));
 fs.writeFileSync(path.join(fixture,'focus-error.png'),(await window.webContents.capturePage()).toPNG());
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 const before=await evaluate('window.fixtureCalls.length');driverFailure='administrator';
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks.at(-1).click();})()`);
 await click('Start characterization');
 await wait(()=>reports().length===6&&reports().filter(report=>report.outcome==='failed').length===3);
 const privilegeFailure=reports().find(report=>report.error?.includes('running as administrator'));
 assert.ok(privilegeFailure);assert.equal(privilegeFailure.tests.length,0);
 assert.equal(await evaluate('window.fixtureCalls.length'),before,'Privilege mismatch is detected before preparing or enabling a test');
 assert.ok(!privilegeFailure.error.includes('EncodedCommand'));
 await wait(()=>evaluate(`document.body.innerText.includes('running as administrator')`));
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 driverFailure='';lockReports=true;
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks.at(-1).click();})()`);
 await fill('Disabled gap (s)',.2);await fill('Median window',1);await click('Start characterization');
 await wait(()=>reports().length===7&&reports().some(report=>report.outcome==='complete'&&report.storageWarning));
 await wait(()=>evaluate(`document.body.innerText.includes('Windows kept the original report locked')`));
 const recovery=reports().find(report=>report.storageWarning);assert.ok(recovery.path.endsWith('characterization-recovery.json'));
 const journal=fs.readFileSync(path.join(path.dirname(recovery.path),'diagnostics.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.ok(journal.some(entry=>entry.event==='control-request'));assert.equal(journal.length,recovery.diagnostics.length);
 await assertDialogFits('Results with recovery warning');
 fs.writeFileSync(path.join(fixture,'recovered-report.png'),(await window.webContents.capturePage()).toPNG());
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 lockReports=false;
 await evaluate(`window.fixtureSetMoreSubsystems();window.fixtureSetDsMode(false)`);
 await click('Characterize Robot');
 await wait(()=>evaluate(`!!document.querySelector('[aria-label="Subsystem pages"]')&&document.body.innerText.includes('before starting')`));
 await assertDialogFits('Setup with subsystem pages and Driver Station guidance');
 const goToPage=(group,page)=>evaluate(`document.querySelector('[aria-label="${group}"] [aria-label="Go to page ${page}"]').click()`);
 await goToPage('Subsystem pages',2);
 await evaluate(`(()=>{
   const labels=[...document.querySelectorAll('[role=dialog] label')];
   labels.find(el=>el.textContent.startsWith('Extra mechanism 8')).click();
   labels.find(el=>el.textContent.startsWith('The robot and test area are ready')).click();
   window.fixtureSetDsMode(true);
 })()`);
 await goToPage('Subsystem pages',1);
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Start characterization'&&!el.disabled)`));
 await click('Start characterization');
 await wait(()=>evaluate(`document.querySelector('[role=dialog]').innerText.includes('all selected subsystems')`));
 await assertDialogFits('Setup with a selection error');
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 const beforeManual=driverCalls.length;
 await click('Characterize Robot');
 await wait(()=>evaluate(`!!document.querySelector('[role=dialog] [role=combobox]')`));
 await choose('Subsystem types','Drivetrain');
 await wait(()=>evaluate(`document.querySelectorAll('[role=dialog] input[type=checkbox]').length===3`));
 await evaluate(`[...document.querySelectorAll('[role=dialog] input[type=checkbox]')].forEach(input=>input.click())`);
 await assertDialogFits('Drivetrain setup');
 await fill('Disabled gap (s)',.2);await fill('Median window',1);
 const requestsBefore=await evaluate('window.fixtureCalls.length');
 await click('Start walkthrough');
 for(let index=0;index<4;index++){
   await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Arm test'&&!el.disabled)`));
   assert.equal(await evaluate('window.fixtureCalls.length'),requestsBefore+index);
   await assertDialogFits('Manual drivetrain step');
   await click('Arm test');
   await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('Test armed')`));
   assert.equal(driverCalls.length,beforeManual);
   await evaluate('window.fixtureDsControl(true)');
   await wait(()=>evaluate(`document.querySelector('[role=status]')?.textContent.includes('Test finished. Disable')`));
   assert.ok(await evaluate(`![...document.querySelectorAll('button')].some(el=>el.textContent==='Arm test')`));
   await evaluate('window.fixtureDsControl(false)');
 }
 await wait(()=>reports().some(report=>report.manualControl&&report.outcome==='complete'));
 const manual=reports().find(report=>report.manualControl);
 assert.equal(manual.tests.length,8);
 assert.equal(manual.results.flatMap(result=>result.gains).length,8);
 assert.equal(driverCalls.slice(beforeManual).filter(action=>action==='enable').length,4,'Only steering uses automatic enable');
 const drivetrainRequests=await evaluate('window.fixtureCalls.filter(request=>!request.cancel).slice(-8)');
 assert.deepEqual(drivetrainRequests.map(request=>[request.target,!!request.manualControl]),[
   ...Array(4).fill(['drivetrain-drive',true]),...Array(4).fill(['drivetrain-steer',false])
 ]);
 await wait(()=>evaluate(`document.body.innerText.includes('Characterization complete.')`));
 await assertDialogFits('Combined drivetrain report');
 assert.ok(await evaluate(`(()=>{
   const region=document.querySelector('[aria-label="Scrollable gains table"]');
   const rows=region.querySelectorAll('tbody tr');
   const header=region.querySelector('thead th');
   const top=header.getBoundingClientRect().top;
   if(rows.length!==8||region.scrollHeight<=region.clientHeight)return false;
   region.scrollTop=region.scrollHeight;
   return region.scrollTop>0&&Math.abs(header.getBoundingClientRect().top-top)<1
     &&rows[7].getBoundingClientRect().bottom<=region.getBoundingClientRect().bottom+1;
 })()`),'All eight gains rows are reachable by scrolling the table with the header pinned');
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Robot');
 await wait(()=>evaluate(`!!document.querySelector('[role=dialog] [role=combobox]')`));
 await choose('Subsystem types','Drivetrain');
 await wait(()=>evaluate(`document.querySelectorAll('[role=dialog] input[type=checkbox]').length===3`));
 await evaluate(`(()=>{const options=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];options[1].click();options[2].click();})()`);
 await fill('Disabled gap (s)',.2);await fill('Median window',1);
 const beforeSteer=driverCalls.length;
 await click('Start characterization');
 await wait(()=>reports().some(report=>report.targets.length===1&&report.targets[0].kind==='steer'&&report.outcome==='complete'));
 assert.equal(driverCalls.slice(beforeSteer).filter(action=>action==='enable').length,4);
 assert.equal(reports().find(report=>report.targets.length===1&&report.targets[0].kind==='steer').tests.length,4);
 await wait(()=>evaluate(`document.body.innerText.includes('Characterization complete.')`));
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog] [role=combobox]')`));
 await choose('Subsystem types','Arms & elevators');
 await fill('Min (rot)',-.5);await fill('Max (rot)',.5);
 await fill('Lower stop (rot)',-.4);await fill('Upper stop (rot)',.35);
 await evaluate(`document.querySelector('[role=dialog] input[type=checkbox]').click()`);
 await click('SysId');
 await assertDialogFits('Arm SysId setup');
 await choose('Positive output moves','Toward higher positions');
 await fill('Horizontal position (rot)',0);await fill('SysId speed cutoff (rot/s)',.25);
 await click('Start SysId walkthrough');
 const beforePosition=driverCalls.length;
 for(let phase=0;phase<4;phase++){
   await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Arm test'&&!el.disabled)`));
   await click('Arm test');
   await wait(()=>evaluate(`document.body.innerText.includes('Test armed.')`));
   await evaluate('window.fixtureDsControl(true)');
   await wait(()=>evaluate(`document.body.innerText.includes('Test finished.')`));
   await evaluate('window.fixtureDsControl(false)');
 }
 await wait(()=>reports().some(report=>report.targets[0].kind==='position'&&report.outcome==='complete'));
 const positionReport=reports().find(report=>report.targets[0].kind==='position');
 assert.equal(positionReport.tests.length,4);
 assert.equal(positionReport.settings.positionTest.speedLimit,.25);
 assert.equal(typeof positionReport.results[0].gains[0].kG,'number');
 assert.equal(driverCalls.length,beforePosition);
 await wait(()=>evaluate(`document.querySelector('[aria-label="Characterization results"]')?.textContent.includes('kG')`));
 await assertDialogFits('Arm SysId report');
 await click('Run again');
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Start SysId walkthrough'&&el.disabled)`));
 assert.equal(await valueOf('Horizontal position (rot)'),'0');
 assert.equal(await valueOf('Upper stop (rot)'),'0.35');
 await evaluate(`document.querySelector('[role=dialog]').dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));document.querySelector('.MuiDialog-container').click();`);
 assert.equal(await evaluate(`!!document.querySelector('[role=dialog]')`),true);
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Robot');await wait(()=>evaluate(`!!document.querySelector('[role=dialog] [role=combobox]')`));
 await choose('Subsystem types','Arms & elevators');
 assert.equal(await valueOf('Upper stop (rot)'),'');
 console.log('Characterization UI passed: five-second defaults, target limits, motion data, progress, completion/Stop, paged subsystem list, timeout diagnostics, DS simulation, focus/privilege errors and report recovery. All DS scripts intercepted. '+fixture);
}
setTimeout(()=>{console.error('Characterization UI timeout');app.exit(1);},90000).unref();
app.on('browser-window-created',(_event,created)=>{
 window=created;window.hide();window.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_details,done)=>done({cancel:true}));
 window.webContents.once('did-finish-load',async()=>{
   try{await window.loadFile(path.join(ui,'index.html'));await run();}
   catch(error){console.error(error);try{fs.writeFileSync(path.join(fixture,'failure-ui.txt'),await evaluate('document.body.innerText'));}catch{}process.exitCode=1;}
   finally{window.destroy();app.exit(process.exitCode||0);}
 });
});
import(pathToFileURL(path.join(project,'dist-electron/main.js')).href).catch(error=>{console.error(error);app.exit(1);});
