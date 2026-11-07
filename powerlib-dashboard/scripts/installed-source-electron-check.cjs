// Read/save an already migrated project through its installed production app.
const { app, Menu } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
if (!process.argv[2]) throw Error('Supply an installed, migrated robot project.');
const robot = path.resolve(process.argv[2]);
const tool = path.join(robot, 'power-tool');
const evidence = path.join(robot, 'build/installed-source-check');
fs.mkdirSync(evidence, { recursive: true });
app.setPath('userData', path.join(evidence, 'user-data'));
process.chdir(robot);
const source = path.join(robot, 'src/main/java');
const snapshot = () => new Map(fs.readdirSync(source, { recursive: true }).filter(name => name.endsWith('.java')).map(name => [name, fs.readFileSync(path.join(source, name), 'utf8')]));
const before = snapshot();
app.on('browser-window-created', (_, window) => {
  window.hide();
  window.webContents.setBackgroundThrottling(false);
  window.webContents.session.webRequest.onBeforeRequest({urls:['ws://*/*','wss://*/*']},(_,done)=>done({cancel:true}));
  window.webContents.once('did-finish-load', async () => {
    try {
      const result = await window.webContents.executeJavaScript(`(async()=>{
        const bridge=window.powerlib;
        const [subsystems,states,vision,localization,migration]=await Promise.all([bridge.readSubsystems(),bridge.readStateConfig(),bridge.readVisionConfig(),bridge.readLocalizationConfig(),bridge.readLegacyMigration()]);
        if(subsystems.error||subsystems.subsystems.some(item=>item.sourceError))throw Error('Unreadable installed source');
        if(migration.files.length)throw Error('Expected a migrated project');
        await bridge.saveSubsystems(subsystems.subsystems,undefined,subsystems.revision);
        await bridge.saveStateConfig(states.config);
        await bridge.saveVisionConfig(vision.vision);
        await bridge.saveLocalizationConfig(localization.config);
        return {mechanisms:subsystems.subsystems.map(item=>({id:item.id,name:item.name,type:item.type})),states:states.config.states,cameras:vision.vision.limelights};
      })()`);
      assert.deepEqual(snapshot(), before, 'No-op app saves must preserve all robot Java bytes');
      assert.equal(result.states.at(-1), 'IDLE');
      assert.ok(Menu.getApplicationMenu().items.find(item=>item.label==='File').submenu.items.some(item=>item.label==='Build Robot'));
      for (const name of ['powerlib-subsystems.json','powerlib-constants.json']) assert.ok(!fs.existsSync(path.join(tool, 'generated', name)));
      fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({passed:true,...result},null,2));
      console.log(`Installed production app passed: ${result.mechanisms.length} mechanisms, ${result.states.length} states, ${result.cameras.length} cameras; no-op Java saves and no configuration JSON.`);
    } catch (error) { console.error(error); process.exitCode=1; }
    finally { window.destroy(); app.exit(process.exitCode||0); }
  });
});
import(pathToFileURL(path.join(tool,'dist-electron/main.js')).href).catch(error=>{console.error(error);app.exit(1);});
