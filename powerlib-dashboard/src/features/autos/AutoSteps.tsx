import { useEffect, useRef, useState } from "react";
import type { ReactElement, ReactNode } from "react";
import { Alert, Box, Button, IconButton, MenuItem, Stack, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import FlagIcon from "@mui/icons-material/Flag";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import RouteIcon from "@mui/icons-material/Route";
import type { AutoIssue, AutoStep, AutoStepType, DriveStep, LegConstraints, Subpoint } from "./autoModel";
import { createId, defaultConstraints, legConstraints, orderedSubpoints, round } from "./autoModel";

export const stepIcons: Record<AutoStepType, ReactElement> = {
  drive: <RouteIcon fontSize="small" />,
  requestState: <FlagIcon fontSize="small" />,
  waitForState: <PlaylistAddCheckIcon fontSize="small" />,
  wait: <HourglassEmptyIcon fontSize="small" />
};

export const stepDescriptions: Record<AutoStepType, string> = {
  drive: "Drive to a pose with this leg's speed and finish limits",
  requestState: "Ask the state machine for a state and continue immediately",
  waitForState: "Pause until the state machine reports a state",
  wait: "Pause for a fixed time"
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
    slotProps={{ input: { endAdornment: unit ? <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{unit}</Typography> : undefined } }}
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
  }
}

function stepSummary(step: AutoStep) {
  switch (step.type) {
    case "drive": {
      const subpoints = orderedSubpoints(step).map(subpoint => `${subpoint.state || "?"} at ${format(subpoint.progress * 100, 0)}%`);
      return subpoints.length
        ? `${format(step.maxVelocity, 1)} m/s · ${subpoints.join(", ")}`
        : `(${format(step.x)}, ${format(step.y)}) · ${format(step.heading, 0)}° · ${format(step.maxVelocity, 1)} m/s`;
    }
    case "requestState": return "Continues immediately";
    case "waitForState": return step.timeoutSeconds === null ? "No timeout" : `Timeout ${format(step.timeoutSeconds)} s`;
    case "wait": return "Fixed pause";
  }
}

export function StepList({ steps, selectedStepIds, activeStepId, durations, issues, stateColor, onSelect, onReorder, onDelete }: {
  steps: AutoStep[];
  selectedStepIds: string[];
  activeStepId: string | null;
  durations: Map<string, number>;
  issues: AutoIssue[];
  stateColor: (state: string | null) => string;
  /** `toggle` adds or removes the step from the selection (Shift- or Ctrl-click). */
  onSelect: (stepId: string, toggle: boolean) => void;
  /** Moves the steps so they sit before the step now at `beforeIndex` (steps.length for the end). */
  onReorder: (stepIds: string[], beforeIndex: number) => void;
  onDelete: (stepId: string) => void;
}) {
  const listRef = useRef<HTMLOListElement>(null);
  // Dragging a selected step carries the whole selection; the drop line shows where it lands.
  const dragging = useRef<string[] | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const endDrag = () => { dragging.current = null; setDropIndex(null); };
  const primary = selectedStepIds[selectedStepIds.length - 1];
  // Keep the most recently selected step visible when it is picked on the field.
  useEffect(() => {
    listRef.current?.querySelector(`[data-step-id="${primary}"]`)?.scrollIntoView({ block: "nearest" });
  }, [primary]);
  let driveNumber = 0;
  return <ol className="ab-steps" ref={listRef} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDropIndex(null); }}>
    {steps.map((step, index) => {
      if (step.type === "drive") driveNumber++;
      const stepIssues = issues.filter(issue => issue.stepId === step.id);
      const severity = stepIssues.some(issue => issue.severity === "error") ? "error" : stepIssues.length ? "warning" : null;
      const accent = step.type === "requestState" || step.type === "waitForState" ? stateColor(step.state) : undefined;
      const duration = durations.get(step.id);
      return <li key={step.id} data-step-id={step.id}
        className={`ab-step${selectedStepIds.includes(step.id) ? " selected" : ""}${step.id === activeStepId ? " active" : ""}${severity ? ` ${severity}` : ""}${dropIndex === index ? " drop-above" : ""}${dropIndex === steps.length && index === steps.length - 1 ? " drop-below" : ""}`}
        draggable
        onDragStart={event => {
          dragging.current = selectedStepIds.includes(step.id) ? selectedStepIds : [step.id];
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", dragging.current.join(","));
        }}
        onDragOver={event => {
          if (!dragging.current) return;
          event.preventDefault();
          const box = event.currentTarget.getBoundingClientRect();
          setDropIndex(index + (event.clientY < box.top + box.height / 2 ? 0 : 1));
        }}
        onDrop={event => {
          event.preventDefault();
          if (dragging.current && dropIndex !== null) onReorder(dragging.current, dropIndex);
          endDrag();
        }}
        onDragEnd={endDrag}
        style={accent ? { borderLeftColor: accent } : undefined}
        onClick={event => onSelect(step.id, event.shiftKey || event.ctrlKey || event.metaKey)}>
        <span className="ab-step-index">{index + 1}</span>
        <span className="ab-step-icon" style={accent ? { color: accent } : undefined}>{stepIcons[step.type]}</span>
        <span className="ab-step-text">
          <span className="ab-step-title">{stepTitle(step, driveNumber)}</span>
          <span className="ab-step-summary">{severity ? stepIssues[0].message : stepSummary(step)}</span>
        </span>
        {duration !== undefined && <span className="ab-step-time">{format(duration, 1)} s</span>}
        <span className="ab-step-actions" onClick={event => event.stopPropagation()}>
          <IconButton size="small" aria-label="Delete step" onClick={() => onDelete(step.id)}><DeleteIcon fontSize="inherit" /></IconButton>
        </span>
      </li>;
    })}
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

export type LegReplayInfo = { seconds: number; exitSpeed: number; finished: boolean };

function StateSelect({ value, states, label = "State", onChange }: { value: string; states: string[]; label?: string; onChange: (state: string) => void }) {
  const options = value && !states.includes(value) ? [...states, value] : states;
  return <TextField select size="small" label={label} value={value} error={!states.includes(value)} fullWidth onChange={event => onChange(event.target.value)}>
    {options.length === 0 && <MenuItem value="" disabled>No states found in StateMachine</MenuItem>}
    {options.map(state => <MenuItem key={state} value={state}>{state}</MenuItem>)}
  </TextField>;
}

export function StepInspector({ step, driveNumber, states, issues, legInfo, mirrored, onChange, onApplyLimitsToAll }: {
  step: AutoStep;
  driveNumber: number;
  states: string[];
  issues: AutoIssue[];
  legInfo?: LegReplayInfo;
  mirrored: boolean;
  onChange: (patch: Partial<AutoStep>) => void;
  onApplyLimitsToAll: (limits: LegConstraints) => void;
}) {
  const stateField = (step.type === "requestState" || step.type === "waitForState") &&
    <StateSelect value={step.state} states={states} onChange={state => onChange({ state })} />;
  return <Stack spacing={2}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      {stepIcons[step.type]}
      <Typography sx={{ fontWeight: 600, flex: 1 }}>{stepTitle(step, driveNumber)}</Typography>
    </Stack>
    {issues.map(issue => <Alert key={issue.message} severity={issue.severity} sx={{ py: 0 }}>{issue.message}</Alert>)}

    {step.type === "drive" && <DriveInspector step={step} isFirstLeg={driveNumber === 1} states={states} legInfo={legInfo} mirrored={mirrored}
      onChange={onChange} onApplyLimitsToAll={onApplyLimitsToAll} />}
    {step.type === "requestState" && <Section title="Request" hint="The request stays active during later steps until another request or the end-of-auto clear.">{stateField}</Section>}
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
  </Stack>;
}

function DriveInspector({ step, isFirstLeg, states, legInfo, mirrored, onChange, onApplyLimitsToAll }: {
  step: DriveStep;
  isFirstLeg: boolean;
  states: string[];
  legInfo?: LegReplayInfo;
  mirrored: boolean;
  onChange: (patch: Partial<DriveStep>) => void;
  onApplyLimitsToAll: (limits: LegConstraints) => void;
}) {
  const field = (label: string, key: keyof DriveStep & ("x" | "y" | "heading" | keyof LegConstraints), unit: string) =>
    <NumberField label={label} unit={unit} value={step[key]} onChange={value => onChange({ [key]: value ?? 0 })} />;
  const isDefault = (Object.keys(defaultConstraints) as (keyof LegConstraints)[]).every(key => step[key] === defaultConstraints[key]);
  const updateSubpoint = (id: string, patch: Partial<Subpoint>) =>
    onChange({ subpoints: step.subpoints.map(subpoint => subpoint.id === id ? { ...subpoint, ...patch } : subpoint) });
  return <>
    <Section title="Target pose" hint={mirrored ? "Values are for the original auto; the field is showing the mirrored copy." : "Blue-origin field coordinates."}>
      <Stack direction="row" spacing={1}>{field("X", "x", "m")}{field("Y", "y", "m")}{field("Heading", "heading", "°")}</Stack>
    </Section>
    <Section title="Motion limits">
      <Stack direction="row" spacing={1}>{field("Max velocity", "maxVelocity", "m/s")}{field("Max accel", "maxAcceleration", "m/s²")}</Stack>
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
        ? `Replay: ${format(legInfo.seconds)} s, leaves at ${format(legInfo.exitSpeed, 1)} m/s`
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

