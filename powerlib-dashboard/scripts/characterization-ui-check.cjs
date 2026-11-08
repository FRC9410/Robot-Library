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
let lockReports=false;
// Exercise production Driver Station IPC and script generation without ever
// executing those scripts or sending keyboard input to a real application.
childProcess.execFile=(...args)=>originalExecFile(...args);
childProcess.execFile[promisify.custom]=async(command,args,options)=>{
 const encodedIndex=args?.indexOf('-EncodedCommand')??-1;
 const fileIndex=args?.indexOf('-File')??-1;
 const script=fileIndex>=0?fs.readFileSync(args[fileIndex+1],'utf8'):encodedIndex>=0?Buffer.from(args[encodedIndex+1],'base64').toString('utf16le'):'';
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
fs.mkdirSync(fixture,{recursive:true});fs.writeFileSync(path.join(fixture,'build.gradle'),'// isolated characterization UI check');
process.chdir(fixture);app.setPath('userData',path.join(fixture,'profile'));
const extra=path.join(fixture,'fixture-preload.cjs');
fs.writeFileSync(extra,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('characterizationFixture',{prepare:data=>ipcRenderer.invoke('fixture:prepare',data)});`);
ipcMain.handle('fixture:prepare',(_event,test)=>{
  assert.match(test.id,/^[a-zA-Z0-9-]+$/);
  const template=runtime.tests.find(item=>item.phase===test.phase);assert.ok(template);
  const file=path.join(fixture,'logs/power-tool-characterization',test.id+'.wpilog');
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.copyFileSync(path.resolve(root,'build/characterization-runtime-check',template.file),file);return file;
});
app.whenReady().then(()=>session.defaultSession.registerPreloadScript({type:'frame',filePath:extra}));
const ui=path.join(fixture,'ui');fs.mkdirSync(ui);
buildSync({stdin:{contents:`
import React,{useEffect} from 'react';import {createRoot} from 'react-dom/client';
import {ThemeProvider,createTheme,CssBaseline} from '@mui/material';
import {NetworkTablesProvider,useNetworkTables} from ${JSON.stringify(path.join(project,'src/features/networktables/NetworkTablesContext.tsx'))};
import {LoadedLogsProvider} from ${JSON.stringify(path.join(project,'src/features/logs/LoadedLogsProvider.tsx'))};
import {LogsPanel} from ${JSON.stringify(path.join(project,'src/features/logs/LogsPanel.tsx'))};
import {PowerLibNt4Client} from ${JSON.stringify(path.join(project,'src/networktables/nt4Client.ts'))};
import ${JSON.stringify(path.join(project,'src/styles.css'))};
const base='/PowerLib/Characterization/';
let state={version:1,id:'',target:'',phase:'',state:'idle',error:'',file:'',simulation:true,controlMode:'simulation',enabled:false,test:true,fms:false,estop:false,dsAttached:true,commandScheduled:false,commandStarted:false};
window.fixtureCalls=[];
window.fixtureSetDsMode=test=>{state={...state,simulation:true,controlMode:'driver-station',test};};
window.fixtureDsControl=enabled=>{
 state={...state,enabled,commandScheduled:enabled,commandStarted:enabled,state:enabled?'running':state.state};
 const id=state.id;
 if(enabled)setTimeout(()=>{if(state.id===id&&state.enabled)state={...state,state:'complete'};},100);
};
PowerLibNt4Client.prototype.publish=async function(name,type,value){
 if(!name.startsWith(base))return;
 if(name===base+'request'){
   const request=JSON.parse(value);window.fixtureCalls.push(request);
   if(request.cancel){state={...state,enabled:false,state:'cancelled'};return;}
   const file=await window.characterizationFixture.prepare(request);
   state={...state,...request,file,state:'prepared',enabled:false,commandScheduled:false,commandStarted:false};
 }
 if(name===base+'simulationControl'){
   if(state.controlMode!=='simulation')throw Error('DS-controlled simulation received an internal enable/disable request');
   const [id,action]=value.split('|');if(id!==state.id)throw Error('Wrong test control');
   state={...state,enabled:action==='enable',commandScheduled:action==='enable',commandStarted:action==='enable',state:action==='enable'?'running':state.state};
   if(action==='enable'&&!window.fixtureStall)setTimeout(()=>{if(state.id===id&&state.enabled)state={...state,state:'complete'};},100);
 }
};
const subsystems=[{id:'velocity',name:'Shooter',type:'velocity'},{id:'torque',name:'Feeder',type:'velocityTorque'},{id:'position',name:'Arm',type:'absolutePosition'}];
const catalog=[{id:'velocity',group:'velocity',name:'Shooter',kind:'velocity',motors:['Shooter']},{id:'torque',group:'torque',name:'Feeder',kind:'velocityTorque',motors:['Feeder']},...['drive','steer'].map(kind=>({id:'drivetrain-'+kind,group:'drivetrain',name:'Drivetrain '+kind,kind,motors:['Module 1','Module 2','Module 3','Module 4']}))];
function Fixture(){const network=useNetworkTables();useEffect(()=>{
 network.setStatus('connected');
 const update=()=>network.setTopics([{name:base+'catalog',type:'string',value:JSON.stringify(catalog),receivedAt:performance.now()},{name:base+'status',type:'string',value:JSON.stringify(state),receivedAt:performance.now()}]);
 update();const timer=setInterval(update,25);return()=>clearInterval(timer);
},[]);return <LogsPanel active subsystems={subsystems}/>;}
createRoot(document.getElementById('root')).render(<ThemeProvider theme={createTheme({palette:{mode:'dark',primary:{main:'#facc15'}}})}><CssBaseline/><NetworkTablesProvider><LoadedLogsProvider><Fixture/></LoadedLogsProvider></NetworkTablesProvider></ThemeProvider>);
`,loader:'jsx',resolveDir:project},bundle:true,platform:'browser',format:'iife',loader:{'.png':'file'},outfile:path.join(ui,'fixture.js'),define:{'process.env.NODE_ENV':'"production"'}});
fs.writeFileSync(path.join(ui,'index.html'),'<html><head><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>');
let window;
const evaluate=code=>window.webContents.executeJavaScript(code);
const wait=async predicate=>{for(let i=0;i<600;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('Characterization UI wait timed out');};
const click=label=>evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent===${JSON.stringify(label)}&&!el.disabled).click()`);
const fill=(label,value)=>evaluate(`(()=>{const input=[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent===${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
const reports=()=>{const folder=path.join(fixture,'power-tool/characterization');return fs.existsSync(folder)?fs.readdirSync(folder).map(name=>{const recovery=path.join(folder,name,'characterization-recovery.json');return fs.existsSync(recovery)?recovery:path.join(folder,name,'characterization.json');}).filter(file=>fs.existsSync(file)).map(file=>JSON.parse(fs.readFileSync(file,'utf8'))):[];};
async function run(){
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Characterize Subsystems')`));
 await click('Characterize Subsystems');
 await wait(()=>evaluate(`document.querySelectorAll('[role=dialog] input[type=checkbox]').length===4`));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input:checked').length`),0);
 assert.ok(!(await evaluate(`document.querySelector('[role=dialog]').innerText`)).includes('Arm ('));
 assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Start characterization').disabled`),true);
 fs.writeFileSync(path.join(fixture,'modal.png'),(await window.webContents.capturePage()).toPNG());
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[1].click();checks[3].click();})()`);
 await fill('Disabled gap (s)',.2);await fill('Median window',1);
 await click('Start characterization');
 await wait(()=>reports().length===1&&reports()[0].outcome==='complete');
 await wait(()=>evaluate(`document.body.innerText.includes('Characterization complete.')`));
 const report=reports()[0];assert.equal(report.tests.length,8);assert.equal(report.results.length,2);
 assert.equal(report.results[0].gains[0].outputUnit,'V');assert.equal(report.results[1].gains[0].outputUnit,'A');
 assert.ok(await evaluate(`document.querySelector('[aria-label="Characterization results"]').innerText.includes('Feeder')`));
 fs.writeFileSync(path.join(fixture,'results.png'),(await window.webContents.capturePage()).toPNG());
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Subsystems');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 assert.equal(await evaluate(`document.querySelectorAll('[role=dialog] input:checked').length`),0);
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[3].click();})()`);
 await click('Start characterization');await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Stop characterization')`));
 await click('Stop characterization');await wait(()=>reports().length===2&&reports().some(report=>report.outcome==='cancelled'));
 const cancelled=reports().find(report=>report.outcome==='cancelled');assert.ok(cancelled.tests.length<4);
 await wait(()=>evaluate(`[...document.querySelectorAll('button')].some(el=>el.textContent==='Close')`));
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await click('Characterize Subsystems');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{window.fixtureStall=true;const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[3].click();})()`);
 await fill('Test duration (s)',.5);await click('Start characterization');
 await wait(()=>reports().some(report=>report.outcome==='failed'));
 await wait(()=>evaluate(`document.body.innerText.includes('Last robot status:')`));
 const failed=reports().find(report=>report.outcome==='failed');
 assert.ok(failed.error.includes('Shooter / quasistatic forward to complete'));
 assert.ok(failed.diagnostics.some(entry=>entry.event==='timeout'&&entry.robot.commandStarted===true));
 assert.ok(failed.diagnostics.some(entry=>entry.event==='control-request'&&entry.message.includes('disable')));
 fs.writeFileSync(path.join(fixture,'timeout.png'),(await window.webContents.capturePage()).toPNG());
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 await evaluate(`window.fixtureSetDsMode(false)`);
 await click('Characterize Subsystems');await wait(()=>evaluate(`document.body.innerText.includes('FRC Driver Station (simulation)')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[3].click();})()`);
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
 await click('Characterize Subsystems');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[3].click();})()`);
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
 await click('Characterize Subsystems');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[3].click();})()`);
 await click('Start characterization');
 await wait(()=>reports().length===6&&reports().filter(report=>report.outcome==='failed').length===3);
 const privilegeFailure=reports().find(report=>report.error?.includes('running as administrator'));
 assert.ok(privilegeFailure);assert.equal(privilegeFailure.tests.length,0);
 assert.equal(await evaluate('window.fixtureCalls.length'),before,'Privilege mismatch is detected before preparing or enabling a test');
 assert.ok(!privilegeFailure.error.includes('EncodedCommand'));
 await wait(()=>evaluate(`document.body.innerText.includes('running as administrator')`));
 await click('Close');await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
 driverFailure='';lockReports=true;
 await click('Characterize Subsystems');await wait(()=>evaluate(`!!document.querySelector('[role=dialog]')`));
 await evaluate(`(()=>{const checks=[...document.querySelectorAll('[role=dialog] input[type=checkbox]')];checks[0].click();checks[3].click();})()`);
 await fill('Disabled gap (s)',.2);await fill('Median window',1);await click('Start characterization');
 await wait(()=>reports().length===7&&reports().some(report=>report.outcome==='complete'&&report.storageWarning));
 await wait(()=>evaluate(`document.body.innerText.includes('Windows kept the original report locked')`));
 const recovery=reports().find(report=>report.storageWarning);assert.ok(recovery.path.endsWith('characterization-recovery.json'));
 const journal=fs.readFileSync(path.join(path.dirname(recovery.path),'diagnostics.jsonl'),'utf8').trim().split('\n').map(line=>JSON.parse(line));
 assert.ok(journal.some(entry=>entry.event==='control-request'));assert.equal(journal.length,recovery.diagnostics.length);
 fs.writeFileSync(path.join(fixture,'recovered-report.png'),(await window.webContents.capturePage()).toPNG());
 console.log('Characterization UI passed: completion/Stop, timeout diagnostics, DS simulation, focus/privilege errors, and persistent Windows lock recovery with a durable journal. All DS scripts intercepted. '+fixture);
}
setTimeout(()=>{console.error('Characterization UI timeout');app.exit(1);},60000).unref();
app.on('browser-window-created',(_event,created)=>{
 window=created;window.hide();window.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_details,done)=>done({cancel:true}));
 window.webContents.once('did-finish-load',async()=>{
   try{await window.loadFile(path.join(ui,'index.html'));await run();}
   catch(error){console.error(error);try{fs.writeFileSync(path.join(fixture,'failure-ui.txt'),await evaluate('document.body.innerText'));}catch{}process.exitCode=1;}
   finally{window.destroy();app.exit(process.exitCode||0);}
 });
});
import(pathToFileURL(path.join(project,'dist-electron/main.js')).href).catch(error=>{console.error(error);app.exit(1);});
