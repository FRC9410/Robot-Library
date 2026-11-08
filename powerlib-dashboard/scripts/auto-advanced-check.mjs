import assert from "node:assert/strict";

export async function checkAdvancedAutos({ model: m, docs, files, load, context }) {
  assert.deepEqual(files.parseRobotChecks(`class RobotChecks {
    public boolean branchReady() { return true; }
    public final boolean otherCheck() { return false; }
    private boolean hidden() { return true; }
    public static boolean staticCheck() { return true; }
    public boolean needsArgument(int x) { return true; }
    public boolean checked() throws Exception { return true; }
    class Inner { public boolean nested() { return true; } }
    // public boolean commented() {}
    String text = "public boolean quoted() {}";
  }`), ["branchReady", "otherCheck"]);
  assert.deepEqual(files.parseRobotChecks('class StateMachine { public boolean outsideBucket() { return true; } }'), [], "StateMachine methods are not listed as robot checks");
  const edits = await load("advanced-edits", "src/features/autos/autoEditing.ts");
  const state = context.states[0], other = context.states[1];
  assert.ok(other, "Branch behavior checks need two distinct robot states");
  const drive = (x, y) => ({ ...m.createStep("drive", context), x, y });
  const request = state => ({ ...m.createStep("requestState", context), state });
  const branch = condition => ({ ...m.createStep("branch", context), condition, then: [request(state)], otherwise: [request(other)] });
  const point = { id: m.createId(), name: "Auto Timer", x: 6, y: 6, heading: 0 };
  const advanced = { ...m.createAuto("P5 Advanced"), steps: [drive(1, 2), {
    ...drive(4, 2), heading: 90, turn: { mode: "later", startProgress: .6 }, maxTurnRate: 30, endHeadingTolerance: 5,
    subpoints: [{ id: m.createId(), progress: .75, state: other }, { id: m.createId(), progress: .25, state }]
  }, { ...drive(5, 3), turn: { mode: "face", x: point.x, y: point.y, pointId: point.id } }] };
  const autos = [advanced,
    { ...m.createAuto("P5 State"), steps: [branch({ kind: "state", state, waitSeconds: .1 })] },
    { ...m.createAuto("P5 Check"), steps: [branch({ kind: "check", method: "branchReady", waitSeconds: .1 })] },
    { ...m.createAuto("P5 Time yes"), steps: [branch({ kind: "timeLeft", seconds: 19 })] },
    { ...m.createAuto("P5 Time no"), steps: [{ ...m.createStep("wait", context), seconds: .1 }, branch({ kind: "timeLeft", seconds: 20 })] },
  ];
  const document = { ...m.emptyDocument(), points: [point], autos };
  const project = { ...context, checks: ["branchReady"] };
  assert.equal(m.hasErrors(m.validateAutos(document, project)), false);
  assert.deepEqual(docs.readAutoDocument(document), document, "Advanced data round trips without dropping either branch arm");
  const java = m.generateAutosJava(document, project);
  assert.ok(java.includes('.turningAfter(0.6)') && java.includes('.withMaxTurnRate(Math.toRadians(30.0))'));
  assert.ok(java.includes('.facing(AUTO_TIMER_2.getTranslation())'), "Named constants cannot collide with the auto timer");
  assert.ok(java.indexOf('.atProgress(0.25') < java.indexOf('.atProgress(0.75'), "Subpoints generate in execution order");
  assert.ok(java.includes('robot.checks.branchReady()') && java.includes('secondsLeft() >= 19.0'));
  for (const patch of [{ turn: { mode: "later", startProgress: 1.1 } }, { maxTurnRate: 0 }, { subpoints: [{ id: m.createId(), progress: -1, state }] }]) {
    const bad = structuredClone(document); Object.assign(bad.autos[0].steps[1], patch);
    assert.ok(m.hasErrors(m.validateAutos(bad, project))); assert.throws(() => m.generateAutosJava(bad, project));
  }
  for (const patch of [{ type: "future" }, { type: "branch", condition: { kind: "future" }, then: [], otherwise: [] },
    { type: "drive", ...drive(1, 2), turn: { mode: "future" } }, { ...drive(1, 2), subpoints: [null] }]) {
    assert.throws(() => docs.readAutoDocument({ ...document, autos: [{ ...advanced, steps: [patch] }] }));
  }
  const nested = structuredClone(autos[1]); nested.steps[0].then = [branch({ kind: "timeLeft", seconds: 5 })];
  assert.throws(() => docs.readAutoDocument({ ...document, autos: [nested] }), /cannot contain/);
  const invalidCheck = structuredClone(autos[2]); invalidCheck.steps[0].condition.method = "unknown";
  assert.ok(m.hasErrors(m.validateAutos({ ...document, autos: [invalidCheck] }, project)));
  const armBranch = branch({ kind: "state", state, waitSeconds: 0 });
  armBranch.then = [{ ...drive(point.x, point.y), heading: point.heading, pointId: point.id }]; armBranch.otherwise = [drive(8, 2)];
  const linkedAuto = { ...m.createAuto("Linked branch"), steps: [armBranch] };
  const linkedDoc = { ...document, autos: [linkedAuto] };
  const changed = edits.editAuto(linkedDoc, linkedAuto.id, auto => ({ ...auto, steps: m.mapSteps(auto.steps, step => step.id === armBranch.then[0].id ? { ...step, x: 7 } : step) }));
  assert.equal(changed.points[0].x, 7, "Editing a branch child updates shared points");
  const copied = edits.cloneStep(armBranch);
  assert.equal(new Set([...m.allSteps([armBranch]), ...m.allSteps([copied])].map(step => step.id)).size, 6);
  const inserted = m.insertStepsAt([armBranch], { after: armBranch.then[0].id }, [request(state)]);
  assert.equal(inserted[0].then.length, 2, "Insertion after a child stays in its arm");
  assert.equal(m.insertStepsAt([armBranch], { into: { branchId: armBranch.id, arm: "then" } }, [copied]).length, 2, "A branch added within a branch is placed after its parent");
  const moved = m.moveStepsInto([armBranch], [armBranch.then[0].id], { branchId: armBranch.id, arm: "otherwise" }, 0);
  assert.equal(moved[0].then.length, 0); assert.equal(moved[0].otherwise[0].id, armBranch.then[0].id);
  assert.deepEqual(m.routeSteps([armBranch], { [armBranch.id]: "otherwise" }).map(step => step.id), [armBranch.id, armBranch.otherwise[0].id]);
  assert.equal(m.moveStepsInto([armBranch], [armBranch.id], { branchId: armBranch.id, arm: "then" }, 0)[0], armBranch);
  console.log("Phase 5 model checks passed: strict advanced documents, checks discovery, both arms, recursive editing/shared links, cloning, generation and turn validation.");
  return document;
}
