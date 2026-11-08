const assert = require('node:assert/strict');

exports.checkSelectionUI = async ({ window, evaluate, wait, saved, readDoc }) => {
  const baseline = structuredClone(readDoc());
  const selected = () => evaluate(`[...document.querySelector('[aria-label="Auto steps"]').children].flatMap((row,index)=>row.querySelector('.Mui-selected')?[index]:[])`);
  const click = async (index, surface, modifiers=[]) => {
    const location = await evaluate(`(()=>{const el=${surface==='field' ? `document.querySelector('[aria-label="Drive point ${index+1}"] > circle')` : `document.querySelector('[aria-label="Auto steps"]').children[${index}].querySelector('.MuiListItemButton-root')`};const r=el.getBoundingClientRect();return {x:Math.round(r.x+${surface==='field'?'r.width/2':'20'}),y:Math.round(r.y+r.height/2)};})()`);
    window.webContents.sendInputEvent({type:'mouseMove',...location});
    window.webContents.sendInputEvent({type:'mouseDown',...location,button:'left',clickCount:1,modifiers});
    window.webContents.sendInputEvent({type:'mouseUp',...location,button:'left',clickCount:1,modifiers});
    await new Promise(resolve=>setTimeout(resolve,80));
  };
  for (const surface of ['field','list']) {
    await click(0,surface); await click(2,surface,['shift']);
    await wait(async()=>JSON.stringify(await selected())==='[0,1,2]');
    await click(1,surface,['control']); await wait(async()=>JSON.stringify(await selected())==='[0,2]');
    await click(1,surface,['control']); await wait(async()=>JSON.stringify(await selected())==='[0,1,2]');
    await click(1,surface); await wait(async()=>JSON.stringify(await selected())==='[1]');
    await click(2,surface); await click(0,surface,['shift']);
    await wait(async()=>JSON.stringify(await selected())==='[0,1,2]');
  }
  await click(0,'list'); await click(3,'list',['control','shift']);
  await wait(async()=>JSON.stringify(await selected())==='[0,1,2,3]');
  assert.deepEqual(readDoc(),baseline,'Clicking with Ctrl/Shift never moves points or changes the document');
  // Ctrl may remain held while moving a group; it must not remove the drag source.
  await click(0,'field'); await click(2,'field',['shift']);
  const start = await evaluate(`(()=>{const r=document.querySelector('[aria-label="Drive point 1"] > circle').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`);
  const target = {x:start.x+35,y:start.y-20};
  window.webContents.sendInputEvent({type:'mouseMove',...start});
  window.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1,modifiers:['control']});
  window.webContents.sendInputEvent({type:'mouseMove',...target,modifiers:['leftButtonDown','shift','control']});
  await wait(()=>evaluate(`Number(document.querySelector('[aria-label="Auto steps"] .MuiListItemText-secondary').textContent.match(/X ([\\d.]+)/)[1])>1.6`));
  window.webContents.sendInputEvent({type:'mouseUp',...target,button:'left',clickCount:1,modifiers:['shift','control']});
  await wait(()=>readDoc().autos[0].steps[0].x!==baseline.autos[0].steps[0].x); await saved();
  assert.deepEqual(await selected(),[0,1,2]);
  const shifts = readDoc().autos[0].steps.slice(0,3).map((step,index)=>({x:step.x-baseline.autos[0].steps[index].x,y:step.y-baseline.autos[0].steps[index].y}));
  assert.ok(shifts.every(delta=>Math.abs(delta.x-shifts[0].x)<.0002&&Math.abs(delta.y-shifts[0].y)<.0002),'Modifier dragging preserves group spacing');
  await evaluate(`document.querySelector('svg[aria-label="Field and robot position"]').focus()`);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Z',modifiers:['control']}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Z',modifiers:['control']});
  await wait(()=>readDoc().autos[0].steps[0].x===baseline.autos[0].steps[0].x); await saved();
  assert.deepEqual(readDoc(),baseline,'A modifier drag is undone as one edit');
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  await wait(async()=>(await selected()).length===0);
  console.log('Selection modifiers passed: Shift inclusive ranges forward/backward in field/list, Ctrl+Shift ranges including wait steps, Ctrl individual toggles, plain-click replacement, grouped modifier drag and undo.');
};
