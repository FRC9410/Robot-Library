import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactElement, ReactNode } from "react";
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import AddLocationIcon from "@mui/icons-material/AddLocationAlt";
import PlaceIcon from "@mui/icons-material/Place";
import AddIcon from "@mui/icons-material/Add";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import FlagIcon from "@mui/icons-material/Flag";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import RouteIcon from "@mui/icons-material/Route";
import type { AutoIssue, AutoStep, AutoStepType, BranchArm, BranchChoices, BranchCondition, BranchStep, DriveStep, LegConstraints, LegTurn, ListRef, NamedPoint, Subpoint } from "./autoModel";
import { allSteps, branchWaitSeconds, createId, defaultConstraints, defaultTurnRate, legConstraints, legEndHeading, orderedSubpoints, round } from "./autoModel";
import type { DrivetrainLimits } from "./autoLimits";
import { describeLimits } from "./autoLimits";

export const stepIcons: Record<AutoStepType, ReactElement> = {
  drive: <RouteIcon fontSize="small" />,
  requestState: <FlagIcon fontSize="small" />,
  waitForState: <PlaylistAddCheckIcon fontSize="small" />,
  wait: <HourglassEmptyIcon fontSize="small" />,
  branch: <CallSplitIcon fontSize="small" />
};

export const stepDescriptions: Record<AutoStepType, string> = {
  drive: "Drive to a pose with this leg's speed and finish limits",
  requestState: "Ask the state machine for a state and continue immediately",
  waitForState: "Pause until the state machine reports a state",
  wait: "Pause for a fixed time",
  branch: "Run different steps depending on the robot or the time left"
};

const format = (value: number, digits = 2) => Number.isFinite(value) ? String(Number(value.toFixed(digits))) : "?";

export function NumberField({ label, value, onChange, unit, allowEmpty = false, placeholder, error }: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  allowEmpty?: boolean;
  placeholder?: string;
  error?: boolean;
}) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  // Follow outside edits, such as dragging on the field, without fighting the user's typing.
  useEffect(() => {
    setDraft(current => (current.trim() === "" ? null : Number(current)) === value ? current : value === null ? "" : String(value));
  }, [value]);
  const parsed = draft.trim() === "" ? null : Number(draft);
  const invalid = parsed === null ? !allowEmpty : !Number.isFinite(parsed);
  return <TextField size="small" label={label} value={draft} error={invalid || error} placeholder={placeholder} fullWidth
    slotProps={{ inputLabel: placeholder ? { shrink: true } : undefined, input: { endAdornment: unit ? <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{unit}</Typography> : undefined } }}
    onChange={event => {
      setDraft(event.target.value);
      const next = event.target.value.trim() === "" ? null : Number(event.target.value);
      if (next === null ? allowEmpty : Number.isFinite(next)) onChange(next);
    }} />;
}

export function stepTitle(step: AutoStep, driveNumber: number) {
  switch (step.type) {
    case "drive": return `Drive to point ${driveNumber}`;
    case "requestState": return `Request ${step.state || "state"}`;
    case "waitForState": return `Wait for ${step.state || "state"}`;
    case "wait": return `Wait ${format(step.seconds)} s`;
    case "branch": return `If ${conditionLabel(step.condition)}`;
  }
}

function conditionLabel(condition: BranchCondition) {
  switch (condition.kind) {
    case "state": return condition.state || "state";
    case "check": return condition.method ? `${condition.method}()` : "robot check";
    case "timeLeft": return `${format(condition.seconds)} s left`;
  }
}

function stepSummary(step: AutoStep) {
  switch (step.type) {
    case "drive": {
      const subpoints = orderedSubpoints(step).map(subpoint => `${subpoint.state || "?"} at ${format(subpoint.progress * 100, 0)}%`);
      return subpoints.length
        ? `${format(step.maxVelocity, 1)} m/s · ${subpoints.join(", ")}`
        : `(${format(step.x)}, ${format(step.y)}) · ${format(legEndHeading(step), 0)}° · ${format(step.maxVelocity, 1)} m/s`;
    }
    case "requestState": return "Continues immediately";
    case "waitForState": return step.timeoutSeconds === null ? "No timeout" : `Timeout ${format(step.timeoutSeconds)} s`;
    case "wait": return "Fixed pause";
    case "branch": {
      const wait = branchWaitSeconds(step);
      return `${wait > 0 ? `Waits up to ${format(wait)} s · ` : ""}Then ${stepCount(step.then)}, otherwise ${stepCount(step.otherwise)}`;
    }
  }
}

const armLabels: Record<BranchArm, string> = { then: "Then", otherwise: "Otherwise" };
const listKey = (list: ListRef) => list ? `${list.branchId}:${list.arm}` : "";
const stepCount = (steps: AutoStep[]) => steps.length ? `${steps.length} step${steps.length === 1 ? "" : "s"}` : "nothing";

/** Rows of the step list in run order: each branch's steps sit under a label for their side. */
type StepRow =
  | { kind: "step"; step: AutoStep; list: ListRef; index: number; last: boolean; number: number; driveNumber: number; offRoute: boolean }
  | { kind: "arm"; branch: BranchStep; arm: BranchArm; offRoute: boolean };

function stepRows(steps: AutoStep[], choices: BranchChoices) {
  const rows: StepRow[] = [];
  let number = 0;
  let driveNumber = 0;
  const visit = (list: AutoStep[], ref: ListRef, offRoute: boolean) => list.forEach((step, index) => {
    if (step.type === "drive") driveNumber++;
    rows.push({ kind: "step", step, list: ref, index, last: index === list.length - 1, number: ++number, driveNumber, offRoute });
    if (step.type !== "branch") return;
    for (const arm of ["then", "otherwise"] as const) {
      const hidden = offRoute || (choices[step.id] ?? "then") !== arm;
      rows.push({ kind: "arm", branch: step, arm, offRoute: hidden });
      visit(step[arm], { branchId: step.id, arm }, hidden);
    }
  });
  visit(steps, null, false);
  return rows;
}

export function StepList({ steps, choices, selectedStepIds, activeStepId, durations, issues, stateColor, onSelect, onReorder, onDelete, onShowArm, onAddTo }: {
  steps: AutoStep[];
  /** The side of each branch the field shows; steps on the other side are dimmed. */
  choices: BranchChoices;
  selectedStepIds: string[];
  activeStepId: string | null;
  durations: Map<string, number>;
  issues: AutoIssue[];
  stateColor: (state: string | null) => string;
  /** `toggle` adds or removes the step from the selection (Shift- or Ctrl-click). */
  onSelect: (stepId: string, toggle: boolean) => void;
  /** Moves the steps so they sit before the step now at `index` of `list` (its length for the end). */
  onReorder: (stepIds: string[], list: ListRef, index: number) => void;
  onDelete: (stepId: string) => void;
  /** Shows one side of a branch on the field. */
  onShowArm: (branchId: string, arm: BranchArm) => void;
  /** Opens the add-step menu for one side of a branch. */
  onAddTo: (into: { branchId: string; arm: BranchArm }, anchor: HTMLElement) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // Dragging a selected step carries the whole selection; the drop line shows where it lands.
  const dragging = useRef<{ ids: string[]; branch: boolean } | null>(null);
  const [drop, setDrop] = useState<{ list: ListRef; index: number } | null>(null);
  const endDrag = () => { dragging.current = null; setDrop(null); };
  const isDrop = (list: ListRef, index: number) => drop !== null && listKey(drop.list) === listKey(list) && drop.index === index;
  /** Shows where a drop would land; branches can't go inside a branch. */
  const offer = (event: DragEvent, list: ListRef, index: number) => {
    if (!dragging.current) return;
    if (list && dragging.current.branch) { setDrop(null); return; }
    event.preventDefault();
    if (!isDrop(list, index)) setDrop({ list, index });
  };
  const primary = selectedStepIds[selectedStepIds.length - 1];
  // Keep the most recently selected step visible when it is picked on the field.
  useEffect(() => {
    listRef.current?.querySelector(`[data-step-id="${primary}"]`)?.scrollIntoView({ block: "nearest" });
  }, [primary]);
  return <ol className="ab-steps" ref={listRef}
    onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDrop(null); }}
    onDrop={event => {
      event.preventDefault();
      if (dragging.current && drop) onReorder(dragging.current.ids, drop.list, drop.index);
      endDrag();
    }}>
    {stepRows(steps, choices).map(row => {
      if (row.kind === "arm") {
        const { branch, arm } = row;
        const into = { branchId: branch.id, arm };
        return <li key={listKey(into)} className={`ab-arm${row.offRoute ? " off-route" : ""}${!branch[arm].length && isDrop(into, 0) ? " drop-into" : ""}`}
          title={row.offRoute ? "Click to show this side on the field" : "Shown on the field"}
          onDragOver={event => offer(event, into, 0)} onClick={() => onShowArm(branch.id, arm)}>
          <span>{armLabels[arm]}</span>
          {!branch[arm].length && <span className="ab-arm-empty">nothing, carry on</span>}
          <Tooltip title={`Add a step to ${armLabels[arm]}`}>
            <IconButton size="small" aria-label={`Add a step to ${armLabels[arm]}`} onClick={event => { event.stopPropagation(); onAddTo(into, event.currentTarget); }}>
              <AddIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </li>;
      }
      const { step } = row;
      const stepIssues = issues.filter(issue => issue.stepId === step.id);
      const severity = stepIssues.some(issue => issue.severity === "error") ? "error" : stepIssues.length ? "warning" : null;
      const accent = step.type === "requestState" || step.type === "waitForState" ? stateColor(step.state) : undefined;
      const duration = durations.get(step.id);
      const classes = ["ab-step", row.list && "nested", step.type === "branch" && "branch", row.offRoute && "off-route",
        selectedStepIds.includes(step.id) && "selected", step.id === activeStepId && "active", severity,
        isDrop(row.list, row.index) && "drop-above", row.list && row.last && isDrop(row.list, row.index + 1) && "drop-below"];
      return <li key={step.id} data-step-id={step.id} className={classes.filter(Boolean).join(" ")}
        draggable
        onDragStart={event => {
          const ids = selectedStepIds.includes(step.id) ? selectedStepIds : [step.id];
          dragging.current = { ids, branch: allSteps(steps).some(candidate => candidate.type === "branch" && ids.includes(candidate.id)) };
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", ids.join(","));
        }}
        onDragOver={event => {
          const box = event.currentTarget.getBoundingClientRect();
          const lower = event.clientY >= box.top + box.height / 2;
          // The lower half of a branch drops into its Then side, which comes right after it.
          if (step.type === "branch" && lower) offer(event, { branchId: step.id, arm: "then" }, 0);
          else offer(event, row.list, row.index + (lower ? 1 : 0));
        }}
        onDragEnd={endDrag}
        style={accent ? { borderLeftColor: accent } : undefined}
        onClick={event => onSelect(step.id, event.shiftKey || event.ctrlKey || event.metaKey)}>
        <span className="ab-step-index">{row.number}</span>
        <span className="ab-step-icon" style={accent ? { color: accent } : undefined}>{stepIcons[step.type]}</span>
        <span className="ab-step-text">
          <span className="ab-step-title">{stepTitle(step, row.driveNumber)}</span>
          <span className="ab-step-summary">{severity ? stepIssues[0].message : stepSummary(step)}</span>
        </span>
        {duration !== undefined && <span className="ab-step-time">{format(duration, 1)} s</span>}
        <span className="ab-step-actions" onClick={event => event.stopPropagation()}>
          <IconButton size="small" aria-label="Delete step" onClick={() => onDelete(step.id)}><DeleteIcon fontSize="inherit" /></IconButton>
        </span>
      </li>;
    })}
    <li className={`ab-steps-end${isDrop(null, steps.length) ? " drop-here" : ""}`} onDragOver={event => offer(event, null, steps.length)} />
  </ol>;
}

/** Settings shared by several selected steps; a blank field means the steps differ. */
export function MultiStepInspector({ steps, onApplyLimits, onAlign, onDuplicate, onDelete }: {
  steps: AutoStep[];
  onApplyLimits: (limits: Partial<LegConstraints>) => void;
  /** Lines the selected points up with the last selected point. */
  onAlign: (axis: "x" | "y") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const drives = steps.filter((step): step is DriveStep => step.type === "drive");
  const shared = (key: keyof LegConstraints) => drives.every(drive => drive[key] === drives[0][key]) ? drives[0][key] : null;
  const limitField = (label: string, key: keyof LegConstraints, unit: string) =>
    <NumberField label={label} unit={unit} allowEmpty placeholder="Mixed" value={shared(key)}
      onChange={value => { if (value !== null) onApplyLimits({ [key]: value }); }} />;
  return <Stack spacing={2}>
    <Typography sx={{ fontWeight: 600 }}>{steps.length} steps selected</Typography>
    {drives.length > 0 && <>
      <Section title={`Motion limits (${drives.length} drive step${drives.length === 1 ? "" : "s"})`}>
        <Stack direction="row" spacing={1}>{limitField("Max velocity", "maxVelocity", "m/s")}{limitField("Max accel", "maxAcceleration", "m/s²")}</Stack>
      </Section>
      <Section title="Finish when">
        <Stack direction="row" spacing={1}>{limitField("Within", "endDistanceTolerance", "m")}{limitField("Slower than", "endVelocityTolerance", "m/s")}</Stack>
      </Section>
      {drives.length > 1 && <Section title="Align" hint="Lines the selected points up with the last one you selected.">
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => onAlign("x")}>Same X</Button>
          <Button size="small" variant="outlined" onClick={() => onAlign("y")}>Same Y</Button>
        </Stack>
      </Section>}
    </>}
    <Stack direction="row" spacing={1}>
      <Button size="small" variant="outlined" onClick={onDuplicate}>Duplicate</Button>
      <Button size="small" color="error" startIcon={<DeleteIcon />} onClick={onDelete}>Delete</Button>
    </Stack>
  </Stack>;
}

/** A titled group of settings; its explanation sits behind an info icon instead of in the panel. */
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return <Stack spacing={1}>
    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>{title}</Typography>
      {hint && <Tooltip title={hint} placement="left"><InfoOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", cursor: "help" }} /></Tooltip>}
    </Stack>
    {children}
  </Stack>;
}

/** How the replay drives a leg; `robotExtraSeconds` is how much longer the robot's drivetrain needs, when it is known. */
/** What the robot's drivetrain can do, under a leg's motion limits; hover for where it comes from. */
function DrivetrainCaption({ drivetrain }: { drivetrain: DrivetrainLimits | null }) {
  if (!drivetrain) return <Typography variant="caption" color="text.secondary">
    No TunerConstants in the robot project, so these aren't checked against the drivetrain.
  </Typography>;
  return <Tooltip placement="left" title={<>
    <div>From TunerConstants: {format(drivetrain.freeSpeed, 2)} m/s free speed, about {format(drivetrain.topSpeed, 1)} m/s with a match battery.
      {drivetrain.maxAcceleration !== null && ` Acceleration from the drive motors' current limit, robot mass and wheel grip.`}</div>
    {drivetrain.notes.map(note => <div key={note} style={{ marginTop: 4 }}>{note}</div>)}
  </>}>
    <Typography variant="caption" color={drivetrain.notes.length ? "warning.main" : "text.secondary"} sx={{ cursor: "help", alignSelf: "flex-start" }}>
      This robot: {describeLimits(drivetrain)}{drivetrain.notes.length ? ` · ${drivetrain.notes.length} thing${drivetrain.notes.length === 1 ? "" : "s"} to check` : ""}
    </Typography>
  </Tooltip>;
}

export type LegReplayInfo = { seconds: number; exitSpeed: number; peakSpeed: number; robotExtraSeconds?: number; finished: boolean };

function StateSelect({ value, states, label = "State", onChange }: { value: string; states: string[]; label?: string; onChange: (state: string) => void }) {
  const options = value && !states.includes(value) ? [...states, value] : states;
  return <TextField select size="small" label={label} value={value} error={!states.includes(value)} fullWidth onChange={event => onChange(event.target.value)}>
    {options.length === 0 && <MenuItem value="" disabled>No states found in StateMachine</MenuItem>}
    {options.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
  </TextField>;
}

/** What the branch inspector shows and changes besides the step itself. */
export type BranchView = {
  /** StateMachine methods a branch can check. */
  checks: string[];
  /** When the replay reaches the branch, and the autonomous period. */
  reachedAt?: number;
  period: number;
  showing: BranchArm;
  onShow: (arm: BranchArm) => void;
  onAddTo: (arm: BranchArm, anchor: HTMLElement) => void;
};

export function StepInspector({ step, driveNumber, states, issues, legInfo, drivetrain, branch, mirrored, points, onChange, onApplyLimitsToAll, onLinkPoint, onSavePoint, onRenamePoint }: {
  step: AutoStep;
  driveNumber: number;
  states: string[];
  issues: AutoIssue[];
  legInfo?: LegReplayInfo;
  /** What the robot's drivetrain can do; null when the project has no TunerConstants, undefined while loading. */
  drivetrain?: DrivetrainLimits | null;
  branch: BranchView;
  mirrored: boolean;
  points: NamedPoint[];
  onChange: (patch: Partial<AutoStep>) => void;
  onApplyLimitsToAll: (limits: LegConstraints) => void;
  /** Links the step's pose to a named point, or unlinks it with null. */
  onLinkPoint: (pointId: string | null) => void;
  /** Saves the step's pose as a new named point and links the step to it. */
  onSavePoint: () => void;
  /** Renames the named point the step is linked to. */
  onRenamePoint: (name: string) => void;
}) {
  const stateField = (step.type === "requestState" || step.type === "waitForState") &&
    <StateSelect value={step.state} states={states} onChange={state => onChange({ state })} />;
  return <Stack spacing={2}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {stepIcons[step.type]}
      <Typography sx={{ fontWeight: 600, flex: 1 }}>{stepTitle(step, driveNumber)}</Typography>
    </Stack>
    {issues.map(issue => <Alert key={issue.message} severity={issue.severity} sx={{ py: 0 }}>{issue.message}</Alert>)}

    {step.type === "drive" && <DriveInspector step={step} isFirstLeg={driveNumber === 1} states={states} legInfo={legInfo} drivetrain={drivetrain} mirrored={mirrored}
      points={points} onChange={onChange} onApplyLimitsToAll={onApplyLimitsToAll} onLinkPoint={onLinkPoint} onSavePoint={onSavePoint} onRenamePoint={onRenamePoint} />}
    {step.type === "requestState" && <Section title="Request" hint="The request stays active during later steps until another request or the end-of-auto clear. Placed right before a move, it is made as that move starts, so the robot keeps moving and the path stays curved.">{stateField}</Section>}
    {step.type === "waitForState" && <>
      <Section title="Wait until" hint="Waits until StateMachine reports this as its actual state.">
        {stateField}
        <NumberField label="Timeout" unit="s" allowEmpty placeholder="None" value={step.timeoutSeconds} onChange={value => onChange({ timeoutSeconds: value })} />
      </Section>
      <Section title="Replay" hint="Only paces the replay. The robot waits for the real state.">
        <NumberField label="Assume it takes" unit="s" value={step.replaySeconds} onChange={value => onChange({ replaySeconds: value ?? 0 })} />
      </Section>
    </>}
    {step.type === "wait" && <Section title="Pause">
      <NumberField label="Duration" unit="s" value={step.seconds} onChange={value => onChange({ seconds: value ?? 0 })} />
    </Section>}
    {step.type === "branch" && <BranchInspector step={step} states={states} view={branch} onChange={onChange} />}
  </Stack>;
}

function BranchInspector({ step, states, view, onChange }: {
  step: BranchStep;
  states: string[];
  view: BranchView;
  onChange: (patch: Partial<BranchStep>) => void;
}) {
  const condition = step.condition;
  const wait = branchWaitSeconds(step);
  const setKind = (kind: BranchCondition["kind"]) => {
    if (kind === condition.kind) return;
    onChange({ condition: kind === "state" ? { kind, state: states[0] ?? "", waitSeconds: wait }
      : kind === "check" ? { kind, method: view.checks[0] ?? "", waitSeconds: wait } : { kind, seconds: 5 } });
  };
  const methods = condition.kind === "check" && condition.method && !view.checks.includes(condition.method) ? [...view.checks, condition.method] : view.checks;
  const left = view.reachedAt === undefined ? undefined : view.period - view.reachedAt;
  return <>
    <Section title="If" hint="Checked when the robot reaches this step. It runs Then or Otherwise, then carries on with the steps after the branch. Wait up to: how long to wait for a yes first; 0 checks once.">
      <TextField select size="small" label="Check" value={condition.kind} fullWidth onChange={event => setKind(event.target.value as BranchCondition["kind"])}>
        <MenuItem value="state">The robot is in a state</MenuItem>
        <MenuItem value="check">A robot check, such as a sensor</MenuItem>
        <MenuItem value="timeLeft">Enough time is left</MenuItem>
      </TextField>
      {condition.kind === "state" && <StateSelect value={condition.state} states={states} onChange={state => onChange({ condition: { ...condition, state } })} />}
      {condition.kind === "check" && (methods.length
        ? <TextField select size="small" label="Robot check" value={condition.method} error={!view.checks.includes(condition.method)} fullWidth
          onChange={event => onChange({ condition: { ...condition, method: event.target.value } })}>
          {methods.map(method => <MenuItem key={method} value={method}>{method}()</MenuItem>)}
        </TextField>
        : <Alert severity="info" sx={{ py: 0 }}>Add a method such as <code>public boolean hasFuel()</code> to StateMachine and it shows up here.</Alert>)}
      {condition.kind === "timeLeft"
        ? <NumberField label="At least" unit="s left" value={condition.seconds} onChange={value => onChange({ condition: { ...condition, seconds: value ?? 0 } })} />
        : <NumberField label="Wait up to" unit="s" value={condition.waitSeconds} onChange={value => onChange({ condition: { ...condition, waitSeconds: value ?? 0 } })} />}
    </Section>
    <Section title="Field and replay show" hint="The field and the replay follow one side at a time; the robot picks its side when it runs. Selecting a step on the other side shows that side.">
      <ToggleButtonGroup size="small" exclusive fullWidth value={view.showing} onChange={(_, arm: BranchArm | null) => arm && view.onShow(arm)}>
        <ToggleButton value="then">Then</ToggleButton>
        <ToggleButton value="otherwise">Otherwise</ToggleButton>
      </ToggleButtonGroup>
      {left !== undefined && <Typography variant="body2" color="text.secondary">
        Replay gets here at {format(view.reachedAt!, 1)} s with {format(left, 1)} s left
        {condition.kind === "timeLeft" && Number.isFinite(condition.seconds) ? `, so the robot would run ${left >= condition.seconds ? "Then" : "Otherwise"}` : ""}.
      </Typography>}
    </Section>
    <Section title="Steps">
      {(["then", "otherwise"] as const).map(arm => <Stack key={arm} direction="row" sx={{ alignItems: "center" }}>
        <Typography variant="body2" sx={{ flex: 1 }}>{armLabels[arm]}: {stepCount(step[arm])}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={event => view.onAddTo(arm, event.currentTarget)}>Add step</Button>
      </Stack>)}
    </Section>
  </>;
}

function DriveInspector({ step, isFirstLeg, states, legInfo, drivetrain, mirrored, points, onChange, onApplyLimitsToAll, onLinkPoint, onSavePoint, onRenamePoint }: {
  step: DriveStep;
  isFirstLeg: boolean;
  states: string[];
  legInfo?: LegReplayInfo;
  drivetrain?: DrivetrainLimits | null;
  mirrored: boolean;
  points: NamedPoint[];
  onChange: (patch: Partial<DriveStep>) => void;
  onApplyLimitsToAll: (limits: LegConstraints) => void;
  onLinkPoint: (pointId: string | null) => void;
  onSavePoint: () => void;
  onRenamePoint: (name: string) => void;
}) {
  const linked = step.pointId ? points.find(point => point.id === step.pointId) : undefined;
  const facing = step.turn.mode === "face" ? step.turn : null;
  const setTurn = (mode: LegTurn["mode"]) => {
    if (mode === step.turn.mode) return;
    if (mode === "now") onChange({ turn: { mode: "now" } });
    else if (mode === "later") onChange({ turn: { mode: "later", startProgress: 0.5 } });
    else {
      // Start the face point two meters ahead of the robot, along its heading.
      const radians = step.heading * Math.PI / 180;
      onChange({ turn: { mode: "face", x: round(step.x + 2 * Math.cos(radians)), y: round(step.y + 2 * Math.sin(radians)), pointId: null } });
    }
  };
  const field = (label: string, key: keyof DriveStep & ("x" | "y" | "heading" | keyof LegConstraints), unit: string) =>
    <NumberField label={label} unit={unit} value={step[key]} onChange={value => onChange({ [key]: value ?? 0 })} />;
  const isDefault = (Object.keys(defaultConstraints) as (keyof LegConstraints)[]).every(key => step[key] === defaultConstraints[key]);
  const updateSubpoint = (id: string, patch: Partial<Subpoint>) =>
    onChange({ subpoints: step.subpoints.map(subpoint => subpoint.id === id ? { ...subpoint, ...patch } : subpoint) });
  return <>
    <Section title="Target pose" hint={`${mirrored ? "Values are for the original auto; the field is showing the mirrored copy." : "Blue-origin field coordinates."} A named point is saved once and reused across autos; moving it moves every step linked to it.`}>
      {linked
        ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <Tooltip title="Moving this step moves the point in every auto that uses it">
            <TextField size="small" label="Named point" value={linked.name} sx={{ flex: 1 }} onChange={event => onRenamePoint(event.target.value)}
              slotProps={{ input: { startAdornment: <PlaceIcon fontSize="small" sx={{ color: "#c084fc", mr: 0.5 }} /> } }} />
          </Tooltip>
          <Button size="small" onClick={() => onLinkPoint(null)}>Unlink</Button>
        </Stack>
        : points.length > 0
          ? <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <TextField select size="small" label="Named point" value="" sx={{ flex: 1 }} onChange={event => onLinkPoint(event.target.value || null)}
              slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}>
              <MenuItem value=""><Typography color="text.secondary" variant="inherit">None</Typography></MenuItem>
              {points.map(point => <MenuItem key={point.id} value={point.id}>{point.name}</MenuItem>)}
            </TextField>
            <Tooltip title="Save this pose as a new named point">
              <IconButton aria-label="Save as named point" onClick={onSavePoint}><AddLocationIcon /></IconButton>
            </Tooltip>
          </Stack>
          : <Button size="small" startIcon={<AddLocationIcon />} onClick={onSavePoint} sx={{ alignSelf: "flex-start" }}>Save as named point</Button>}
      <Stack direction="row" spacing={1}>
        {field("X", "x", "m")}{field("Y", "y", "m")}
        {facing
          ? <Tooltip title="Facing a point sets the heading"><Box sx={{ width: "100%" }}>
            <TextField size="small" label="Heading" value={round(legEndHeading(step), 1)} disabled fullWidth
              slotProps={{ input: { endAdornment: <Typography variant="caption" color="text.secondary">°</Typography> } }} />
          </Box></Tooltip>
          : field("Heading", "heading", "°")}
      </Stack>
    </Section>
    <Section title="Turning" hint="Now: turn toward the heading as the leg starts. Later: keep the starting heading until part of the leg is done, then turn. Face point: keep the front pointed at a spot, such as the hub, the whole leg; drag the crosshair on the field or pick a named point.">
      <ToggleButtonGroup size="small" exclusive fullWidth value={step.turn.mode} onChange={(_, mode) => mode && setTurn(mode)}>
        <ToggleButton value="now">Now</ToggleButton>
        <ToggleButton value="later">Later</ToggleButton>
        <ToggleButton value="face">Face point</ToggleButton>
      </ToggleButtonGroup>
      {step.turn.mode === "later" && <NumberField label="Start turning at" unit="% of leg" value={round(step.turn.startProgress * 100, 1)}
        onChange={value => onChange({ turn: { mode: "later", startProgress: (value ?? 0) / 100 } })} />}
      {facing && points.length > 0 && <TextField select size="small" label="Face" value={facing.pointId ?? ""} fullWidth
          slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
          onChange={event => {
            const point = points.find(candidate => candidate.id === event.target.value);
            onChange({ turn: point ? { mode: "face", x: point.x, y: point.y, pointId: point.id } : { ...facing, pointId: null } });
          }}>
          <MenuItem value="">A spot on the field</MenuItem>
          {points.map(point => <MenuItem key={point.id} value={point.id}>{point.name}</MenuItem>)}
        </TextField>}
      {facing && <Stack direction="row" spacing={1}>
        <NumberField label="X" unit="m" value={facing.x} onChange={value => onChange({ turn: { ...facing, x: value ?? 0, pointId: null } })} />
        <NumberField label="Y" unit="m" value={facing.y} onChange={value => onChange({ turn: { ...facing, y: value ?? 0, pointId: null } })} />
      </Stack>}
      <NumberField label="Max turn rate" unit="°/s" allowEmpty placeholder={`Robot default (${defaultTurnRate})`} value={step.maxTurnRate}
        onChange={value => onChange({ maxTurnRate: value })} />
    </Section>
    <Section title="Motion limits">
      <Stack direction="row" spacing={1}>{field("Max velocity", "maxVelocity", "m/s")}{field("Max accel", "maxAcceleration", "m/s²")}</Stack>
      {drivetrain !== undefined && <DrivetrainCaption drivetrain={drivetrain} />}
    </Section>
    <Section title="Finish when" hint="The leg ends once the robot is inside both. Loosen them to round this point without stopping; tighten them to stop precisely.">
      <Stack direction="row" spacing={1}>{field("Within", "endDistanceTolerance", "m")}{field("Slower than", "endVelocityTolerance", "m/s")}</Stack>
    </Section>
    <Section title="During this move" hint={step.subpoints.length === 0 ? undefined : isFirstLeg
      ? "Requests a state partway along the leg, or when the leg ends if it finishes first. The first leg starts wherever the robot is placed; the replay starts at point 1, so these run at once there."
      : "Requests a state partway along the leg, or when the leg ends if it finishes first. Drag the diamonds on the field to move them."}>
      {step.subpoints.map(subpoint => <Stack key={subpoint.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <StateSelect value={subpoint.state} states={states} label="Request" onChange={state => updateSubpoint(subpoint.id, { state })} />
        <Box sx={{ width: 110, flexShrink: 0 }}>
          <NumberField label="At" unit="%" value={round(subpoint.progress * 100, 1)}
            error={!(subpoint.progress >= 0 && subpoint.progress <= 1)}
            onChange={value => updateSubpoint(subpoint.id, { progress: (value ?? 0) / 100 })} />
        </Box>
        <IconButton size="small" aria-label="Remove state change" onClick={() => onChange({ subpoints: step.subpoints.filter(candidate => candidate.id !== subpoint.id) })}>
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Stack>)}
      <Button size="small" startIcon={<AddIcon />} sx={{ alignSelf: "flex-start" }} disabled={states.length === 0}
        onClick={() => onChange({ subpoints: [...step.subpoints, { id: createId(), progress: 0.5, state: states[0] ?? "" }] })}>
        Add state change
      </Button>
    </Section>
    {legInfo && <Typography variant="body2" color={legInfo.finished ? "text.secondary" : "error"}>
      {legInfo.finished
        ? `Replay: ${format(legInfo.seconds)} s${(legInfo.robotExtraSeconds ?? 0) >= 0.05 ? ` (about ${format(legInfo.seconds + (legInfo.robotExtraSeconds ?? 0))} s on the robot)` : ""}, `
          + `peaks at ${format(legInfo.peakSpeed, 1)} m/s, leaves at ${format(legInfo.exitSpeed, 1)} m/s`
        : "Replay: this leg never reaches its finish tolerances. Loosen them or slow down."}
    </Typography>}
    <Stack direction="row" spacing={1}>
      <Tooltip title="Copy these motion limits and finish tolerances to every drive step in this auto">
        <Button size="small" variant="outlined" onClick={() => onApplyLimitsToAll(legConstraints(step))}>Use for all legs</Button>
      </Tooltip>
      <Button size="small" disabled={isDefault} onClick={() => onChange({ ...defaultConstraints })}>Reset limits</Button>
    </Stack>
  </>;
}

