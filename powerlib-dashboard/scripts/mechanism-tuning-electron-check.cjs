// Isolated desktop integration check; every publication is captured in memory.
const { app, BrowserWindow } = require("electron");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildSync } = require("esbuild");
const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "power-tool-mechanism-check-"));
let window;
app.whenReady().then(async () => {
  buildSync({ stdin: { contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { DashboardPanel } from ${JSON.stringify(path.join(project, "src/features/dashboard/DashboardPanel.tsx"))};
    import { sharedMechanismSettings } from ${JSON.stringify(path.join(project, "src/features/dashboard/mechanismTunables.ts"))};
    import { NetworkTablesProvider, useNetworkTables } from ${JSON.stringify(path.join(project, "src/features/networktables/NetworkTablesContext.tsx"))};
    window.writes = []; window.failSetting = "";
    function Fixture() {
      const { setTopics, setStatus, clientRef, upsertTopic, pruneTopics, setConnectionSettings } = useNetworkTables();
      const [requested, setRequested] = React.useState(false);
      React.useEffect(() => {
        const stamp = performance.now();
        const data = (owner, key, value) => ({name: '/PowerLib/Subsystems/'+owner+'/Data/'+key, type:'double', value, receivedAt:stamp});
        setTopics([
          ...['Intake', 'ShooterHood', 'Vision', 'LED'].map(owner => data(owner, 'Position', 1)),
          data('Drive','Pose/XMeters',1), data('Drive','Pose/YMeters',1), data('Drive','Pose/HeadingDegrees',0),
          {name:'/PowerLib/Tuning/Enabled', type:'boolean', value:false},
          ...['Intake','ShooterHood'].flatMap(owner => sharedMechanismSettings.map(row => ({
            name:'/PowerLib/Subsystems/'+owner+'/Variables/'+row.key, type:row.boolean?'boolean':'double',
            value:row.boolean?true:owner==='Intake'?1:9 }))),
          {name:'/PowerLib/Subsystems/Intake/Variables/Custom/EXTRA',type:'double',value:99},
          {name:'/PowerLib/Subsystems/Intake/Variables/Custom/ENABLED',type:'boolean',value:true},
          {name:'/PowerLib/Subsystems/Intake/Variables/Custom/LABEL',type:'string',value:'old'},
          {name:'/PowerLib/Subsystems/ShooterHood/Variables/Cancoder/MagnetOffset',type:'double',value:0.1},
          {name:'/PowerLib/Subsystems/ShooterHood/Variables/Cancoder/DiscontinuityPoint',type:'double',value:0.5},
          {name:'/PowerLib/Subsystems/Intake/Variables/Control/FOCEnabled',type:'boolean',value:true},
          {name:'/PowerLib/Subsystems/Intake/Variables/Ratios/SensorToMechanism',type:'double',value:1},
          {name:'/PowerLib/Subsystems/Intake/Variables/Feedforward/Torque',type:'double',value:99}
        ]);
        clientRef.current.publish = async (name,type,value) => {
          await new Promise(resolve=>setTimeout(resolve,30));
          if(window.failSetting && name.endsWith('/'+window.failSetting)) throw Error('Simulated failure');
          window.writes.push({name,type,value});
        };
        window.connect = () => setStatus('connected');
        window.disconnect = () => setStatus('disconnected');
        window.requestTuning = setRequested;
        window.acknowledge = value => upsertTopic({name:'/PowerLib/Tuning/Enabled',type:'boolean',value});
        window.removeVariable = () => pruneTopics(topic=>!topic.name.endsWith('/MotionMagic/Acceleration'));
        window.changeHost = () => setConnectionSettings({targetId:'custom',host:'another-robot',port:5810});
      }, []);
      return React.createElement(DashboardPanel,{tuningRequested:requested});
    }
    createRoot(document.getElementById('root')).render(React.createElement(NetworkTablesProvider,null,React.createElement(Fixture)));
  `, resolveDir: project }, bundle: true, platform: "browser", format: "iife", outfile: path.join(temporary, "fixture.js"),
    define: { "process.env.NODE_ENV": '"production"' } });
  fs.writeFileSync(path.join(temporary, "index.html"), '<html><head><link rel="stylesheet" href="fixture.css"></head><body style="margin:0"><div id="root"></div><script src="fixture.js"></script></body></html>');
  window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { partition: "mechanism-tuning-check", backgroundThrottling: false } });
  await window.loadFile(path.join(temporary, "index.html"));
  const result = await window.webContents.executeJavaScript(`(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const assert=(condition,message)=>{if(!condition) throw Error(message);};
    const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await sleep(30);}throw Error('UI wait timed out');};
    const input=label=>[...document.querySelectorAll('[role="dialog"] input')].find(el=>el.labels?.[0]?.textContent===label);
    const fill=async(label,value)=>{const el=input(label);assert(el,'Missing '+label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await sleep(30);};
    const apply=()=>[...document.querySelectorAll('[role="dialog"] button')].find(el=>el.textContent.startsWith('Apply'));
    const expand=async group=>{document.getElementById('mechanism-'+group.replaceAll(' ','-')+'-heading').click();await sleep(50);};
    await wait(()=>document.querySelector('section.dashboard-mechanism[aria-label="Intake"]'));
    const plainCard=()=>document.querySelector('section.dashboard-mechanism[aria-label="Intake"]');
    assert(!document.querySelector('.dashboard-mechanism-tunable'),'Disconnected cards have no tuning affordance');
    assert(getComputedStyle(plainCard()).cursor!=='pointer' && getComputedStyle(plainCard()).boxShadow==='none','Read-only cards have no pointer or glow');
    plainCard().click();await sleep(30);assert(!document.querySelector('[role="dialog"]'),'Disabled card clicks do nothing');
    window.connect();await sleep(50);
    assert(plainCard(),'Tuning request is required for clickable cards');
    window.requestTuning(true);await sleep(50);
    assert(plainCard(),'Robot acknowledgement is required for clickable cards');
    window.acknowledge(true);await wait(()=>document.querySelector('button[aria-label="Open Intake tunables"]'));
    const activeCard=document.querySelector('button[aria-label="Open Intake tunables"]');
    assert(getComputedStyle(activeCard).cursor==='pointer' && getComputedStyle(activeCard).boxShadow!=='none','Enabled mechanism cards have a pointer and lit border');
    assert(document.querySelector('.dashboard-drivetrain').tagName==='SECTION','Drive stays read only');
    assert(document.querySelector('.dashboard-mechanism[aria-label="Vision"]').tagName==='SECTION','Vision stays read only');
    assert(document.querySelector('.dashboard-mechanism[aria-label="LED"]').tagName==='SECTION','LED stays read only');
    document.querySelector('button[aria-label="Open Intake tunables"]').click();
    await wait(()=>document.querySelector('[role="dialog"]'));
    assert(document.querySelectorAll('[role="dialog"] input').length===0,'All sections start closed');
    assert(document.querySelectorAll('[role="dialog"] button[aria-expanded="false"]').length===4,'Three shared sections plus Custom are collapsed');
    assert(!document.getElementById('mechanism-Control-heading') && !document.getElementById('mechanism-Ratios-heading'),'Control and Ratios are removed');
    assert(!document.getElementById('mechanism-Sensor-heading'),'Sensor section is absent for mechanisms without CANcoder tunables');
    await expand('PID');await wait(()=>input('kP'));await expand('Custom');
    window.requestTuning(false);await wait(()=>input('kP').disabled);
    assert(plainCard() && !plainCard().classList.contains('dashboard-mechanism-tunable'),'Disabling tuning removes the clickable card and highlight');
    assert(apply().disabled,'Disabling tuning locks the open panel');
    window.requestTuning(true);window.acknowledge(false);await sleep(250);
    assert(input('kP').disabled && plainCard(),'Lost tuning acknowledgement removes card interaction');
    window.acknowledge(true);await wait(()=>!input('kP').disabled);
    await fill('kP','2.5');document.querySelector('[role="dialog"] input[type="checkbox"]').click();await sleep(30);apply().click();
    await wait(()=>window.writes.length===2);await sleep(250);
    assert(window.writes.every(write=>write.name.startsWith('/PowerLib/Subsystems/Intake/Variables/')),'Writes are scoped to the clicked mechanism');
    assert(window.writes.some(write=>write.name.endsWith('/Custom/ENABLED') && write.type==='boolean' && write.value===false),'Custom switches use boolean publications');
    assert(window.writes.some(write=>write.name.endsWith('/PID/kP') && write.value===2.5),'Numeric edit applied');
    await fill('LABEL','ready');apply().click();await wait(()=>window.writes.length===3);await sleep(250);
    assert(window.writes[2].type==='string' && window.writes[2].value==='ready','Custom text uses a string publication');
    await fill('kP','3');await expand('PID');await wait(()=>!input('kP'));await expand('PID');await wait(()=>input('kP'));
    assert(input('kP').value==='3','Collapsing a section preserves pending edits');
    document.querySelector('button[aria-label="Reset kP"]').click();await sleep(50);assert(input('kP').value==='2.5','Reset clears only the pending edit');
    await fill('kP','');await fill('kD','3');apply().click();await sleep(100);
    assert(window.writes.length===3,'Invalid numeric edit prevents all publications');
    assert(document.querySelector('[role="dialog"]').textContent.includes('Enter a number.'),'Validation error is shown');
    document.querySelector('button[aria-label="Reset kP"]').click();await sleep(30);
    document.querySelector('button[aria-label="Reset kD"]').click();await sleep(30);
    await fill('kP','4');await fill('kI','5');window.failSetting='PID/kI';apply().click();
    await wait(()=>document.querySelector('[role="alert"]')?.textContent.includes('remaining edits are kept'));
    assert(input('kI').value==='5','Failed edit is retained');
    window.failSetting='';apply().click();await wait(()=>window.writes.length===5);await sleep(250);
    await expand('Motion Magic');await wait(()=>input('Acceleration'));
    window.removeVariable();await wait(()=>input('Acceleration').disabled);
    assert(input('Acceleration').value==='','Missing robot values stay unavailable');
    await fill('kP','8');window.changeHost();await wait(()=>!input('kP'));await expand('PID');await wait(()=>input('kP'));assert(input('kP').value!=='8','Host change resets drafts and collapses sections');
    document.querySelector('button[aria-label="Close mechanism tunables"]').click();await wait(()=>!document.querySelector('[role="dialog"]'));
    document.querySelector('button[aria-label="Open Shooter Hood tunables"]').click();await wait(()=>document.querySelector('[role="dialog"]'));
    assert(!document.getElementById('mechanism-Custom-heading'),'Custom section is absent when no custom values exist');
    assert(document.getElementById('mechanism-Sensor-heading')?.getAttribute('aria-expanded')==='false','Applicable Sensor section starts collapsed');
    assert(document.querySelectorAll('[role="dialog"] button[aria-expanded="false"]').length===4,'New mechanism sections start closed');
    await expand('PID');await wait(()=>input('kP'));
    assert(input('kP').value==='9','Another card has its own values and no carried-over drafts');
    await fill('kP','6');apply().click();await wait(()=>window.writes.length===6);
    assert(window.writes[5].name==='/PowerLib/Subsystems/ShooterHood/Variables/PID/kP','Second card writes to its own owner');
    await sleep(250);await expand('Sensor');await wait(()=>input('Magnet offset (rotations)'));
    assert(input('Magnet offset (rotations)').value==='0.1' && input('Discontinuity point (rotations)').value==='0.5','Sensor fields show live CANcoder values');
    await fill('Magnet offset (rotations)','-0.25');await fill('Discontinuity point (rotations)','1');apply().click();await wait(()=>window.writes.length===8);
    assert(window.writes.some(write=>write.name==='/PowerLib/Subsystems/ShooterHood/Variables/Cancoder/MagnetOffset' && write.value===-0.25),'Magnet offset publishes to the selected sensor');
    assert(window.writes.some(write=>write.name==='/PowerLib/Subsystems/ShooterHood/Variables/Cancoder/DiscontinuityPoint' && write.value===1),'Discontinuity point publishes to the selected sensor');
    window.disconnect();await wait(()=>input('kP').disabled && plainCard() && !document.querySelector('.dashboard-mechanism-tunable'));assert(apply().disabled,'Connection loss locks Apply');
    assert(plainCard() && !document.querySelector('.dashboard-mechanism-tunable'),'Connection loss removes all tuning highlights');
    return 'Mechanism desktop checks passed: collapsed sections, conditional Sensor and Custom, excluded Control/Ratios/cards, tuning gates, typed owner-specific writes, edit preservation, validation, partial retry and isolation.';
  })()`);
  console.log(result);
  assert.ok(result.startsWith("Mechanism desktop checks passed"));
}).catch(error => { console.error(error); process.exitCode = 1; }).finally(() => {
  window?.destroy();
  if (path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith("power-tool-mechanism-check-")) fs.rmSync(temporary, { recursive: true, force: true });
  app.exit(process.exitCode ?? 0);
});
