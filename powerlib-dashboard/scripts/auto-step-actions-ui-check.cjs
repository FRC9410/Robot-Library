const assert = require('node:assert/strict');

exports.checkStepActionsUI = async ({window,evaluate,wait,saved,readDoc,selectStep,screenshot}) => {
  const baseline=structuredClone(readDoc()),original=baseline.autos[0].steps;
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Auto editing tools"]')`),false,'Steps Edit button is removed');
  assert.ok(await evaluate(`(()=>{const card=document.querySelector('[aria-label="Steps card"]'),title=[...card.querySelectorAll('*')].find(el=>el.childNodes.length===1&&el.textContent==='Steps'),u=card.querySelector('[aria-label="Undo auto edit"]'),r=card.querySelector('[aria-label="Redo auto edit"]');const a=title.getBoundingClientRect(),b=u.getBoundingClientRect(),c=r.getBoundingClientRect();return Math.abs(a.y+a.height/2-b.y-b.height/2)<2&&Math.abs(a.y+a.height/2-c.y-c.height/2)<2;})()`),'Undo and redo share the Steps header row');
  assert.equal(await evaluate(`document.querySelectorAll('[data-step-move-icon]').length`),original.length);
  assert.ok(await evaluate(`[...document.querySelectorAll('[data-auto-step-row] .MuiListItemButton-root')].every(el=>el.draggable)`),'Entire rows remain draggable');
  for(const index of [0,3]) {
    await selectStep(index===0?3:0);
    await evaluate(`document.querySelector('[aria-label="Duplicate step ${index+1}"]').click()`);
    await wait(()=>readDoc().autos[0].steps.length===original.length+1); await saved();
    const steps=readDoc().autos[0].steps,copy=steps[index+1];
    assert.notEqual(copy.id,original[index].id);
    assert.deepEqual({...copy,id:original[index].id},original[index],'Duplication preserves settings');
    assert.deepEqual(steps.filter(step=>step.id!==copy.id),original,'Only the clicked row is duplicated, immediately after its source');
    assert.equal(await evaluate(`document.querySelector('[aria-label="Auto steps"] .Mui-selected').closest('[data-auto-step-row]').dataset.autoStepRow`),copy.id,'The new copy is selected');
    assert.ok(await evaluate(`(()=>{const row=document.querySelectorAll('[data-auto-step-row]')[${index}];const copy=row.querySelector('[aria-label^="Duplicate step"]'),trash=row.querySelector('[aria-label^="Delete step"]'),a=copy.getBoundingClientRect(),b=trash.getBoundingClientRect();return Math.abs(a.y-b.y)<2&&a.right<=b.left+1;})()`),'Duplicate icon sits next to trash');
    await screenshot('step-row-actions');
    await evaluate(`document.querySelector('[aria-label="Undo auto edit"]').click()`);
    await wait(()=>readDoc().autos[0].steps.length===original.length); await saved(); assert.deepEqual(readDoc(),baseline);
    assert.equal(await evaluate(`document.querySelector('[aria-label="Redo auto edit"]').disabled`),false);
    await evaluate(`document.querySelector('[aria-label="Redo auto edit"]').click()`);
    await wait(()=>readDoc().autos[0].steps.length===original.length+1); await saved(); assert.equal(readDoc().autos[0].steps[index+1].id,copy.id);
    await evaluate(`document.querySelector('[aria-label="Undo auto edit"]').click()`);
    await wait(()=>readDoc().autos[0].steps.length===original.length); await saved();
  }
  await selectStep(0);
  await evaluate(`document.querySelectorAll('[data-auto-step-row]')[2].querySelector('.MuiListItemButton-root').dispatchEvent(new MouseEvent('click',{bubbles:true,ctrlKey:true}))`);
  await evaluate(`document.querySelector('[aria-label="Duplicate step 2"]').click()`);
  await wait(()=>readDoc().autos[0].steps.length===original.length+1); await saved();
  assert.deepEqual({...readDoc().autos[0].steps[2],id:original[1].id},original[1],'A row icon duplicates only its row even with another group selected');
  await evaluate(`document.querySelector('[aria-label="Undo auto edit"]').click()`);
  await wait(()=>readDoc().autos[0].steps.length===original.length); await saved(); assert.deepEqual(readDoc(),baseline);
  console.log('Step actions passed: no Edit button, aligned undo/redo icons, whole-row movement with move icons, row-specific duplication and immediate insertion, preserved settings, undo/redo and grouped-selection isolation.');
};
