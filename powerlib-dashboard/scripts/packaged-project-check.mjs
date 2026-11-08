// Runs the actual packaged executable with isolated preferences and a fake SFTP robot.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {setTimeout as sleep} from 'node:timers/promises';
import {startFakeRobot} from './fake-robot.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const {fixture} = JSON.parse(await fs.readFile(path.join(root, 'build/project-zip-check-result.json'), 'utf8'));
const profile = path.join(fixture, 'build/package-profile');
const fakeLogs = path.join(fixture, 'build/fake-robot-logs');
await fs.mkdir(fakeLogs, {recursive:true});
await fs.writeFile(path.join(fakeLogs, 'package-smoke.wpilog'), 'packaged SFTP smoke fixture');
const server = await startFakeRobot(fakeLogs, 0);
const port = server.address().port;
const executable = path.join(fixture, 'power-tool/app/Power Tool.exe');
let socket;
let output = '';
const environment = {...process.env, POWERLIB_ROBOT:`127.0.0.1:${port}`};
delete environment.ELECTRON_RUN_AS_NODE;
const child = spawn(executable, ['--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profile}`],
  {cwd:fixture, windowsHide:true, env:environment, stdio:['ignore','pipe','pipe']});
child.stdout.on('data', data=>output+=data); child.stderr.on('data', data=>output+=data);
try {
  let targets;
  for (let attempt=0;attempt<150;attempt++) {
    if(child.exitCode!==null) throw Error('Packaged application exited: '+output);
    try {
      const match = /DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/.exec(output);
      if(match) {
        targets = await (await fetch(`http://127.0.0.1:${match[1]}/json/list`)).json();
        if(targets.some(target=>target.type==='page'&&target.url.startsWith('file:'))) break;
      }
    } catch {}
    await sleep(200);
  }
  const page = targets?.find(target=>target.type==='page'&&target.url.startsWith('file:'));
  assert.ok(page, 'Packaged renderer opened. '+output);
  socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let nextId=0;
  const pending = new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data); if(message.id){pending.get(message.id)?.(message);pending.delete(message.id);}});
  const command = (method,params={})=>new Promise((resolve,reject)=>{
    const id=++nextId;
    const timer=setTimeout(()=>{pending.delete(id);reject(Error('Timed out: '+method));},20000);
    pending.set(id,message=>{clearTimeout(timer);message.error?reject(Error(JSON.stringify(message.error))):resolve(message.result);});
    socket.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const response=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(response.exceptionDetails) throw Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  };
  for(let attempt=0;attempt<100;attempt++) {
    if(await evaluate(`!!window.powerlib&&document.querySelectorAll('[role=tab]').length>=3`)) break;
    await sleep(100);
  }
  assert.ok(await evaluate(`!!window.powerlib&&document.body.textContent.includes('Dashboard')`));
  const inventory=await evaluate('window.powerlib.readSubsystems()');
  assert.ok(!inventory.error,inventory.error);
  assert.ok(inventory.path.toLowerCase().startsWith(fixture.toLowerCase()),inventory.path);
  const autos=await evaluate('window.powerlib.readAutos()');
  assert.ok(autos.path.toLowerCase().startsWith(fixture.toLowerCase()),autos.path);
  const logs=await evaluate('window.powerlib.listRobotLogs()');
  assert.ok(logs.files.some(file=>file.name==='package-smoke.wpilog'),'Packaged SSH2 portable fallback lists robot logs');
  const downloaded=await evaluate(`window.powerlib.downloadRobotLogs([{remotePath:'/U/logs/package-smoke.wpilog',localFolder:'smoke'}],${JSON.stringify(path.join(fixture,'build/downloaded-logs'))})`);
  assert.equal(downloaded.length,1);
  assert.equal(await fs.readFile(downloaded[0].path,'utf8'),'packaged SFTP smoke fixture');
  await command('Page.captureScreenshot',{format:'png'}).then(result=>fs.writeFile(path.join(fixture,'build/packaged-app.png'),Buffer.from(result.data,'base64')));
  await command('Page.close');
  console.log('Packaged executable passed: bundled renderer/preload, extracted project detection, source/auto IPC, and SFTP list/download without Node/npm or native SSH acceleration.');
} finally {
  socket?.close();
  if(child.exitCode===null) {
    await Promise.race([new Promise(resolve=>child.once('exit',resolve)),sleep(3000)]);
    if(child.exitCode===null) child.kill();
  }
  server.close();
  await fs.writeFile(path.join(fixture,'build/packaged-app.log'),output);
}
