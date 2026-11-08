const assert = require('node:assert/strict');

exports.checkPlusSnapUI = async ({ window, evaluate, wait, saved, selectStep, readDoc }) => {
  const original=structuredClone(readDoc()), source=original.autos[0].steps[2];
  const position = (x,y) => evaluate(`(()=>{const svg=document.querySelector('svg[aria-label="Field and robot position"]'),length=Number(svg.dataset.fieldLength),width=Number(svg.dataset.fieldWidth),p=new DOMPoint(${x}/length*(480*length/width),480-${y}/width*480).matrixTransform(svg.getScreenCTM());return {x:Math.round(p.x),y:Math.round(p.y)};})()`);
  const cases=[
    {x:1.54,y:5.4,snap:false,label:'earlier point X'},
    {x:7,y:2.04,snap:false,label:'earlier point Y'},
    {x:6,y:4.53,snap:false,label:'45° from an earlier point'},
    {x:source.x+.04,y:5.4,snap:true,label:'source X'},
    {x:7,y:source.y+.04,snap:true,label:'source Y'},
    {x:source.x+1.4,y:source.y+1.44,snap:true,label:'source 45°'},
  ];
  for(const sample of cases) {
    await selectStep(2);
    const start=await evaluate(`(()=>{const r=document.querySelector('[data-add-point-handle]').getBoundingClientRect();return {x:Math.round(r.x+r.width/2),y:Math.round(r.y+r.height/2)};})()`), target=await position(sample.x,sample.y);
    window.webContents.sendInputEvent({type:'mouseMove',...start}); window.webContents.sendInputEvent({type:'mouseDown',...start,button:'left',clickCount:1});
    window.webContents.sendInputEvent({type:'mouseMove',...target,modifiers:['leftButtonDown']});
    await wait(()=>evaluate(`!!document.querySelector('[data-new-point-preview]')`));
    assert.equal(await evaluate(`!!document.querySelector('[data-snap-guide]')`),sample.snap,sample.label);
    assert.deepEqual(readDoc(),original,'Preview leaves the draft unchanged');
    window.webContents.sendInputEvent({type:'mouseUp',...target,button:'left',clickCount:1});
    await wait(()=>readDoc().autos[0].steps.length===original.autos[0].steps.length+1); await saved();
    const created=readDoc().autos[0].steps[3];
    assert.deepEqual(readDoc().autos[0].steps[2],source,'The source stays fixed');
    if(!sample.snap) assert.ok(Math.hypot(created.x-sample.x,created.y-sample.y)<.025,'Earlier-point alignment does not pull the new point away from the pointer');
    else if(sample.label==='source X') assert.equal(created.x,source.x);
    else if(sample.label==='source Y') assert.equal(created.y,source.y);
    else assert.ok(Math.abs(created.x-source.x-created.y+source.y)<.0002);
    await evaluate(`document.querySelector('svg[aria-label="Field and robot position"]').focus()`);
    window.webContents.sendInputEvent({type:'keyDown',keyCode:'Z',modifiers:['control']}); window.webContents.sendInputEvent({type:'keyUp',keyCode:'Z',modifiers:['control']});
    await wait(()=>readDoc().autos[0].steps.length===original.autos[0].steps.length); await saved();
    assert.deepEqual(readDoc(),original);
  }
  console.log('Plus snap references passed: ignores earlier-point X/Y/45° targets, retains source X/Y/45° snapping, preview, fixed source and undo.');
};
