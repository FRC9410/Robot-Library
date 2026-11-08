const assert = require('node:assert/strict');
const fs = require('node:fs');

exports.checkAutoSettings = async ({evaluate,click,wait,saved,fill,addStep,selectOption,readDoc,generatedPath,reloadApp,screenshot,saveJava}) => {
  const tab=label=>evaluate(`[...document.querySelectorAll('[role=tab]')].find(el=>el.textContent===${JSON.stringify(label)}).click()`);
  const open=async()=>{
    await tab('Dashboard'); await evaluate(`document.querySelector('[aria-label="Open Config"]').click()`);
    await wait(()=>evaluate(`!!document.querySelector('[aria-label="Configuration categories"]')`));
    await evaluate(`[...document.querySelectorAll('[aria-label="Configuration categories"] .MuiListItemButton-root')].find(el=>el.textContent==='Auto').click()`);
    await wait(()=>evaluate(`!!document.querySelector('[aria-label="Auto configuration"] input')`));
  };
  const close=async()=>{await evaluate(`document.querySelector('[aria-label="Close Config"]').click()`);await wait(()=>evaluate(`!document.querySelector('[aria-label="Auto configuration"]')`));};
  await click('New auto'); await fill('Auto name','Shared settings draft');
  await addStep('Add point'); await addStep('Add branch'); await selectOption('Branch condition','Time remaining'); await saved(); await saveJava();
  // Make a fresh authoring edit and go straight to Config before its autosave delay.
  await addStep('Add wait'); await fill('Wait (s)',.7);
  await open();
  assert.equal(await evaluate(`[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent==='Autonomous duration (s)').value`),'20');
  await fill('Autonomous duration (s)',0);
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(el=>el.textContent==='Save auto settings').disabled`),true,'Invalid durations cannot save');
  assert.equal(readDoc().periodSeconds,20);
  await fill('Autonomous duration (s)',15); await click('Save auto settings');
  await wait(()=>evaluate(`document.querySelector('[data-auto-code-current]')?.getAttribute('data-auto-code-current')==='true'`));
  assert.equal(readDoc().periodSeconds,15);
  assert.equal(readDoc().autos[0].name,'Shared settings draft');
  assert.equal(readDoc().autos[0].steps[1].then[0].seconds,.7,'Config preserves the current editor draft and branch arms');
  assert.ok(fs.readFileSync(generatedPath,'utf8').includes('return 15.0 - AUTO_TIMER.get();'),'Duration changes reach the generated robot timer');
  await screenshot('auto-config-settings');
  await close(); await tab('Autos'); await reloadApp(); await open();
  assert.equal(await evaluate(`[...document.querySelectorAll('input')].find(el=>el.labels?.[0]?.textContent==='Autonomous duration (s)').value`),'15','Duration survives an app reload');
  await click('Reset to defaults'); await click('Save auto settings');
  await wait(()=>readDoc().periodSeconds===20); await wait(()=>evaluate(`document.querySelector('[data-auto-code-current]')?.getAttribute('data-auto-code-current')==='true'`));
  assert.ok(fs.readFileSync(generatedPath,'utf8').includes('return 20.0 - AUTO_TIMER.get();'));
  await close(); await tab('Autos');
  console.log('Auto Config passed: category, positive duration validation, shared unsaved draft preservation, generated timer, reset and restart persistence.');
};
