const assert = require('node:assert/strict');

exports.checkBumperFields = async ({window,evaluate,wait,tab,choose,openFieldConfig,closeConfig,screenshot}) => {
  const fill=async(label,value)=>evaluate(`(()=>{const input=[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent===${JSON.stringify(label)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,${JSON.stringify(String(value))});input.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const save=()=>evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Save bumper dimensions').click()`);
  const check=async(selector,length,width,meters=false)=>{
    await wait(()=>evaluate(`!!document.querySelector(${JSON.stringify(selector+' [data-robot-footprint]')})`));
    const box=await evaluate(`(()=>{const svg=document.querySelector(${JSON.stringify(selector)}),rect=svg.querySelector('[data-robot-footprint]');return {length:+rect.dataset.bumperLengthM,width:+rect.dataset.bumperWidthM,w:+rect.getAttribute('width'),h:+rect.getAttribute('height'),x:+rect.getAttribute('x'),y:+rect.getAttribute('y'),fieldWidth:+svg.dataset.fieldWidth};})()`);
    assert.ok(Math.abs(box.length-length*.0254)<1e-9&&Math.abs(box.width-width*.0254)<1e-9);
    const scale=meters?1:480/box.fieldWidth;
    assert.ok(Math.abs(box.w-length*.0254*scale)<1e-9&&Math.abs(box.h-width*.0254*scale)<1e-9,'Footprint is calibrated to field meters');
    assert.equal(box.x,-box.w/2); assert.equal(box.y,-box.h/2);
  };
  await tab('Dashboard'); await check('.dashboard-stage > svg',32,32); await openFieldConfig();
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('[aria-label="Bumper dimensions"] input')].map(el=>el.value)`),['32','32']);
  await fill('Bumper length (in)',0); assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Save bumper dimensions').disabled`),true);
  await fill('Bumper length (in)',40); await fill('Bumper width (in)',28); await save();
  await wait(()=>evaluate(`JSON.parse(localStorage.getItem('powerlib.driveDisplay.v1')).bumper?.lengthInches===40`));
  await screenshot('bumper-settings'); await closeConfig();
  await check('.dashboard-stage > svg',40,28); await check('.dashboard-field-preview > svg',40,28);
  await tab('Autos'); await check('svg[aria-label="Field and robot position"]',40,28);
  await choose('2026-rebuilt'); await check('svg[aria-label="Field and robot position"]',40,28);
  await tab('Logs'); await evaluate('window.fieldTest.dropLog()');
  await check('svg[aria-label="Robot position on the field"]',40,28,true);
  await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Heat map').click()`); await check('svg[aria-label="Robot position on the field"]',40,28,true);
  await screenshot('bumper-log');
  await window.webContents.reload(); await wait(()=>evaluate(`!!document.querySelector('.dashboard-stage > svg')`));
  await check('.dashboard-stage > svg',40,28);
  await openFieldConfig(); assert.deepEqual(await evaluate(`[...document.querySelectorAll('[aria-label="Bumper dimensions"] input')].map(el=>el.value)`),['40','28']);
  await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Reset bumper size').click()`); await save();
  await wait(()=>evaluate(`JSON.parse(localStorage.getItem('powerlib.driveDisplay.v1')).bumper.lengthInches===32`));
  await closeConfig(); await choose('none'); await check('.dashboard-stage > svg',32,32);
  console.log('Bumper fields passed: 32x32 default, inch/meter calibration, validation, rectangular dimensions, Dashboard/thumbnail/Autos/Logs/heatmap sharing, layout changes, reset and reload persistence.');
};
