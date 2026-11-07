// Production menu/preload/App with an in-memory NT client; no robot connections or writes.
const { app, Menu } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { buildSync } = require('esbuild');
const project = path.resolve(__dirname, '..');
const fixture = path.join(project, '../build/dashboard-checks/nt-drawer-' + Date.now());
fs.mkdirSync(fixture, { recursive: true });
fs.writeFileSync(path.join(fixture, 'build.gradle'), '// isolated UI check');
process.chdir(fixture);
app.setPath('userData', path.join(fixture, 'profile'));
process.on('uncaughtException', error => { console.error(error); app.exit(1); });
setTimeout(() => { console.error('NetworkTables drawer check timed out.'); app.exit(1); }, 30000).unref();
buildSync({ stdin: { contents: `
  import React from 'react'; import {createRoot} from 'react-dom/client';
  import {ThemeProvider,createTheme} from '@mui/material';
  import {App} from ${JSON.stringify(path.join(project, 'src/App.tsx'))};
  import {PowerLibNt4Client} from ${JSON.stringify(path.join(project, 'src/networktables/nt4Client.ts'))};
  import ${JSON.stringify(path.join(project, 'src/styles.css'))};
  window.watched=new Set();window.rootStarts=0;window.rootStops=0;
  PowerLibNt4Client.prototype.connect=function(_host,_port,callback){setTimeout(()=>callback(true),0);};
  PowerLibNt4Client.prototype.disconnect=function(){};
  PowerLibNt4Client.prototype.watchCameraAnnouncements=function(){};
  PowerLibNt4Client.prototype.publish=async function(){};
  PowerLibNt4Client.prototype.watchPrefix=function(prefix,callback){
    window.watched.add(prefix);
    if(prefix==='/'){window.rootStarts++;callback({name:'/Debug/Voltage',type:'double',value:12.3});}
    if(prefix==='/PowerLib/')callback({name:'/PowerLib/Tuning/Enabled',type:'boolean',value:false});
    return()=>{window.watched.delete(prefix);if(prefix==='/')window.rootStops++;};
  };
  PowerLibNt4Client.prototype.isWatchedValue=function(name){return [...window.watched].some(prefix=>name.startsWith(prefix));};
  createRoot(document.getElementById('root')).render(<ThemeProvider theme={createTheme({palette:{mode:'dark'}})}><App/></ThemeProvider>);
`, loader: 'jsx', resolveDir: project }, bundle: true, platform: 'browser', format: 'iife', outfile: path.join(fixture, 'fixture.js'), define: { 'process.env.NODE_ENV': '"production"' } });
fs.writeFileSync(path.join(fixture, 'index.html'), '<html><head><link rel="stylesheet" href="fixture.css"></head><body><div id="root"></div><script src="fixture.js"></script></body></html>');
let window;
const wait = async predicate => { for(let i=0;i<200;i++){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,25));}throw Error('UI wait timed out'); };
const evaluate = code => window.webContents.executeJavaScript(code);
app.on('browser-window-created', (_event, created) => {
  window=created;window.hide();window.webContents.setBackgroundThrottling(false);
  window.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_details,done)=>done({cancel:true}));
  window.webContents.once('did-finish-load', async () => {
    try {
      await new Promise(resolve=>setTimeout(resolve,50));
      await window.loadURL(pathToFileURL(path.join(fixture, 'index.html')).href);
      await wait(()=>evaluate('window.watched?.has("/PowerLib/")'));
      const toggle=Menu.getApplicationMenu().getMenuItemById('powerlib-menu-view').submenu.items.find(item=>item.label==='Toggle Network Tables');
      assert.ok(toggle,'View menu must include Toggle Network Tables');
      assert.equal(await evaluate('window.rootStarts'),0,'Closed drawer must not subscribe to all values');
      assert.equal(await evaluate('[...document.querySelectorAll("[role=tab]")].some(el=>el.textContent==="NetworkTables")'),false,'NetworkTables is no longer a tab');
      toggle.click();await wait(()=>evaluate('!!document.querySelector("input[type=text]") && window.rootStarts===1'));
      await wait(()=>evaluate(`Math.abs(document.querySelector('[role="complementary"][aria-label="Network Tables"]').getBoundingClientRect().right-innerWidth)<1`));
      const layout=await evaluate(`(()=>{const drawer=document.querySelector('[role="complementary"][aria-label="Network Tables"]').getBoundingClientRect();return {right:drawer.right,width:innerWidth,top:drawer.top,height:drawer.height,viewportHeight:innerHeight,backdrop:!!document.querySelector('.MuiBackdrop-root'),dashboard:!!document.querySelector('.dashboard-stage')};})()`);
      assert.ok(Math.abs(layout.right-layout.width)<1);assert.equal(layout.top,92);assert.equal(layout.height,layout.viewportHeight-92);assert.equal(layout.backdrop,false);assert.equal(layout.dashboard,true);
      await evaluate(`(()=>{const input=document.querySelector('input[type=text]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Debug/Voltage');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
      await wait(()=>evaluate('document.body.textContent.includes("12.3")'));
      toggle.click();await wait(()=>evaluate('!document.querySelector("input[type=text]") && window.rootStops===1'));
      toggle.click();await wait(()=>evaluate('!!document.querySelector("input[type=text]") && window.rootStarts===2'));
      await evaluate(`document.querySelector('[aria-label="Close Network Tables"]').click()`);await wait(()=>evaluate('!document.querySelector("input[type=text]") && window.rootStops===2'));
      toggle.click();await wait(()=>evaluate('!!document.querySelector("input[type=text]") && window.rootStarts===3'));
      await evaluate(`document.querySelector('input[type=text]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await wait(()=>evaluate('!document.querySelector("input[type=text]") && window.rootStops===3'));
      console.log('NetworkTables drawer passed: production View menu toggles, right-edge layout, live topic filtering, Dashboard stays available, close/Escape and subscription cleanup.');
    } catch(error) { console.error(error);process.exitCode=1; }
    finally { window.destroy();app.exit(process.exitCode||0); }
  });
});
import(pathToFileURL(path.join(project,'dist-electron/main.js')).href).catch(error=>{console.error(error);app.exit(1);});
