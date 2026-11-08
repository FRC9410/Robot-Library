const assert = require('node:assert/strict');

exports.checkStepDragUI = async ({window,evaluate,wait,saved,readDoc,screenshot}) => {
  const original=structuredClone(readDoc()),ids=original.autos[0].steps.map(step=>step.id);
  const start = source => evaluate(`(()=>{const row=document.querySelectorAll('[data-auto-step-row]')[${source}].querySelector('.MuiListItemButton-root'),data=new DataTransfer(),r=row.getBoundingClientRect();window.__stepDrag={row,data};row.dispatchEvent(new DragEvent('dragstart',{bubbles:true,cancelable:true,dataTransfer:data,clientX:r.x+20,clientY:r.y+r.height/2}));})()`);
  const over = (target,after) => evaluate(`(()=>{const row=document.querySelectorAll('[data-auto-step-row]')[${target}],r=row.getBoundingClientRect(),event=new DragEvent('dragover',{bubbles:true,cancelable:true,dataTransfer:window.__stepDrag.data,clientX:r.x+20,clientY:r.y+r.height*${after?.75:.25}});row.dispatchEvent(event);window.__stepDrag.target={row,x:r.x+20,y:r.y+r.height*${after?.75:.25}};return event.defaultPrevented;})()`);
  const drop = () => evaluate(`(()=>{const d=window.__stepDrag;d.target.row.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d.data,clientX:d.target.x,clientY:d.target.y}));d.row.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:d.data}));delete window.__stepDrag;})()`);
  const undo = async () => {
    await evaluate(`document.querySelector('svg[aria-label="Field and robot position"]').focus()`);
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Z',modifiers:['control']}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Z',modifiers:['control']});
    await wait(()=>JSON.stringify(readDoc().autos[0].steps.map(step=>step.id))===JSON.stringify(ids)); await saved();
  };
  for(const sample of [
    {source:0,target:2,after:false,before:ids[2],order:[ids[1],ids[0],ids[2],ids[3]]},
    {source:0,target:2,after:true,before:ids[3],order:[ids[1],ids[2],ids[0],ids[3]]},
    {source:0,target:3,after:true,before:'end',order:[ids[1],ids[2],ids[3],ids[0]]},
    {source:3,target:0,after:false,before:ids[0],order:[ids[3],ids[0],ids[1],ids[2]]},
  ]) {
    await evaluate(`document.querySelectorAll('[data-auto-step-row]')[${sample.source}].querySelector('.MuiListItemButton-root').click()`);
    await start(sample.source); assert.equal(await over(sample.target,sample.after),true);
    await wait(()=>evaluate(`document.querySelector('[data-step-drop-indicator]')?.dataset.beforeStep===${JSON.stringify(sample.before)}`));
    assert.ok(await evaluate(`(()=>{const line=document.querySelector('[data-step-drop-indicator]'),rows=[...document.querySelectorAll('[data-auto-step-row]')],next=rows.find(row=>row.dataset.autoStepRow===line.dataset.beforeStep),r=line.getBoundingClientRect(),edge=next?next.getBoundingClientRect().top:rows.at(-1).getBoundingClientRect().bottom;return getComputedStyle(line).backgroundColor==='rgb(250, 204, 21)'&&r.height===3&&Math.abs(r.top+r.height/2-edge)<1;})()`),'Yellow line marks the exact insertion boundary without shifting rows');
    assert.deepEqual(readDoc(),original,'Dragging only previews the insertion');
    if(sample.after&&sample.target===2) await screenshot('step-drop-indicator');
    await drop(); await wait(()=>JSON.stringify(readDoc().autos[0].steps.map(step=>step.id))===JSON.stringify(sample.order)); await saved();
    assert.equal(await evaluate(`!!document.querySelector('[data-step-drop-indicator]')`),false,'Drop removes the line'); await undo();
  }
  await evaluate(`document.querySelectorAll('[data-auto-step-row]')[3].querySelector('.MuiListItemButton-root').click()`);
  await start(0); await over(3,true); await drop();
  await wait(()=>JSON.stringify(readDoc().autos[0].steps.map(step=>step.id))===JSON.stringify([ids[1],ids[2],ids[3],ids[0]])); await saved(); await undo();
  await evaluate(`(()=>{const rows=document.querySelectorAll('[data-auto-step-row]');rows[0].querySelector('.MuiListItemButton-root').click();rows[2].querySelector('.MuiListItemButton-root').dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}));})()`);
  await start(0); await over(3,true); await drop();
  await wait(()=>JSON.stringify(readDoc().autos[0].steps.map(step=>step.id))===JSON.stringify([ids[1],ids[3],ids[0],ids[2]])); await saved(); await undo();
  await start(0); await over(2,false); await wait(()=>evaluate(`!!document.querySelector('[data-step-drop-indicator]')`));
  await evaluate(`(()=>{const d=window.__stepDrag;d.row.dispatchEvent(new DragEvent('dragend',{bubbles:true,dataTransfer:d.data}));delete window.__stepDrag;})()`);
  await wait(()=>evaluate(`!document.querySelector('[data-step-drop-indicator]')`)); assert.deepEqual(readDoc(),original,'Cancelling a drag leaves the document untouched');
  console.log('Step drop indicator passed: yellow before/after boundaries, beginning/end placement, accurate reorder, group order, preview-only drafts, undo and cancellation cleanup.');
};
