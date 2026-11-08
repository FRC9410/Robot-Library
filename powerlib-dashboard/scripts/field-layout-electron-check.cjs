// Exercise the production App/menu/preload with isolated preferences and an in-memory robot.
const { app, Menu, nativeImage } = require('electron');
process.on('uncaughtException', error=>{console.error(error);app.exit(1);});
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');
const { buildSync } = require('esbuild');
const project = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const fixture = path.join(project, '../build/dashboard-checks/fields-' + Date.now());
fs.mkdirSync(fixture, { recursive: true });
fs.writeFileSync(path.join(fixture, 'build.gradle'), '// isolated UI check');
process.chdir(fixture);
app.setPath('userData', path.join(fixture, 'profile'));
const sample = path.join(fixture, 'sample.wpilog');
const generated = spawnSync(process.execPath, [path.join(__dirname, 'log-check.mjs'), '--write-sample', sample],
  { env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }, encoding: 'utf8' });
assert.equal(generated.status, 0, generated.stderr);
const sampleBytes = [...fs.readFileSync(sample)];
const testImage=nativeImage.createFromBitmap(Buffer.alloc(16,200),{width:2,height:2});
const uploadFiles={png:[...testImage.toPNG()],jpeg:[...testImage.toJPEG(80)],
  webp:[...Buffer.from('UklGRjgAAABXRUJQVlA4ICwAAACwAQCdASoCAAIAAUAmJaACdLoABDAAAP7ni/6+AKfs//qcf/Jx/8nH9ZQAAA==','base64')]};
buildSync({ stdin: { contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {ThemeProvider,createTheme,CssBaseline} from '@mui/material';
  import {App} from ${JSON.stringify(path.join(project, 'src/App.tsx'))};
  import {LoadedLogsProvider} from ${JSON.stringify(path.join(project, 'src/features/logs/LoadedLogsProvider.tsx'))};
  import {PowerLibNt4Client} from ${JSON.stringify(path.join(project, 'src/networktables/nt4Client.ts'))};
  import {setFieldLayoutId} from ${JSON.stringify(path.join(project, 'src/features/field/fieldLayouts.ts'))};
  import {saveFieldDimensions} from ${JSON.stringify(path.join(project, 'src/features/dashboard/dashboardSettings.ts'))};
  import ${JSON.stringify(path.join(project, 'src/styles.css'))};
  if (!localStorage.getItem('powerlib.driveDisplay.v1')) localStorage.setItem('powerlib.driveDisplay.v1', JSON.stringify({length:12,width:6,flip:true,urls:{}}));
  window.fieldTest={setFieldLayoutId,saveFieldDimensions,dropLog(){
    const transfer=new DataTransfer();transfer.items.add(new File([new Uint8Array(${JSON.stringify(sampleBytes)})],'sample.wpilog'));
    [...document.querySelectorAll('button')].find(el=>el.textContent==='Open log').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
  },uploadImage(kind,method='drop'){
    const bytes=(${JSON.stringify(uploadFiles)})[kind]||[98,97,100];
    const type=kind==='text'?'text/plain':'image/'+(kind==='broken'?'png':kind);
    const file=new File([kind==='oversize'?new Uint8Array(10*1024*1024+1):new Uint8Array(bytes)],'Practice.'+(kind==='text'?'txt':kind),{type:kind==='oversize'?'image/png':type});
    const transfer=new DataTransfer();transfer.items.add(file);
    if(method==='input'){
      const input=document.querySelector('input[aria-label="Choose field image"]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));
    }else document.querySelector('[aria-label="Upload field image"]').dispatchEvent(new DragEvent('drop',{bubbles:true,dataTransfer:transfer}));
  }};
  PowerLibNt4Client.prototype.connect=function(_host,_port,callback){setTimeout(()=>callback(true),0);};
  PowerLibNt4Client.prototype.disconnect=function(){};
  PowerLibNt4Client.prototype.watchCameraAnnouncements=function(){};
  PowerLibNt4Client.prototype.publish=async function(){throw Error('Test must not publish');};
  PowerLibNt4Client.prototype.watchPrefix=function(prefix,callback){
    const send=()=>{if(prefix==='/PowerLib/')for(const [key,value] of Object.entries({'Heartbeat':2,'Enabled':false,'Pose/XMeters':2,'Pose/YMeters':3,'Pose/HeadingDegrees':90}))
      callback({name:'/PowerLib/Drive/'+key,value,type:typeof value,receivedAt:performance.now()});};
    send();const timer=setInterval(send,100);return()=>clearInterval(timer);
  };
  createRoot(document.getElementById('root')).render(<ThemeProvider theme={createTheme({palette:{mode:'dark',primary:{main:'#facc15'}}})}><CssBaseline/><LoadedLogsProvider><App/></LoadedLogsProvider></ThemeProvider>);
`, loader: 'jsx', resolveDir: project }, bundle: true, platform: 'browser', format: 'iife',
  loader: { '.png': 'file' }, outfile: path.join(fixture, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
fs.writeFileSync(path.join(fixture, 'index.html'), '<html><head><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>');
let window;
const evaluate = async code => {
  try { return await window.webContents.executeJavaScript(code); }
  catch(error) { throw new Error(`${code.slice(0, 300)}: ${error.message}`); }
};
const wait = async predicate => {
  for(let i=0;i<240;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}
  throw Error('Field UI wait timed out');
};
const tab = async name => {
  await evaluate(`[...document.querySelectorAll('[role=tab]')].find(el=>el.textContent===${JSON.stringify(name)}).click()`);
  await wait(()=>evaluate(`[...document.querySelectorAll('[role=tab]')].some(el=>el.textContent===${JSON.stringify(name)} && el.getAttribute('aria-selected')==='true')`));
};
const fieldState = selector => evaluate(`(()=>{const field=document.querySelector(${JSON.stringify(selector)});return field && {id:field.dataset.fieldLayout,length:+field.dataset.fieldLength,width:+field.dataset.fieldWidth};})()`);
const dashboard = '.dashboard-stage > svg';
const logs = 'svg[aria-label="Robot position on the field"]';
const autos = 'svg[aria-label="Field and robot position"]';
const choose = async id => {
  const item=Menu.getApplicationMenu().getMenuItemById('field-layout:'+id);
  assert.ok(item);item.click();
  await wait(()=>evaluate(`localStorage.getItem('powerlib.fieldLayout.v1')===${JSON.stringify(id)}`));
};
const imageLoads = () => evaluate(`Promise.all([...document.querySelectorAll('svg image')].map(element=>new Promise(resolve=>{
  const img=new Image();img.onload=()=>resolve(img.naturalWidth>0);img.onerror=()=>resolve(false);img.src=element.getAttribute('href');
})))`);
const screenshot = async name => {
  await new Promise(resolve=>setTimeout(resolve,150));
  fs.writeFileSync(path.join(fixture,name+'.png'),(await window.webContents.capturePage()).toPNG());
};
const openFieldConfig = async()=>{
  await tab('Dashboard');await evaluate(`document.querySelector('[aria-label="Open Config"]').click()`);
  await wait(()=>evaluate(`!![...document.querySelectorAll('nav button,nav [role=button]')].find(el=>el.textContent==='Field')`));
  await evaluate(`[...document.querySelectorAll('nav button,nav [role=button]')].find(el=>el.textContent==='Field').click()`);
  await wait(()=>evaluate(`!!document.querySelector('[aria-label="Upload field image"]')`));
};
const closeConfig = async()=>{
  await evaluate(`document.querySelector('[aria-label="Close Config"]').click()`);
  await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
};
const fillUpload = async(label,length,width)=>{
  await evaluate(`(()=>{const values=${JSON.stringify([label,String(length),String(width)])};const labels=['Uploaded field name','Uploaded field length (m)','Uploaded field width (m)'];
    labels.forEach((label,index)=>{const input=[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent===label);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,values[index]);input.dispatchEvent(new Event('input',{bubbles:true}));});})()`);
};
const saveUpload = async()=>{
  await evaluate(`[...document.querySelectorAll('button')].find(el=>/^(Save|Replace) uploaded field$/.test(el.textContent)).click()`);
  await wait(()=>evaluate(`document.body.textContent.includes('Uploaded field saved and selected')`));
};
setTimeout(()=>{console.error('Field check timed out.');app.exit(1);},60000).unref();
app.on('browser-window-created', (_event, created)=>{
  window=created;window.hide();window.webContents.setBackgroundThrottling(false);
  window.webContents.on('console-message',details=>{if(details.level==='error')console.error(details.message);});
  window.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_details,done)=>done({cancel:true}));
  window.webContents.once('did-finish-load', async()=>{
    try {
      await window.loadURL(pathToFileURL(path.join(fixture,'index.html')).href);
      await wait(()=>fieldState(dashboard));
      assert.deepEqual(await fieldState(dashboard),{id:'none',length:12,width:6});
      assert.equal(await evaluate(`[...document.querySelectorAll('[role=tab]')].at(-1).textContent`),'Autos');
      for(const [id,length,width] of [['2026-rebuilt-simplified',16.541,8.069],['2026-rebuilt',16.541,8.069],['2025-reefscape',17.548,8.052]]){
        await tab('Dashboard');await choose(id);
        await wait(async()=> (await fieldState(dashboard))?.id===id);
        const expected={id,length,width};
        assert.deepEqual(await fieldState(dashboard),expected);
        assert.deepEqual(await fieldState('.dashboard-field-preview > svg'),expected);
        assert.ok((await imageLoads()).every(Boolean),'Dashboard images load');
        await wait(()=>evaluate(`!!document.querySelector('${dashboard} [data-robot-pose]')`));
        const pose=await evaluate(`document.querySelector('${dashboard} [data-robot-pose]').getAttribute('transform')`);
        await tab('Autos');await wait(()=>fieldState(autos));
        await wait(()=>evaluate(`!!document.querySelector('${autos} [data-robot-pose]')`));
        assert.deepEqual(await fieldState(autos),expected);
        assert.equal(await evaluate(`document.querySelector('${autos} [data-robot-pose]').getAttribute('transform')`),pose,'Live pose coordinates match');
        assert.ok((await imageLoads()).every(Boolean),'Autos images load');
      }
      await window.webContents.reload();await wait(()=>fieldState(dashboard));
      assert.equal((await fieldState(dashboard)).id,'2025-reefscape','Layout survives reload');
      await wait(()=>Menu.getApplicationMenu().getMenuItemById('field-layout:2025-reefscape').checked);
      await evaluate(`document.querySelector('[aria-label="Open Config"]').click()`);
      await wait(()=>evaluate(`!![...document.querySelectorAll('nav button,nav [role=button]')].find(el=>el.textContent==='Field')`));
      await evaluate(`[...document.querySelectorAll('nav button,nav [role=button]')].find(el=>el.textContent==='Field').click()`);
      await wait(()=>evaluate(`!!document.querySelector('form input[type=number]')`));
      assert.deepEqual(await evaluate(`[...document.querySelectorAll('form input[type=number]')].map(el=>({value:+el.value,disabled:el.disabled}))`),
        [{value:17.548,disabled:true},{value:8.052,disabled:true}]);
      await evaluate(`document.querySelector('form [role=combobox]').dispatchEvent(new MouseEvent('mousedown',{bubbles:true}))`);
      await wait(()=>evaluate(`!!document.querySelector('[role=option][data-value="2026-rebuilt-simplified"]')`));
      await evaluate(`document.querySelector('[role=option][data-value="2026-rebuilt-simplified"]').click()`);
      await wait(async()=> (await fieldState(dashboard))?.id==='2026-rebuilt-simplified');
      await wait(()=>Menu.getApplicationMenu().getMenuItemById('field-layout:2026-rebuilt-simplified').checked);
      await choose('2025-reefscape');
      await evaluate(`document.querySelector('[aria-label="Close Config"]').click()`);
      await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
      await tab('Logs');await evaluate('window.fieldTest.dropLog()');await wait(()=>fieldState(logs));
      assert.deepEqual(await fieldState(logs),{id:'2025-reefscape',length:17.548,width:8.052});
      assert.ok((await imageLoads()).every(Boolean),'Log viewer image loads');
      await choose('2026-rebuilt-simplified');
      await wait(async()=> (await fieldState(logs))?.id==='2026-rebuilt-simplified');
      await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Heat map').click()`);
      await choose('2026-rebuilt');await wait(async()=> (await fieldState(logs))?.id==='2026-rebuilt');
      assert.ok((await imageLoads()).every(Boolean),'Heatmap backdrop loads');
      await choose('none');await wait(async()=> (await fieldState(logs))?.id==='none');
      assert.deepEqual(await fieldState(logs),{id:'none',length:12,width:6},'Custom dimensions restored');
      await evaluate('window.fieldTest.saveFieldDimensions({length:14,width:7})');
      await wait(async()=> (await fieldState(logs))?.length===14);
      assert.deepEqual(await fieldState(logs),{id:'none',length:14,width:7},'Open log updates without switching tabs');
      await tab('Dashboard');assert.deepEqual(await fieldState(dashboard),{id:'none',length:14,width:7});
      await tab('Autos');assert.deepEqual(await fieldState(autos),{id:'none',length:14,width:7});
      await choose('2026-rebuilt-simplified');
      await wait(async()=> (await fieldState(autos))?.id==='2026-rebuilt-simplified');
      await screenshot('autos');
      await tab('Dashboard');await screenshot('dashboard');
      await tab('Logs');await screenshot('logs');
      console.log('Field UI passed: production menu/preload, all layouts in Dashboard/thumbnail/Autos, live pose alignment, image loading, reload persistence, open-log/heatmap updates, custom dimensions.');
      await openFieldConfig();
      await evaluate(`window.fieldTest.uploadImage('text')`);
      await wait(()=>evaluate(`document.body.textContent.includes('Choose a PNG, JPEG, or WebP')`));
      await evaluate(`window.fieldTest.uploadImage('broken')`);
      await wait(()=>evaluate(`document.body.textContent.includes('could not be decoded')`));
      await evaluate(`window.fieldTest.uploadImage('oversize')`);
      await wait(()=>evaluate(`document.body.textContent.includes('nonempty field image up to 10 MB')`));
      assert.equal((await fieldState(dashboard)).id,'2026-rebuilt-simplified','Rejected files leave the active layout alone');
      await evaluate(`window.fieldTest.uploadImage('png','input')`);
      await wait(()=>evaluate(`!!document.querySelector('img[alt="Uploaded field preview"]')`));
      await fillUpload('Practice field',10,5);
      await screenshot('upload-preview');
      await saveUpload();
      const expected={id:'uploaded-field',length:10,width:5};
      await wait(async()=> (await fieldState(dashboard))?.id===expected.id);
      assert.deepEqual(await fieldState(dashboard),expected);
      assert.deepEqual(await fieldState('.dashboard-field-preview > svg'),expected);
      await wait(()=>Menu.getApplicationMenu().getMenuItemById('field-layout:uploaded-field').enabled);
      assert.ok(Menu.getApplicationMenu().getMenuItemById('field-layout:uploaded-field').checked);
      await closeConfig();await tab('Autos');assert.deepEqual(await fieldState(autos),expected);
      assert.ok((await imageLoads()).every(Boolean));
      await tab('Logs');assert.deepEqual(await fieldState(logs),expected);assert.ok((await imageLoads()).every(Boolean));
      await window.webContents.reload();await wait(async()=> (await fieldState(dashboard))?.id===expected.id);
      assert.deepEqual(await fieldState(dashboard),expected,'Upload survives reload');
      assert.ok((await imageLoads()).every(Boolean),'Saved image bytes survive reload');
      for(const kind of ['jpeg','webp']){
        await openFieldConfig();await evaluate(`window.fieldTest.uploadImage('${kind}')`);
        await wait(()=>evaluate(`!!document.querySelector('img[alt="Uploaded field preview"]')`));
        await fillUpload('Replacement '+kind,11,5.5);await saveUpload();
        assert.deepEqual(await fieldState(dashboard),{id:'uploaded-field',length:11,width:5.5},'Replacing selected upload updates all geometry');
        assert.ok((await imageLoads()).every(Boolean));await closeConfig();
      }
      await openFieldConfig();await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Edit uploaded field').click()`);
      await wait(()=>evaluate(`!!document.querySelector('img[alt="Uploaded field preview"]')`));
      await fillUpload('Edited practice field',12,6);
      await evaluate(`document.querySelector('[aria-label="Custom field upload"] input[type=checkbox]').click()`);
      await saveUpload();
      assert.deepEqual(await fieldState(dashboard),{id:'uploaded-field',length:12,width:6});
      assert.equal(await evaluate('(async()=>(await window.powerlib.readUploadedField()).image.rotate180)()'),true);
      await closeConfig();
      const invalidSave=await evaluate(`(async()=>{const old=await window.powerlib.readUploadedField();try{await window.powerlib.saveUploadedField({...old,image:{...old.image,href:'data:image/png;base64,YmFk'}});return false;}catch{return JSON.stringify(await window.powerlib.readUploadedField())===JSON.stringify(old);}})()`);
      assert.equal(invalidSave,true,'Main process rejects invalid image bytes and preserves the saved upload');
      await choose('2025-reefscape');await choose('uploaded-field');
      await wait(async()=> (await fieldState(dashboard))?.id==='uploaded-field');
      await openFieldConfig();await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Remove uploaded field').click()`);
      await wait(()=>evaluate(`document.body.textContent.includes('Uploaded field removed.')`));
      assert.deepEqual(await fieldState(dashboard),{id:'none',length:14,width:7},'Removal restores custom dimensions');
      assert.equal(await evaluate('window.powerlib.readUploadedField()'),null);
      await wait(()=>!Menu.getApplicationMenu().getMenuItemById('field-layout:uploaded-field').enabled);
      console.log('Field upload UI passed: input/drop, PNG/JPEG/WebP, preview, custom dimensions, shared views, persisted bytes, replacement, invalid-file preservation, and removal.');
      await closeConfig();
      await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Disconnect').click()`);
      await wait(()=>evaluate(`document.querySelector('${dashboard}').textContent.includes('Waiting for live robot pose')`));
      await tab('Autos');
      assert.equal(await evaluate(`document.querySelector('${autos}').textContent.includes('Waiting for live robot pose')`),false,'Autos can show its field without a live robot');
      await tab('Logs');await evaluate('window.fieldTest.dropLog()');await wait(()=>fieldState(logs));
      assert.equal(await evaluate(`document.querySelector('${logs}').textContent.includes('Waiting for live robot pose')`),false,'Logs use recorded poses while disconnected');
      console.log('Pose status passed: only Dashboard waits for live pose; Autos and recorded Logs work while disconnected.');
      console.log('Screenshots: '+fixture);
    }catch(error){console.error(error);process.exitCode=1;}
    finally{window.destroy();app.exit(process.exitCode||0);}
  });
});
import(pathToFileURL(path.join(project,'dist-electron/main.js')).href).catch(error=>{console.error(error);app.exit(1);});
