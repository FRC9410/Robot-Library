import assert from "node:assert/strict";

export async function checkAutoEditing({ load, model, docs, context }) {
  const { AutoHistory } = await load("history", "src/features/autos/autoHistory.ts");
  const edits = await load("editing", "src/features/autos/autoEditing.ts");
  const snap = await load("snapping", "src/features/autos/autoSnap.ts");
  const { selectAutoSteps } = await load("selection", "src/features/autos/autoSelection.ts");
  const selectionOrder = ["a", "wait", "b", "state", "c"];
  assert.deepEqual(selectAutoSteps(selectionOrder,["a"],"c","range"),selectionOrder,"Shift includes every step between the two endpoints");
  const backwards = selectAutoSteps(selectionOrder,["c"],"a","range");
  assert.deepEqual([...backwards].sort(),[...selectionOrder].sort()); assert.equal(backwards.at(-1),"a");
  assert.deepEqual(selectAutoSteps(selectionOrder,[],"b","range"),["b"]);
  assert.deepEqual(selectAutoSteps(selectionOrder,["a","state"],"c","range"),["a","state","c"],"Ctrl ranges keep earlier selections");
  assert.deepEqual(selectAutoSteps(selectionOrder,["a","b","c"],"b",true),["a","c"],"Ctrl removes only the clicked item");
  assert.deepEqual(selectAutoSteps(selectionOrder,["a","b","c"],"b"),["b"],"A plain click replaces a group");
  assert.deepEqual(selectAutoSteps(selectionOrder,["a","b","c"],"b",false,true),["a","c","b"],"Dragging keeps the selected group");
  const field = context.field;
  const point = { id: model.createId(), name: "Shared scoring spot", x: 2, y: 3, heading: 30 };
  const drive = () => ({ ...model.createStep("drive", context), ...{ x: point.x, y: point.y, heading: point.heading }, pointId: point.id });
  const first = { ...model.createAuto("Shared route"), alliance: "Blue", symmetry: { flipX: true, flipY: false }, steps: [drive(), drive()] };
  const second = { ...model.createAuto("Other shared route"), steps: [drive()] };
  const document = { ...model.emptyDocument(), points: [point], autos: [first, second] };
  assert.deepEqual(docs.readAutoDocument(document), document);
  const moved = edits.editAuto(document, first.id, auto => ({ ...auto, steps: auto.steps.map((step, index) => index ? step : { ...step, x: 4 }) }));
  assert.equal(moved.points[0].x, 4);
  assert.deepEqual(moved.autos.flatMap(auto => auto.steps.map(step => step.x)), [4, 4, 4], "Moving one of multiple shared links moves all links without an unchanged link reversing it");
  assert.equal(document.points[0].x, 2, "History snapshots remain immutable");
  const unlinked = model.deleteNamedPoint(moved, point.id);
  assert.ok(unlinked.autos.every(auto => auto.steps.every(step => step.pointId === null && step.x === 4)));
  for (const flips of [{ flipX: true, flipY: false }, { flipX: false, flipY: true }, { flipX: true, flipY: true }]) {
    const shown = edits.shownAuto(first, flips, field);
    assert.equal(shown.steps[0].pointId, point.id);
    const inverse = edits.sourceStep(shown.steps[0], first.steps[0], flips, field);
    assert.deepEqual(inverse, first.steps[0], "Mirror view edits map back to source coordinates and keep links");
  }
  const translated = edits.translateSteps([{ ...first.steps[0], x: 1 }, { ...first.steps[1], x: 3 }], first.steps.map(step => step.id), -5, 0, field);
  assert.deepEqual(translated.map(step => step.x), [0, 2], "Group boundaries preserve relative spacing");
  const copy = edits.cloneStep(first.steps[0]);
  assert.notEqual(copy.id, first.steps[0].id); assert.equal(copy.pointId, point.id);
  const copies = [];
  for (const reflection of [{ flipX: false, flipY: false }, { flipX: true, flipY: false }, { flipX: false, flipY: true }, { flipX: true, flipY: true }]) {
    const copied = edits.duplicateAuto(first, `Copied ${copies.length}`, reflection, field);
    assert.notEqual(copied.id,first.id); assert.deepEqual(copied.symmetry,{ flipX: false, flipY: false });
    assert.equal(copied.alliance,reflection.flipX ? "Red" : "Blue");
    copied.steps.forEach((step,index) => {
      assert.notEqual(step.id,first.steps[index].id); assert.equal(step.pointId,null);
      const pose=model.flipPoint(first.steps[index],reflection,field); assert.deepEqual([step.x,step.y,step.heading],[pose.x,pose.y,pose.heading]);
    });
    assert.equal(copied.isDefault,false); assert.equal(copied.clearRequestsAtEnd,true);
    assert.deepEqual(docs.readAutoDocument({ ...model.emptyDocument(),autos:[copied] }).autos[0],copied);
    copies.push(copied);
  }
  assert.equal(edits.uniqueAutoCopyName(first,[`${first.name} copy`,`${first.name} copy 2`]),`${first.name} copy 3`);
  assert.ok(edits.uniqueAutoCopyName({ ...first,name:"a".repeat(100) },[]).length <= 100);
  assert.equal(document.autos[0].steps[0].pointId,point.id,"Routine duplication leaves the source and shared points unchanged");
  const order = [first.steps[0], first.steps[1], model.createStep("wait", context), model.createStep("wait", context)];
  const orderIds = order.map(step=>step.id);
  assert.deepEqual(edits.reorderStepsBefore(order,[orderIds[0]],orderIds[2]).map(step=>step.id),[orderIds[1],orderIds[0],orderIds[2],orderIds[3]]);
  assert.deepEqual(edits.reorderStepsBefore(order,[orderIds[0]],null).map(step=>step.id),[...orderIds.slice(1),orderIds[0]]);
  assert.deepEqual(edits.reorderStepsBefore(order,[orderIds[3]],orderIds[0]).map(step=>step.id),[orderIds[3],...orderIds.slice(0,3)]);
  assert.deepEqual(edits.reorderStepsBefore(order,[orderIds[0],orderIds[2]],null).map(step=>step.id),[orderIds[1],orderIds[3],orderIds[0],orderIds[2]],"Group drops retain internal step order");
  assert.deepEqual(edits.reorderStepsBefore(order,[orderIds[0],orderIds[2]],orderIds[2]).map(step=>step.id),[orderIds[1],orderIds[0],orderIds[2],orderIds[3]],"Dropping at a selected-row boundary counts only the remaining rows");
  assert.equal(edits.reorderStepsBefore(order,[orderIds[0]],"missing"),order);
  assert.deepEqual(model.shiftSteps(order, [order[0].id, order[1].id], 1).map(step => step.id), [order[2].id, order[0].id, order[1].id, order[3].id]);
  const history = new AutoHistory(document);
  history.begin(); for (let x = 2; x <= 20; x++) history.update(doc => edits.editAuto(doc, first.id, auto => ({ ...auto, steps: auto.steps.map(step => ({ ...step, x })) })));
  history.end(); assert.equal(history.past.length, 1);
  history.undo(); assert.deepEqual(history.document, document); history.redo(); assert.equal(history.document.points[0].x, 20);
  history.begin(); history.update(document); history.end(true); assert.equal(history.document.points[0].x, 20); assert.equal(history.past.length, 1);
  history.undo(); history.update(moved); assert.equal(history.canRedo, false);
  for (let x = 5; x < 115; x++) history.update(doc => ({ ...doc, periodSeconds: x }));
  assert.equal(history.past.length, 100); history.reset(document); assert.equal(history.canUndo, false);
  const targets = { xs: [{ value: 2, at: 3, label: "X" }], ys: [{ value: 3, at: 2, label: "Y" }], anchors: [] };
  assert.deepEqual(snap.snapPosition({ x: 2.03, y: 3.02 }, targets, .06, field).point, { x: 2, y: 3 });
  assert.deepEqual(snap.snapPosition({ x: 2.3, y: 3.2 }, targets, .06, field).guides, []);
  const diagonal = snap.snapPosition({ x: 3, y: 3.04 }, { xs: [], ys: [], anchors: [{ point: { x: 1, y: 1 }, label: "start" }] }, .06, field);
  assert.ok(Math.abs(diagonal.point.x - diagonal.point.y) < 1e-8);
  assert.equal(snap.snapHeading(179, [{ value: -179, label: "neighbor" }], 3).heading, 180);
  assert.equal(snap.snapHeading(89, [], 3).heading, 90);
  for (const bad of [
    { ...document, points: [{ ...point, x: null }] }, { ...document, points: [{ ...point, id: first.id }] },
    { ...document, autos: [{ ...first, steps: [{ ...first.steps[0], pointId: "missing" }] }] },
    { ...document, autos: [{ ...first, symmetry: { flipX: "true", flipY: false } }] },
  ]) assert.throws(() => docs.readAutoDocument(bad));
  assert.ok(model.hasErrors(model.validateAutos({ ...document, points: [point, { ...point, id: model.createId() }] }, context)));
  const java = model.generateAutosJava(document, context);
  assert.ok(java.includes('Shared route (Red)')); assert.ok(java.includes('Alliance.Red'));
  assert.ok(java.includes('SHARED_SCORING_SPOT')); assert.equal(java, model.generateAutosJava(docs.readAutoDocument(document), context));
  console.log("Phase 4 editing checks passed: grouped history/cancel, copy IDs, stable reordering, group boundaries, snapping, shared links, inverse mirrors, and strict document validation.");
  return { ...document, autos:[...document.autos,...copies] };
}
