import { useState } from "react";
import { Button, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { DrivetrainLimits } from "../autoLimits";
import type { AutoIssue, AutoRoutine, AutoStep, BranchArm, BranchChoices, NamedPoint } from "../autoModel";
import { stepsInOrder } from "../autoRoute";
import type { PointActions } from "../pointActions";
import type { StepActions } from "../stepActions";
import type { BranchSide, BranchView, LegReplayInfo, SelectMode } from "../types";
import { AddStepMenu } from "./AddStepMenu";
import { MultiStepInspector } from "./MultiStepInspector";
import { Pane } from "./Pane";
import { PaneHeader } from "./PaneHeader";
import { StepInspector } from "./StepInspector";
import { StepList } from "./StepList";
import { StepSettings } from "./StepSettings";

type StepsPaneProps = {
  collapsed: boolean;
  auto: AutoRoutine | null;
  /** Steps in the auto, counting both sides of each branch. */
  stepCount: number;
  selection: string[];
  /** The primary selected step, which the inspector shows. */
  selectedStep: AutoStep | null;
  choices: BranchChoices;
  activeStepId: string | null;
  durations: Map<string, number>;
  issues: AutoIssue[];
  stateColor: (state: string | null) => string;
  driveNumbers: Map<string, number>;
  states: string[];
  points: NamedPoint[];
  /** The field shows the mirrored copy; step values are still the original's. */
  mirrored: boolean;
  legInfo?: LegReplayInfo;
  /** Null when the project has no TunerConstants, undefined while loading. */
  drivetrain?: DrivetrainLimits | null;
  /** StateMachine's yes/no methods a branch can check, and the autonomous period. */
  checks: string[];
  period: number;
  /** When the replay reaches the selected step. */
  reachedAt?: number;
  onSelectSteps: (stepIds: string[], mode: SelectMode) => void;
  onShowArm: (branchId: string, arm: BranchArm) => void;
  steps: StepActions;
  pointActions: PointActions;
};

/** The right column: the selected auto's steps in run order, and the selected step's settings. */
export function StepsPane({ collapsed, auto, stepCount, selection, selectedStep, choices, activeStepId, durations, issues, stateColor, driveNumbers, states,
  points, mirrored, legInfo, drivetrain, checks, period, reachedAt, onSelectSteps, onShowArm, steps, pointActions }: StepsPaneProps) {
  /** The add-step menu; `into` is set when it adds to one side of a branch. */
  const [addMenu, setAddMenu] = useState<{ anchor: HTMLElement; into?: BranchSide } | null>(null);
  const clear = () => onSelectSteps([], "replace");
  const branch: BranchView = { checks, reachedAt, period, showing: selectedStep ? choices[selectedStep.id] ?? "then" : "then",
    onShow: arm => { if (selectedStep) onShowArm(selectedStep.id, arm); },
    onAddTo: (arm, anchor) => { if (selectedStep) setAddMenu({ anchor, into: { branchId: selectedStep.id, arm } }); } };

  return <Pane collapsed={collapsed} label="Steps">
    <PaneHeader title="Steps" count={auto ? stepCount : undefined}>
      <Button size="small" variant="outlined" startIcon={<AddIcon />} disabled={!auto} onClick={event => setAddMenu({ anchor: event.currentTarget })}>Add step</Button>
      <AddStepMenu anchor={addMenu?.anchor ?? null} intoBranch={Boolean(addMenu?.into)} onClose={() => setAddMenu(null)}
        onAdd={type => steps.addStep(type, addMenu?.into ? { into: addMenu.into } : undefined)} />
    </PaneHeader>
    {!auto ? <div className="ab-pane-body"><div className="ab-empty"><Typography variant="body2" color="text.secondary">Pick an auto to see its steps.</Typography></div></div> : <>
      <div className={`ab-pane-body ab-step-scroll${selection.length ? " shrink" : ""}`}>
        {auto.steps.length === 0
          ? <div className="ab-empty">
            <Typography variant="body2">No steps yet</Typography>
            <Typography variant="caption" color="text.secondary">Click the field to add drive points, or use Add step (keys 1–5).</Typography>
          </div>
          : <StepList steps={auto.steps} choices={choices} selectedStepIds={selection} activeStepId={activeStepId} durations={durations} issues={issues}
            stateColor={stateColor} onSelect={(stepId, toggle) => onSelectSteps([stepId], toggle ? "toggle" : "replace")} onReorder={steps.moveStepsTo}
            onDelete={stepId => steps.deleteSteps([stepId])} onShowArm={onShowArm} onAddTo={(into, anchor) => setAddMenu({ anchor, into })} />}
      </div>
      {selection.length > 1 && <div key="several" className="ab-pane-body ab-inspector">
        <MultiStepInspector steps={stepsInOrder(auto.steps, selection)} onApplyLimits={limits => steps.applyLimits(selection, limits)}
          onAlign={steps.alignSelected} onDuplicate={() => steps.duplicateSteps(selection)} onDelete={() => steps.deleteSteps(selection)} onClose={clear} />
      </div>}
      {selection.length === 1 && selectedStep && <div key={selectedStep.id} className="ab-pane-body ab-inspector">
        <StepInspector step={selectedStep} driveNumber={driveNumbers.get(selectedStep.id) ?? 0}
          issues={issues.filter(issue => issue.stepId === selectedStep.id)} onClose={clear}>
          <StepSettings step={selectedStep} driveNumber={driveNumbers.get(selectedStep.id) ?? 0} states={states} legInfo={legInfo} drivetrain={drivetrain}
            branch={branch} mirrored={mirrored} points={points} onChange={patch => steps.updateStep(selectedStep.id, patch)}
            onApplyLimitsToAll={steps.applyLimitsToAll} onLinkPoint={pointId => pointActions.link(selectedStep.id, pointId)}
            onSavePoint={() => { if (selectedStep.type === "drive") pointActions.saveFrom(selectedStep); }}
            onRenamePoint={name => { if (selectedStep.type === "drive" && selectedStep.pointId) pointActions.rename(selectedStep.pointId, name); }} />
        </StepInspector>
      </div>}
    </>}
  </Pane>;
}
