const assert = require('node:assert/strict');

exports.checkAutoBumper = async ({window,evaluate,click,wait,saved,fill,addStep,readDoc,screenshot}) => {
  await click('New auto'); await addStep('Add point'); await fill('X (m)',2); await fill('Y (m)',3); await fill('Heading (deg)',90); await saved();
  const before=structuredClone(readDoc());
  const check=async(length,width,selector='[data-selected-point-footprint]')=>{
    await wait(()=>evaluate(`!!document.querySelector('${selector} [data-robot-footprint]')`));
    assert.ok(await evaluate(`(()=>{const svg=document.querySelector('svg[aria-label="Field and robot position"]'),rect=svg.querySelector('${selector} [data-robot-footprint]'),scale=480/Number(svg.dataset.fieldWidth);return Math.abs(+rect.getAttribute('width')-${length}*.0254*scale)<1e-8&&Math.abs(+rect.getAttribute('height')-${width}*.0254*scale)<1e-8;})()`));
  };
  await check(32,32);
  await evaluate(`(()=>{const key='powerlib.driveDisplay.v1',settings=JSON.parse(localStorage.getItem(key)||'{}');localStorage.setItem(key,JSON.stringify({...settings,bumper:{lengthInches:40,widthInches:28}}));window.dispatchEvent(new StorageEvent('storage',{key}));})()`);
  await check(40,28); assert.equal(await evaluate(`document.querySelector('[data-selected-point-footprint]').getAttribute('transform')`),'rotate(-90)');
  const start=await evaluate(`(()=>{const r=document.querySelector('[data-add-point-handle]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  window.webContents.sendInputEvent({type:'mouseMove',...start}); window.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});
  window.webContents.sendInputEvent({type:'mouseMove',x:start.x+120,y:start.y-50,modifiers:['leftButtonDown']}); await check(40,28,'[data-new-point-preview]');
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  window.webContents.sendInputEvent({type:'mouseUp',x:start.x+120,y:start.y-50,button:'left',clickCount:1});
  await wait(()=>evaluate(`!document.querySelector('[data-new-point-preview]')`)); assert.deepEqual(readDoc(),before,'Footprint sizing does not change target poses or commit a cancelled preview');
  await click('Save as named point'); await saved(); await click('Points');
  await evaluate(`document.querySelector('[aria-label="Named points"] .MuiListItemButton-root').click()`); await check(40,28); await screenshot('bumper-auto-named-point');
  console.log('Auto bumper passed: scaled and rotated selected footprint, + preview footprint, cancellation without pose changes, and named-point footprint.');
};
