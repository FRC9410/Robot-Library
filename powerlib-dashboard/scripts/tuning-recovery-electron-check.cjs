// Real renderer, publication listener and disk cache; transport is in-memory.
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildSync } = require('esbuild');
const project = path.resolve(__dirname, '..');
const fixture = fs.mkdtempSync(path.join(project, '../build/tuning-recovery-ui-'));
let window;
app.whenReady().then(async () => {
  const storage = await import(pathToFileURL(path.join(project, 'dist-electron/tuningSessionFiles.js')).href);
  ipcMain.handle('cache-read', (_, target) => storage.readTuningSession(fixture, fixture, target));
  ipcMain.handle('cache-save', (_, target, values) => storage.saveTuningSession(fixture, fixture, target, values));
  fs.writeFileSync(path.join(fixture, 'preload.cjs'), `const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('powerlib',{readTuningSession:target=>ipcRenderer.invoke('cache-read',target),saveTuningSession:(target,values)=>ipcRenderer.invoke('cache-save',target,values)});`);
  buildSync({ stdin: { resolveDir: project, contents: `
    import React from 'react';
    import {createRoot} from 'react-dom/client';
    import {NetworkTablesProvider,useNetworkTables} from './src/features/networktables/NetworkTablesContext';
    import {SubsystemTuningDialog} from './src/features/dashboard/SubsystemTuningDialog';
    window.writes=[];
    function Fixture(){
      const {clientRef,setStatus,setTopics,setConnectionSettings,connectionSettings,tuningRecovery}=useNetworkTables();
      window.cache=tuningRecovery;
      React.useEffect(()=>{
        setStatus('connected');
        setTopics([{name:'/PowerLib/Tuning/Enabled',type:'boolean',value:true},
          {name:'/PowerLib/Subsystems/Intake/Variables/PID/kP',type:'double',value:1}]);
        // Exercise the production publish method, replacing only its NT transport.
        clientRef.current.endpoint={host:'localhost',port:5810};
        clientRef.current.nt={createTopic:(name,type,value)=>({publisher:false,pubuid:1,
          async publish(){this.publisher=true;},
          setValue(value){if(window.failWrite)throw Error('rejected');window.writes.push({name,value});}})};
        window.otherProfile=()=>setConnectionSettings({targetId:'other-profile',host:'localhost',port:5810});
      },[]);
      return React.createElement(SubsystemTuningDialog,{key:connectionSettings.targetId,owner:'Intake',name:'Intake',subsystems:[{name:'Intake',type:'velocity'}],tuningRequested:true,onClose:()=>{}});
    }
    createRoot(document.getElementById('root')).render(React.createElement(NetworkTablesProvider,null,React.createElement(Fixture)));
  ` }, bundle: true, platform: 'browser', outfile: path.join(fixture, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
  fs.writeFileSync(path.join(fixture, 'index.html'), '<div id="root"></div><script src="fixture.js"></script>');
  window = new BrowserWindow({ show: false, width: 1000, height: 800, webPreferences: { preload: path.join(fixture,'preload.cjs'), backgroundThrottling: false, partition: `recovery-${Date.now()}` } });
  await window.loadFile(path.join(fixture,'index.html'));
  const helpers = `
    const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
    const check=(condition,message)=>{if(!condition)throw Error(message);};
    const wait=async predicate=>{for(let i=0;i<150;i++){if(predicate())return;await sleep(30);}throw Error('Recovery UI wait timed out: '+document.body.innerText);};
    const button=text=>[...document.querySelectorAll('button')].find(el=>text==='Apply'?el.textContent.startsWith('Apply'):el.textContent===text);
    const kp=()=>[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent==='kP');
    const fill=async value=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(kp(),value);kp().dispatchEvent(new Event('input',{bubbles:true}));await sleep(30);};
    const expand=async()=>{await wait(()=>document.getElementById('mechanism-PID-heading'));document.getElementById('mechanism-PID-heading').click();await wait(()=>kp());};
  `;
  await window.webContents.executeJavaScript(`(async()=>{${helpers}
    await expand();await wait(()=>window.cache.path);check(window.writes.length===0,'No startup replay');
    await fill('3');button('Apply').click();await wait(()=>window.cache.values.some(row=>row.value===3));
    check(window.writes.length===1,'Apply publishes once');
    window.failWrite=true;await fill('4');button('Apply').click();await wait(()=>document.body.innerText.includes('remaining edits'));
    check(window.cache.values.every(row=>row.value!==4),'Failed Apply is not cached');
  })()`);
  // A fresh document recreates the provider/client and reads the real disk file.
  await new Promise(resolve => { window.webContents.once('did-finish-load', resolve); window.reload(); });
  await window.webContents.executeJavaScript(`(async()=>{${helpers}
    await expand();await wait(()=>button('Restore edits (1)'));
    check(window.writes.length===0&&kp().value==='1','Restart offers recovery without replay');
    button('Restore edits (1)').click();await wait(()=>kp().value==='3');
    check(window.writes.length===0,'Restore only creates drafts');
    button('Apply').click();await wait(()=>window.writes.length===1);
    check(window.writes[0].value===3,'Explicit Apply publishes recovered value');
    window.otherProfile();await wait(()=>window.cache.path&&window.cache.values.length===0);
    check(!button('Restore edits (1)'),'Another profile cannot restore prior edits');
  })()`);
  console.log('Tuning recovery desktop checks passed: successful Apply persisted, failed Apply excluded, fresh renderer restored drafts only, explicit replay and profile isolation.');
}).catch(error => { console.error(error); process.exitCode=1; }).finally(()=>{ window?.destroy();app.exit(process.exitCode||0); });
