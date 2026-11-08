const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {Menu} = require('electron');

exports.checkFileMenu = async ({evaluate,wait,readDoc,fixture,screenshot}) => {
  const file=Menu.getApplicationMenu().getMenuItemById('powerlib-menu-file').submenu;
  assert.deepEqual(file.items.filter(item=>item.type!=='separator').map(item=>item.role||item.label),
    ['Settings','Connection Settings','Build Robot','Build and Deploy','Sim with DS','Sim without DS','quit']);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Open Config"],.dashboard-config')`),false,'Dashboard no longer has a settings button');
  assert.equal(await evaluate(`['updateSubsystemCode','updateInstallSection','updatePowerTool','onMenuUpdateSubsystemCode','onMenuUpdateInstallSection','onMenuUpdatePowerTool'].some(name=>name in window.powerlib)`),false,'Retired installer/update APIs are absent');
  const before=structuredClone(readDoc());
  for(const view of ['Dashboard','Autos','Logs']) {
    await evaluate(`[...document.querySelectorAll('[role=tab]')].find(el=>el.textContent==='${view}').click()`);
    file.getMenuItemById('powerlib-file-settings').click();
    await wait(()=>evaluate(`document.querySelector('[role=dialog] h2')?.textContent==='Settings'`));
    assert.equal(await evaluate(`document.querySelector('[role=tab][aria-selected=true]').textContent`),view);
    if(view==='Dashboard') await screenshot('file-menu-settings');
    await evaluate(`document.querySelector('[aria-label="Close Settings"]').click()`);
    await wait(()=>evaluate(`!document.querySelector('[aria-label="Close Settings"]')`));
  }
  assert.deepEqual(readDoc(),before,'Opening Settings from the menu preserves drafts');
  const trace=path.join(fixture,'build/menu-actions.txt');
  fs.writeFileSync(path.join(fixture,'gradlew.bat'),'@echo off\r\nif not exist build mkdir build\r\necho %*>>build\\menu-actions.txt\r\necho BUILD SUCCESSFUL\r\nexit /b 0\r\n');
  file.items.find(item=>item.label==='Build Robot').click();
  await wait(()=>fs.existsSync(trace)&&fs.readFileSync(trace,'utf8').includes(' build'));
  await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
  assert.equal(fs.readFileSync(trace,'utf8').trim(),'--no-daemon --console=plain build');
  fs.writeFileSync(trace,'');
  file.items.find(item=>item.label==='Build and Deploy').click();
  await wait(()=>fs.existsSync(trace)&&fs.readFileSync(trace,'utf8').includes(' deploy'));
  assert.deepEqual(fs.readFileSync(trace,'utf8').trim().split(/\r?\n/),['--no-daemon --console=plain build','--no-daemon --console=plain deploy']);
  await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
  for(const [label,action] of [['Sim with DS','sim-ds'],['Sim without DS','sim-no-ds']]) {
    fs.writeFileSync(trace,''); file.items.find(item=>item.label===label).click();
    await wait(()=>fs.readFileSync(trace,'utf8').includes('simulateExternalJavaRelease'));
    await wait(()=>evaluate(`!document.querySelector('[role=dialog]')`));
    assert.ok(fs.readFileSync(trace,'utf8').includes('build simulateExternalJavaRelease'),action+' builds before preparing a launch');
  }
  console.log('File menu passed: update entries removed, Settings from all tabs, Dashboard button removed, build/deploy IPC ordering, and both simulation menu actions. Deploy/sim launch used a disposable fake robot.');
};
