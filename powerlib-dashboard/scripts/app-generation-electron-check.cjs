// Real Settings/Save Tuned Values views, production preload/IPC/source handlers and robot build.
// Only the disposable robot selected by the PowerShell runner can be modified.
const { app } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildSync } = require('esbuild');
process.on('uncaughtException', error => { console.error(error); app.exit(1); });
const project = path.resolve(__dirname, '..');
const root = path.dirname(project);
const fixture = path.resolve(process.argv[2] || '');
if (!fixture.toLowerCase().startsWith(path.join(root, 'build', 'app-generation-check-').toLowerCase())) throw Error('A disposable app-generation-check fixture is required.');
process.chdir(fixture);
const ui = path.join(fixture, 'check-ui');
fs.mkdirSync(ui, { recursive: true });
app.setPath('userData', path.join(ui, 'profile'));
let window;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const jsonFile = path.join(fixture, 'power-tool/generated/powerlib-subsystems.json');
async function readJava() { return renderRun(`const [subsystems,vision,localization,states]=await Promise.all([window.powerlib.readSubsystems(),window.powerlib.readVisionConfig(),window.powerlib.readLocalizationConfig(),window.powerlib.readStateConfig()]);return {...subsystems,vision:vision.vision,localization:localization.config,states:states.config.states};`); }
const source = relative => fs.readFileSync(path.join(fixture, 'src/main/java/frc/robot', relative), 'utf8');

buildSync({ stdin: { contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {ConfigDialog} from ${JSON.stringify(path.join(project, 'src/features/config/ConfigDialog.tsx'))};
  import {SaveTunedValuesDialog} from ${JSON.stringify(path.join(project, 'src/features/networktables/SaveTunedValuesDialog.tsx'))};
  import {drivetrainSettings} from ${JSON.stringify(path.join(project, 'src/features/dashboard/drivetrainTunables.ts'))};
  window.driveRows=drivetrainSettings;
  function Fixture(){
    const [doc,setDoc]=React.useState({loading:true,exists:false,path:'',subsystems:[],error:null});
    const [config,setConfig]=React.useState(true); const [tuned,setTuned]=React.useState(null);
    async function refresh(){const next=await window.powerlib.readSubsystems();setDoc({...next,loading:false,error:null});}
    React.useEffect(()=>{void refresh();window.showTuned=topics=>{setConfig(false);setTuned(topics);};window.showConfig=()=>{void refresh();setConfig(true);};},[]);
    return <>{config&&<ConfigDialog document={doc} onRefresh={refresh} onClose={()=>setConfig(false)} onSave={async subsystems=>{const next=await window.powerlib.saveSubsystems(subsystems);setDoc({...next,loading:false,error:null});}}/>}
      {tuned&&<SaveTunedValuesDialog open topics={tuned} onClose={()=>setTuned(null)}/>}</>;
  }
  createRoot(document.getElementById('root')).render(<Fixture/>);
`, resolveDir: project, loader: 'jsx' }, bundle: true, loader: { ".png": "file" }, platform: 'browser', format: 'iife', outfile: path.join(ui, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
fs.writeFileSync(path.join(ui, 'index.html'), '<html><head><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>');

async function renderRun(code) { return window.webContents.executeJavaScript(`(async()=>{${helpers}\n${code}})()`); }
const helpers = `
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const button=text=>[...document.querySelectorAll('button,[role="button"]')].find(el=>el.textContent===text);
  const input=(label,index=0)=>[...document.querySelectorAll('input')].filter(el=>el.labels?.[0]?.textContent===label)[index];
  const wait=async(predicate,message='UI wait timed out')=>{for(let i=0;i<200;i++){if(predicate())return;await sleep(30);}throw Error(message+' '+document.body.textContent.slice(-1500));};
  const fill=async(label,value,index=0)=>{const el=input(label,index);assert(el,'Missing '+label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(value));el.dispatchEvent(new Event('input',{bubbles:true}));await sleep(25);};
  const click=async text=>{await wait(()=>button(text)&&!button(text).disabled,'Missing enabled '+text);button(text).click();await sleep(40);};
  const select=async(label,value,index=0)=>{const labels=[...document.querySelectorAll('label')].filter(el=>el.textContent===label);const control=document.querySelector('[role="combobox"][aria-labelledby="'+labels[index].id+'"]');assert(control,'Missing select '+label);control.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,button:0}));await wait(()=>document.querySelector('[role="listbox"]'));const option=[...document.querySelectorAll('[role="option"]')].find(el=>el.textContent===value);assert(option,'Missing option '+value);option.click();await sleep(40);};
`;

async function wizardAndConfig() {
  return renderRun(`
    await wait(()=>button('Add Subsystem')&&!button('Add Subsystem').disabled);
    const cases=[['AuditVelocity','velocity','velocity'],['AuditTorque','velocity torque','velocityTorque'],['AuditAbsolute','absolute position','absolutePosition'],['AuditRelative','relative position','relativePosition']];
    for(let n=0;n<cases.length;n++){
      const [name,type]=cases[n]; await click('Add Subsystem');await wait(()=>input('Subsystem name'));
      await fill('Subsystem name',name);await select('Type',type);
      await fill('Sensor-to-mechanism ratio',n+1.25);await fill('Rotor-to-mechanism ratio',n+2.5);
      if(n===0){await select('Neutral mode','Coast');document.querySelector('input[type="checkbox"]').click();}
      await click('Continue');await wait(()=>input('CAN ID'));await fill('CAN ID',20+n*2);
      if(n===3)await select('Motor type','X44');
      document.querySelector('input[type="checkbox"]').click();await click('Add motor');await fill('CAN ID',21+n*2,1);await select('Motor type','X44',1);
      if(n===2){for(const [label,value] of Object.entries({'CANcoder CAN ID':36,'CANcoder magnet offset':0.125,'CANcoder discontinuity point':0.75,'Position units':'turns','Default position':0.25}))await fill(label,value);}
      if(n===3){for(const [label,value] of Object.entries({'Position units':'meters','Home position':-0.3,'Forward soft limit':4,'Reverse soft limit':-2,'Slow threshold':0.6,'Tolerance':0.04,'Stop voltage':-1.3,'Slow cruise velocity':0.7,'Slow acceleration':1.8}))await fill(label,value);}
      await click('Continue');await wait(()=>input('kP'));
      for(const [i,label] of ['kP','kI','kD','kG','kS','kV','kA','Acceleration','Cruise velocity'].entries())await fill(label,10*n+i+0.11);
      if(n===1)await fill('Torque FF',3.25);
      await click('Continue');await wait(()=>document.querySelector('.config-step-count')?.textContent==='Step 4 of 4');
      await click('Add Subsystem');await wait(()=>document.querySelector('[aria-label="Edit '+name+'"]')&&button('Add Subsystem'));
    }
    document.querySelector('[aria-label="Edit AuditAbsolute"]').click();await wait(()=>input('Subsystem name'));await fill('Subsystem name','AuditArm');
    await click('Continue');await wait(()=>input('CAN ID'));await click('Continue');await wait(()=>input('kP'));await click('Continue');await click('Save changes');await wait(()=>document.querySelector('[aria-label="Edit AuditArm"]'));
    await click('States');await wait(()=>button('Add State'));
    for(const name of ['READY','HOMING','TEMP']){await click('Add State');await fill('State name',name);await click('Save State');await wait(()=>!input('State name'));}
    document.querySelector('[aria-label="Edit TEMP"]').click();await wait(()=>input('State name'));await fill('State name','CLIMB');await click('Save State');await wait(()=>document.querySelector('[aria-label="Delete CLIMB"]'));
    for(const name of ['CLIMB','RETIRING']){document.querySelector('[aria-label="Delete '+name+'"]').click();await wait(()=>button('Delete State'));await click('Delete State');await wait(()=>!button('Delete State')&&!document.querySelector('[aria-label="Delete '+name+'"]'));}
    await click('Vision');await wait(()=>button('Add Limelight'));
    for(const camera of (await window.powerlib.readVisionConfig()).vision.limelights){document.querySelector('[aria-label="Delete '+camera.name+'"]').click();await wait(()=>!document.querySelector('[aria-label="Delete '+camera.name+'"]'));}
    for(const name of ['front','back','spare']){await click('Add Limelight');await fill('Limelight name',name);await click('Save Limelight');await wait(()=>!input('Limelight name'));}
    document.querySelector('[aria-label="Edit limelight-back"]').click();await wait(()=>input('Limelight name'));await fill('Limelight name','rear');await click('Save Limelight');await wait(()=>document.querySelector('[aria-label="Delete limelight-rear"]'));document.querySelector('[aria-label="Delete limelight-spare"]').click();await wait(()=>!document.querySelector('[aria-label="Delete limelight-spare"]'));
    await fill('Horizontal FOV (degrees)',63.4);await fill('Image width (px)',1280);await fill('Image height (px)',720);await click('Save camera settings');await wait(()=>button('Save camera settings').disabled);
    await click('Field');await wait(()=>input('Field length (m)'));await fill('Field length (m)',17.5);await fill('Field width (m)',8.5);await click('Save dimensions');await wait(()=>document.body.textContent.includes('Field dimensions saved.'));
    return {field:JSON.parse(localStorage.getItem('powerlib.driveDisplay.v1')),document:await window.powerlib.readSubsystems()};
  `);
}

async function saveTunedValues() {
  return renderRun(`
    const doc=await window.powerlib.readSubsystems(); const topics=[];
    const topic=(owner,key,value)=>topics.push({name:'/PowerLib/Subsystems/'+owner+'/Variables/'+key,type:typeof value==='number'?'double':typeof value,value});
    for(let n=0;n<doc.subsystems.length;n++){
      const owner=doc.subsystems[n].name;
      for(const [i,key] of ['PID/kP','PID/kI','PID/kD','PID/kG','Feedforward/kS','Feedforward/kV','Feedforward/kA','MotionMagic/Acceleration','MotionMagic/CruiseVelocity'].entries())topic(owner,key,100+n*10+i+0.25);
    }
    topic('AuditArm','Cancoder/MagnetOffset',0.2);topic('AuditArm','Cancoder/DiscontinuityPoint',0.8);topic('AuditArm','Position/Default',0.35);topic('AuditTorque','Feedforward/Torque',4.5);
    window.driveRows.forEach((row,i)=>topic('Swerve',row.key,i+0.321));
    topic('Vision','Position/TargetAreaThreshold',1.5);topic('Vision','Position/MaxTargetDistanceMeters',5.5);topic('Vision','Heading/MaxTagDistanceMeters',4.5);topic('Vision','Heading/SingleTagMaxDistanceMeters',2.5);
    topic('AuditGlobal','Custom/CUSTOM_GAIN',3.75);
    window.showTuned(topics);await wait(()=>button('Save selected')&&!button('Save selected').disabled);await click('Save selected');await wait(()=>document.body.textContent.includes('tuned values to Java'));
    return {topicCount:topics.length,document:await window.powerlib.readSubsystems(),localization:(await window.powerlib.readLocalizationConfig()).config};
  `);
}

function declaration(text, name) {
  const match = new RegExp('public\\s+static\\s+(?:final|volatile)\\s+[^;=]+?\\b' + name + '\\s*=\\s*([^;]+);').exec(text);
  assert.ok(match, `Missing declaration ${name}`); return match[1].trim();
}
function numberConstant(text, name, expected) {
  let value=declaration(text,name); const optional=/^Optional\.of\((.+)\)$/.exec(value);if(optional)value=optional[1];
  assert.equal(Number(value),Number(expected),`${name}: ${value} versus ${expected}`);
}
function checkGenerated(document) {
  const inventory=[];
  for (const subsystem of document.subsystems) {
    const name=subsystem.sourceClass ?? subsystem.name;const java=source(`constants/${name}Constants.java`);inventory.push(`${name}Constants.java`);
    for(const [key,value] of Object.entries(subsystem.pid))numberConstant(java,key.toUpperCase(),value);
    numberConstant(java,'SENSOR_TO_MECHANISM_RATIO',subsystem.ratios.sensorToMechanism);numberConstant(java,'ROTOR_TO_SENSOR_RATIO',subsystem.ratios.rotorToSensor);
    numberConstant(java,'MOTION_MAGIC_CRUISE_VELOCITY',subsystem.motionMagic.cruiseVelocity);numberConstant(java,'MOTION_MAGIC_ACCELERATION',subsystem.motionMagic.acceleration);
    assert.equal(declaration(java,'FOC_ENABLED'),String(subsystem.focEnabled));
    numberConstant(java,'LEADER_MOTOR_ID',subsystem.motors[0].id);assert.equal(declaration(java,'LEADER_REVERSED'),String(subsystem.motors[0].reversed));
    assert.equal(declaration(java,'LEADER_NEUTRAL_MODE').split('.').at(-1),subsystem.motors[0].neutralMode);
    assert.equal(declaration(java,'LEADER_MOTOR_TYPE').split('.').at(-1),subsystem.motors[0].motorType);
    numberConstant(java,'FOLLOWER_1_MOTOR_ID',subsystem.motors[1].id);
    assert.equal(declaration(java,'FOLLOWER_1_MOTOR_TYPE').split('.').at(-1),subsystem.motors[1].motorType);
    assert.equal(declaration(java,'FOLLOWER_1_REVERSED'),String(subsystem.motors[1].reversed));
    assert.ok(java.includes('LEADER_REVERSED, LEADER_MOTOR_TYPE)'),`${name} config uses leader type`);
    assert.ok(java.includes('FOLLOWER_1_REVERSED, FOLLOWER_1_MOTOR_TYPE)'),`${name} config uses follower type`);
    if(subsystem.type==='velocityTorque')numberConstant(java,'TORQUE_FF',4.5);
    if(subsystem.type==='absolutePosition'){
      numberConstant(java,'CANCODER_ID',36);numberConstant(java,'CANCODER_MAGNET_OFFSET',0.2);numberConstant(java,'CANCODER_DISCONTINUITY_POINT',0.8);numberConstant(java,'DEFAULT_POSITION',0.35);assert.equal(declaration(java,'POSITION_UNITS'),'"turns"');
    }
    if(subsystem.type==='relativePosition'){
      for(const [constant,key] of Object.entries({HOME_POSITION:'homePosition',FORWARD_SOFT_LIMIT:'forwardSoftLimit',REVERSE_SOFT_LIMIT:'reverseSoftLimit',SLOW_THRESHOLD:'slowThreshold',POSITION_TOLERANCE:'tolerance',STOP_VOLTAGE:'stopVoltage'}))numberConstant(java,constant,subsystem.relativePosition[key]);
      numberConstant(java,'SLOW_MOTION_MAGIC_CRUISE_VELOCITY',0.7);numberConstant(java,'SLOW_MOTION_MAGIC_ACCELERATION',1.8);assert.equal(declaration(java,'POSITION_UNITS'),'"meters"');
    }
    assert.ok(source('Constants.java').includes(`extends frc.robot.constants.${name}Constants`),`${name} Constants alias`);
    assert.ok(source('subsystems/StateMachine.java').includes(`Constants.${name}.`),`${name} StateMachine instance`);
  }
  const swerve=source('constants/SwerveConstants.java');
  const groups={driver:['DRIVER',''],requests:['REQUEST',''],driveToPoint:['DRIVE_TO_POINT',''],heading:['HEADING','']};
  const upper=value=>value.replace(/([a-z])([A-Z])/g,'$1_$2').toUpperCase();
  for(const [group,fields]of Object.entries(document.swerve).filter(([group])=>group!=='sourceRevision'))for(const [key,value]of Object.entries(fields))numberConstant(swerve,groups[group][0]+'_'+(group==='heading'?key.toUpperCase():upper(key)),value);
  const vision=source('constants/VisionConstants.java');
  assert.ok(vision.includes('"limelight-front", "limelight-rear"')||/"limelight-front"[\s\S]*"limelight-rear"/.test(vision));assert.ok(!vision.includes('limelight-spare'));
  numberConstant(vision,'LIMELIGHT_FOV_DEGREES',63.4);numberConstant(vision,'LIMELIGHT_IMAGE_WIDTH',1280);numberConstant(vision,'LIMELIGHT_IMAGE_HEIGHT',720);
  numberConstant(vision,'POSITION_TARGET_AREA_THRESHOLD',1.5);numberConstant(vision,'POSITION_MAX_TARGET_DISTANCE_METERS',5.5);numberConstant(vision,'HEADING_MAX_TAG_DISTANCE_METERS',4.5);numberConstant(vision,'HEADING_SINGLE_TAG_MAX_DISTANCE_METERS',2.5);
  const stateMachine=source('subsystems/StateMachine.java');
  for(const state of ['Idle','Ready','Homing'])assert.ok(source(`subsystems/states/${state}State.java`).includes(`class ${state}State`),`${state} handler generated`);
  assert.match(stateMachine,/enum RobotState\s*\{\s*READY,\s*HOMING,\s*IDLE\s*\}/,'Idle enum last');
  assert.match(stateMachine,/List\.of\(\s*new frc\.robot\.subsystems\.states\.ReadyState\(\),\s*new frc\.robot\.subsystems\.states\.HomingState\(\),\s*new IdleState\(\)\)/,'All state handlers checked, Idle last');
  numberConstant(source('constants/AuditGlobalConstants.java'),'CUSTOM_GAIN',3.75);assert.ok(source('constants/GeneratedTunableConstants.java').includes('AuditGlobalConstants.class'));
  for(const call of ['driveTelemetry.publish();','SubsystemTelemetry.publish();','TunableConstants.sync();'])assert.ok(source('subsystems/PowerDashboard.java').includes(call),`Dashboard missing ${call}`);
  for(const name of ['AuditVelocity','AuditTorque']){
    assert.ok(fs.existsSync(path.join(fixture,'src/main/java/frc/robot/characterization',name+'Characterization.java')),`Missing ${name} characterization class`);
    const dashboard=source('subsystems/PowerDashboard.java');
    assert.ok(dashboard.includes('new frc.robot.characterization.'+name+'Characterization(stateMachine.'),`Missing ${name} characterization instance`);
    for(const command of ['Quasistatic Forward','Quasistatic Reverse','Dynamic Forward','Dynamic Reverse'])assert.ok(dashboard.includes('registerCharacterizationCommand("'+name+'", "'+command+'"'),`Missing ${name} ${command} registration`);
  }
  return inventory;
}

async function run() {
  const configured=await wizardAndConfig();
  assert.equal(configured.document.subsystems.length,4);assert.equal(configured.document.subsystems[2].id,'auditabsolute','Rename must preserve stable ID');
  let document=await readJava();assert.deepEqual(document.states,['READY','HOMING','IDLE']);assert.equal(document.vision.limelights.length,2);
  assert.ok(!fs.existsSync(path.join(fixture,'src/main/java/frc/robot/subsystems/states/RetiringState.java')),'Confirmed handler deletion happens during Save');
  assert.ok(!('field'in document),'Field dimensions must stay laptop-local');
  fs.writeFileSync(path.join(fixture,'configured-from-app.json'),JSON.stringify(document,null,2));
  const tuned=await saveTunedValues();assert.equal(tuned.topicCount,60);
  document=await readJava();assert.deepEqual(document.states,['READY','HOMING','IDLE']);assert.equal(document.subsystems[0].pid.kP,100.25);
  fs.writeFileSync(path.join(fixture,'tuned-from-app.json'),JSON.stringify(document,null,2));
  console.log('Actual app views saved four mechanism types, motors/sensor, states, cameras, field display and 60 tuned values through production IPC.');
  const first=await renderRun(`return window.powerlib.runRobotAction("build");`);
  fs.writeFileSync(path.join(fixture,'build-first.log'),first.stdout+'\n'+first.stderr);assert.ok(first.stdout.includes('BUILD SUCCESSFUL'));
  document=await readJava();const inventory=checkGenerated(document);
  assert.ok(!fs.existsSync(path.join(fixture,'src/main/java/frc/robot/subsystems/states/RetiringState.java')),'Confirmed customized execute handler deleted');
  assert.ok(!fs.existsSync(jsonFile),'Normal saves must not create subsystem JSON');
  assert.ok(!fs.existsSync(path.join(fixture,'power-tool/generated/powerlib-constants.json')),'Normal saves must not create constants JSON');
  const javaRoot=path.join(fixture,'src/main/java');
  const javaFiles=fs.readdirSync(javaRoot,{recursive:true}).filter(name=>name.endsWith('.java')).sort();
  const before=new Map(javaFiles.map(name=>[name,fs.readFileSync(path.join(javaRoot,name),'utf8')]));
  const second=await renderRun(`return window.powerlib.runRobotAction("build");`);
  fs.writeFileSync(path.join(fixture,'build-second.log'),second.stdout+'\n'+second.stderr);assert.ok(second.stdout.includes('BUILD SUCCESSFUL'));
  checkGenerated(await readJava());assert.deepEqual(await readJava(),document,'Repeat build changed configuration');
  assert.deepEqual(fs.readdirSync(javaRoot,{recursive:true}).filter(name=>name.endsWith('.java')).sort(),javaFiles,'Repeat build changed the file inventory');
  for(const [name,value]of before)assert.equal(fs.readFileSync(path.join(javaRoot,name),'utf8'),value,`Repeat build changed ${name}`);
  fs.writeFileSync(path.join(fixture,'result.json'),JSON.stringify({passed:true,mechanisms:inventory,tunedValues:60,states:document.states,vision:document.vision,localization:document.localization,fieldDisplay:configured.field,builds:2},null,2));
  console.log('Every saved value matched generated Java; two real Build Robot invocations built successfully and retained identical constants.');
}

app.on('browser-window-created',(_event,created)=>{
  window=created;window.hide();
  window.webContents.setBackgroundThrottling(false);
  window.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_details,done)=>done({cancel:true}));
  window.webContents.once('did-finish-load',async()=>{
    try { await window.loadFile(path.join(ui,'index.html'));await run(); }
    catch(error){console.error(error);try{fs.writeFileSync(path.join(fixture,'failure-ui.txt'),await window.webContents.executeJavaScript('document.body.innerText'));}catch{}process.exitCode=1;}
    finally {window.destroy();app.exit(process.exitCode||0);}
  });
});
import(pathToFileURL(path.join(project,'dist-electron/main.js')).href).catch(error=>{console.error(error);app.exit(1);});
