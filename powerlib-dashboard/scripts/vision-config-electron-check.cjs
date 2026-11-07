// Isolated Config UI check; configuration writes stay in memory.
const { app, BrowserWindow } = require("electron");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { buildSync } = require("esbuild");
const project = path.resolve(__dirname, "..");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "power-tool-vision-ui-"));
let window;
app.whenReady().then(async () => {
  buildSync({ stdin: { contents: `
    import React from "react";
    import { createRoot } from "react-dom/client";
    import { ConfigDialog } from ${JSON.stringify(path.join(project, "src/features/config/ConfigDialog.tsx"))};
    window.vision = {fovDegrees:60,imageWidth:320,imageHeight:240,limelights:[]};window.saves=[];window.failSave=false;
    window.states=['IDLE','READY'];window.stateSaves=[];window.failStateSave=false;
    window.powerlib={readVisionConfig:async()=>({path:'fixture',vision:structuredClone(window.vision)}),
      readStateConfig:async()=>({path:'fixture',config:{states:[...window.states]}}),
      saveStateConfig:async config=>{if(window.failStateSave)throw Error('Simulated state write failure');window.states=[...config.states];window.stateSaves.push([...window.states]);return {path:'fixture',config:{states:window.states}};},
      saveVisionConfig:async vision=>{if(window.failSave)throw Error('Simulated write failure');window.vision=structuredClone(vision);window.saves.push(window.vision);return {path:'fixture',vision:window.vision};}};
    createRoot(document.getElementById('root')).render(React.createElement(ConfigDialog,{
      document:{loading:false,exists:true,path:'fixture',subsystems:[],error:null},onRefresh(){},onSave:async()=>{},onClose(){}
    }));
  `, resolveDir: project }, bundle: true, platform: "browser", format: "iife", outfile: path.join(temporary, "fixture.js"), define: { "process.env.NODE_ENV": '"production"' } });
  fs.writeFileSync(path.join(temporary, "index.html"), '<html><head><link rel="stylesheet" href="fixture.css"></head><body style="margin:0;background:#101217;color:#ddd"><div id="root"></div><script src="fixture.js"></script></body></html>');
  window = new BrowserWindow({ show: false, width: 1280, height: 900, webPreferences: { partition: "vision-config-check", backgroundThrottling: false } });
  await window.loadFile(path.join(temporary, "index.html"));
  console.log(await window.webContents.executeJavaScript(`(async()=>{
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const assert=(condition,message)=>{if(!condition)throw Error(message);};
    const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await sleep(30);}throw Error('UI wait timed out');};
    const button=text=>[...document.querySelectorAll('button,[role="button"]')].find(el=>el.textContent===text);
    const input=label=>[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent===label);
    const fill=async(label,value)=>{const el=input(label);assert(el,'Missing '+label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));await sleep(30);};
    await wait(()=>button('Vision'));button('Vision').click();await wait(()=>button('Add Limelight')&&!button('Add Limelight').disabled);
    assert(document.querySelector('h3').textContent==='Vision','Vision view owns its heading');
    const card=document.querySelector('section[aria-label="Vision configuration"]');
    const list=document.querySelector('section[aria-label="Limelights"]');
    const globals=document.querySelector('form[aria-label="Global camera settings"]');
    assert(card.contains(list)&&card.contains(globals),'Limelight names and global settings share one card');
    assert(list.getBoundingClientRect().bottom<globals.getBoundingClientRect().top,'The list is above global settings with a gap');
    assert(list.contains(button('Add Limelight')),'Add Limelight belongs to the list');
    assert(!document.body.textContent.includes('Configure your Limelight cameras.')&&!document.body.textContent.includes('FOV and image size are shared camera descriptions.'),'Requested descriptions are removed');
    await fill('Horizontal FOV (degrees)','63.3');await fill('Image width (px)','640');await fill('Image height (px)','480');
    button('Save camera settings').click();await wait(()=>window.saves.length===1&&!button('Add Limelight').disabled&&button('Save camera settings').disabled);
    assert(window.vision.fovDegrees===63.3&&window.vision.imageWidth===640&&window.vision.imageHeight===480,'Global settings save without any cameras');
    await fill('Image width (px)','1280');window.failSave=true;button('Save camera settings').click();
    await wait(()=>document.querySelector('form[aria-label="Global camera settings"] [role="alert"]')?.textContent.includes('Simulated write failure'));
    assert(window.vision.imageWidth===640&&input('Image width (px)').value==='1280','Failed global save retains saved values and the pending edit');
    window.failSave=false;await fill('Image width (px)','640');
    button('Add Limelight').click();await wait(()=>input('Limelight name'));
    assert(document.querySelector('form[aria-label="Limelight name editor"]').textContent.includes('limelight-'),'Editor shows the fixed prefix');
    assert(document.querySelectorAll('form[aria-label="Limelight name editor"] input').length===1,'Camera entries only edit the name');
    assert(document.querySelectorAll('input[type="number"]').length===3,'There is only one global set of camera settings');
    await fill('Limelight name','limelight-front');assert(input('Limelight name').value==='front','Pasting a full name does not duplicate the prefix');
    button('Save Limelight').click();await wait(()=>window.saves.length===2&&!input('Limelight name')&&!button('Add Limelight').disabled);
    assert(window.vision.limelights[0].name==='limelight-front'&&Object.keys(window.vision.limelights[0]).length===1,'Camera persists with only its name');
    assert(window.vision.imageWidth===640&&window.vision.fovDegrees===63.3,'Adding a camera preserves shared settings');
    button('Add Limelight').click();await wait(()=>input('Limelight name'));await fill('Limelight name','front');button('Save Limelight').click();
    await wait(()=>document.querySelector('form[aria-label="Limelight name editor"] [role="alert"]')?.textContent.includes('already exists'));assert(window.saves.length===2,'Duplicate name is not saved');
    await fill('Limelight name','back');button('Save Limelight').click();await wait(()=>window.saves.length===3&&!input('Limelight name')&&!button('Add Limelight').disabled);
    document.querySelector('[aria-label="Edit limelight-front"]').click();await wait(()=>input('Limelight name'));await fill('Limelight name','left');button('Save Limelight').click();await wait(()=>window.saves.length===4&&!input('Limelight name')&&!button('Add Limelight').disabled);
    assert(window.vision.limelights[0].name==='limelight-left'&&window.vision.fovDegrees===63.3,'Renaming preserves global FOV');
    assert(window.vision.limelights[1].name==='limelight-back'&&window.vision.imageWidth===640&&window.vision.imageHeight===480,'Editing preserves the other name and shared image size');
    document.querySelector('[aria-label="Edit limelight-left"]').click();await wait(()=>input('Limelight name'));await fill('Limelight name','changed');window.failSave=true;button('Save Limelight').click();
    await wait(()=>document.querySelector('form[aria-label="Limelight name editor"] [role="alert"]')?.textContent.includes('Simulated write failure'));
    assert(window.vision.limelights[0].name==='limelight-left'&&input('Limelight name').value==='changed','A failed save keeps both the saved camera and draft');
    window.failSave=false;button('Cancel').click();await wait(()=>!input('Limelight name'));
    document.querySelector('[aria-label="Delete limelight-left"]').click();await wait(()=>window.saves.length===5&&!document.querySelector('[aria-label="Delete limelight-left"]')&&!button('Add Limelight').disabled);
    assert(window.vision.limelights.length===1&&window.vision.limelights[0].name==='limelight-back','Delete targets the chosen camera');
    document.querySelector('[aria-label="Delete limelight-back"]').click();await wait(()=>window.saves.length===6&&!document.querySelector('[aria-label="Delete limelight-back"]')&&!button('Add Limelight').disabled);assert(window.vision.limelights.length===0,'The last camera can be removed');
    button('Field').click();await wait(()=>document.querySelector('h3').textContent==='Field');button('Vision').click();await wait(()=>button('Add Limelight')&&!button('Add Limelight').disabled);
    assert(!document.querySelector('[aria-label^="Edit limelight-"]'),'Returning to Vision reloads the saved configuration');
    assert(input('Horizontal FOV (degrees)').value==='63.3'&&input('Image width (px)').value==='640','Global settings persist after all cameras are deleted and navigation');
    button('States').click();await wait(()=>button('Add State')&&!button('Add State').disabled);
    assert(document.querySelector('h3').textContent==='States','States view owns its header');
    assert(document.querySelector('[aria-label="Edit IDLE"]').disabled&&document.querySelector('[aria-label="Delete IDLE"]').disabled,'Idle cannot be renamed or deleted');
    button('Add State').click();await wait(()=>input('State name'));assert(!button('Add State'),'Add State hides while editing');
    await fill('State name','ready');assert(input('State name').value==='READY','State names normalize to uppercase');button('Save State').click();
    await wait(()=>document.querySelector('form[aria-label="State name editor"] [role="alert"]')?.textContent.includes('already exists'));
    assert(window.stateSaves.length===0,'Duplicate states are not saved');
    await fill('State name','climb');button('Save State').click();await wait(()=>window.stateSaves.length===1&&!input('State name')&&button('Add State'));
    assert(window.states.join(',')==='IDLE,READY,CLIMB','New state names persist in list order');
    document.querySelector('[aria-label="Edit CLIMB"]').click();await wait(()=>input('State name'));await fill('State name','HOMING');button('Save State').click();
    await wait(()=>window.stateSaves.length===2&&!input('State name')&&button('Add State'));
    assert(window.states.join(',')==='IDLE,READY,HOMING','Editing renames the selected state');
    assert([...document.querySelectorAll('[aria-label^="Edit "]')].at(-1).getAttribute('aria-label')==='Edit IDLE','Idle stays at the bottom of the state list');
    document.querySelector('[aria-label="Edit HOMING"]').click();await wait(()=>input('State name'));await fill('State name','BROKEN');window.failStateSave=true;button('Save State').click();
    await wait(()=>document.querySelector('form[aria-label="State name editor"] [role="alert"]')?.textContent.includes('Simulated state write failure'));
    assert(window.states.includes('HOMING')&&input('State name').value==='BROKEN','Failed state save preserves the existing name and pending edit');
    window.failStateSave=false;button('Cancel').click();await wait(()=>!input('State name')&&button('Add State'));
    document.querySelector('[aria-label="Delete READY"]').click();await wait(()=>window.stateSaves.length===3&&!document.querySelector('[aria-label="Delete READY"]'));
    document.querySelector('[aria-label="Delete HOMING"]').click();await wait(()=>window.stateSaves.length===4&&!document.querySelector('[aria-label="Delete HOMING"]'));
    assert(document.querySelector('[aria-label="Delete IDLE"]').disabled,'The final state stays available');
    button('Vision').click();await wait(()=>button('Add Limelight'));button('States').click();await wait(()=>button('Add State'));
    assert(document.querySelector('[aria-label="Edit IDLE"]')&&!document.querySelector('[aria-label="Edit HOMING"]'),'Saved states reload across navigation');
    return 'Vision and States Config desktop checks passed: inline lists, global camera settings, name-only add/edit/delete, duplicate prevention, save failures and persistence across navigation.';
  })()`));
}).catch(async error => {
  console.error(error);
  if (window && !window.isDestroyed()) console.error(await window.webContents.executeJavaScript("JSON.stringify({buttons:[...document.querySelectorAll('button,[role=button]')].map(el=>({text:el.textContent,disabled:el.disabled})),body:document.body.textContent,saves:window.saves})"));
  process.exitCode = 1;
}).finally(() => {
  window?.destroy();
  if (path.dirname(temporary) === path.resolve(os.tmpdir()) && path.basename(temporary).startsWith("power-tool-vision-ui-")) fs.rmSync(temporary, { recursive: true, force: true });
  app.exit(process.exitCode ?? 0);
});
