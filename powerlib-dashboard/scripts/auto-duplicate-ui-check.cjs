const assert = require('node:assert/strict');
const fs = require('node:fs');

exports.checkDuplicateUI = async ({ window, evaluate, click, wait, saved, selectStep, selectOption, fill, screenshot, readDoc, jsonPath, generatedPath, reloadApp }) => {
  const original = fs.readFileSync(jsonPath,'utf8'), java = fs.readFileSync(generatedPath,'utf8');
  const source = structuredClone(readDoc().autos[0]);
  const field = await evaluate(`(()=>{const svg=document.querySelector('svg[aria-label="Field and robot position"]');return {length:Number(svg.dataset.fieldLength),width:Number(svg.dataset.fieldWidth)};})()`);
  await selectStep(1);
  const blank = await evaluate(`(()=>{const r=document.querySelector('svg[aria-label="Field and robot position"]').getBoundingClientRect();return {x:Math.round(r.x+10),y:Math.round(r.y+10)};})()`);
  window.webContents.sendInputEvent({type:'mouseMove',...blank});
  window.webContents.sendInputEvent({type:'mouseDown',...blank,button:'left',clickCount:1});
  window.webContents.sendInputEvent({type:'mouseUp',...blank,button:'left',clickCount:1});
  await wait(() => evaluate(`!document.querySelector('[data-add-point-handle]') && !document.querySelector('[aria-label="Auto steps"] .Mui-selected') && !document.querySelector('[aria-label="Step settings"]')`));
  assert.deepEqual(readDoc().autos[0],source,'Blank margin clicks deselect without changing the routine');
  await selectStep(0);
  await evaluate(`[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent==='X (m)').focus()`);
  window.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
  await wait(() => evaluate(`!document.querySelector('[data-add-point-handle]') && !document.querySelector('[aria-label="Step settings"]')`));
  await selectStep(0); await evaluate(`document.querySelector('[aria-label="Auto steps"]').click()`);
  await wait(() => evaluate(`!document.querySelector('[aria-label="Auto steps"] .Mui-selected')`));
  await click('Duplicate auto'); await wait(() => evaluate(`!!document.querySelector('[role=dialog]')`));
  await click('Cancel'); await wait(() => evaluate(`!document.querySelector('[role=dialog]')`));
  assert.equal(readDoc().autos.length,1,'Cancel does not create a routine');
  for (const [index,option] of ['None — exact copy','X — field length','Y — field width','X and Y'].entries()) {
    await evaluate(`[...document.querySelectorAll('[aria-label="Auto routines"] .MuiListItemButton-root')].find(el=>el.querySelector('.MuiListItemText-primary').textContent===${JSON.stringify(source.name)}).click()`);
    await click('Duplicate auto'); await wait(() => evaluate(`!!document.querySelector('[role=dialog]')`));
    await fill('New auto name',source.name);
    assert.equal(await evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(el=>el.textContent==='Duplicate').disabled`),true,'Existing routine names cannot be reused');
    const name = `Standalone ${index}`; await fill('New auto name',name); await selectOption('Mirror axis',option);
    if (index===1) await screenshot('duplicate-axis-dialog');
    await evaluate(`[...document.querySelectorAll('[role=dialog] button')].find(el=>el.textContent==='Duplicate').click()`);
    await wait(() => readDoc().autos.length === index+2); await saved();
    const copy=readDoc().autos.at(-1), x=index===1||index===3, y=index===2||index===3;
    assert.equal(copy.name,name); assert.equal(copy.steps.length,source.steps.length);
    assert.deepEqual(copy.symmetry,{flipX:false,flipY:false}); assert.equal(copy.isDefault,false);
    copy.steps.forEach((step,i)=>{assert.notEqual(step.id,source.steps[i].id);if(step.type==='drive'){
      assert.equal(step.pointId,null);
      assert.ok(Math.abs(step.x-(x?field.length-source.steps[i].x:source.steps[i].x))<.001);
      assert.ok(Math.abs(step.y-(y?field.width-source.steps[i].y:source.steps[i].y))<.001);
    }});
    assert.equal(await evaluate(`document.querySelector('[aria-label="Auto routines"] .Mui-selected .MuiListItemText-primary').textContent`),name,'Created duplicate is selected in the left list');
    assert.deepEqual(readDoc().autos[0],source,'Duplicating does not change the source');
  }
  await selectStep(0); await fill('X (m)',4.2); await saved(); assert.deepEqual(readDoc().autos[0],source,'Editing a duplicate leaves the source alone');
  await click('Save'); await wait(() => evaluate(`document.querySelector('[data-auto-code-current]').dataset.autoCodeCurrent==='true'`));
  assert.ok(fs.readFileSync(generatedPath,'utf8').includes('Standalone 3'));
  await reloadApp(); assert.equal(readDoc().autos.length,5);
  assert.equal(await evaluate(`document.querySelectorAll('[aria-label="Auto routines"] .MuiListItemButton-root').length`),5,'All copies remain in the list after restart');
  fs.writeFileSync(jsonPath,original); fs.writeFileSync(generatedPath,java); await reloadApp();
  console.log('Deselect and duplicate UI passed: blank field/list clicks, Escape from input, cancellation, all reflection axes, unique IDs, independent edits, visible list entries, Save and reload.');
};
