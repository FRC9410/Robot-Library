import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { DriveStep, LegTurn, NamedPoint } from "../autoModel";
import { defaultTurnRate, round } from "../autoModel";
import { turnWithMode } from "../autoEdits";
import { FieldRow } from "./FieldRow";
import { NamedPointSelect } from "./NamedPointSelect";
import { NumberField } from "./NumberField";
import { SettingsSection } from "./SettingsSection";

type TurningSectionProps = {
  step: DriveStep;
  points: NamedPoint[];
  onChange: (patch: Partial<DriveStep>) => void;
};

/** How a leg turns: now, later in the leg, or facing a point the whole way; and how fast. */
export function TurningSection({ step, points, onChange }: TurningSectionProps) {
  const facing = step.turn.mode === "face" ? step.turn : null;
  const setTurn = (turn: LegTurn) => onChange({ turn });
  return <SettingsSection title="Turning" hint={"Now: turn toward the heading as the leg starts. Later: keep the starting heading until part of the leg is done, "
    + "then turn. Face point: keep the front pointed at a spot, such as the hub, the whole leg; drag the crosshair on the field or pick a named point."}>
    <ToggleButtonGroup size="small" exclusive fullWidth value={step.turn.mode}
      onChange={(_, mode: LegTurn["mode"] | null) => { if (mode && mode !== step.turn.mode) setTurn(turnWithMode(step, mode)); }}>
      <ToggleButton value="now">Now</ToggleButton>
      <ToggleButton value="later">Later</ToggleButton>
      <ToggleButton value="face">Face point</ToggleButton>
    </ToggleButtonGroup>
    {step.turn.mode === "later" && <NumberField label="Start turning at" unit="% of leg" value={round(step.turn.startProgress * 100, 1)}
      onChange={value => setTurn({ mode: "later", startProgress: (value ?? 0) / 100 })} />}
    {facing && points.length > 0 && <NamedPointSelect label="Face" value={facing.pointId} points={points} emptyLabel="A spot on the field"
      onChange={pointId => {
        const point = points.find(candidate => candidate.id === pointId);
        setTurn(point ? { mode: "face", x: point.x, y: point.y, pointId: point.id } : { ...facing, pointId: null });
      }} />}
    {facing && <FieldRow>
      <NumberField label="X" unit="m" value={facing.x} onChange={value => setTurn({ ...facing, x: value ?? 0, pointId: null })} />
      <NumberField label="Y" unit="m" value={facing.y} onChange={value => setTurn({ ...facing, y: value ?? 0, pointId: null })} />
    </FieldRow>}
    <NumberField label="Max turn rate" unit="°/s" allowEmpty placeholder={`Robot default (${defaultTurnRate})`} value={step.maxTurnRate}
      onChange={value => onChange({ maxTurnRate: value })} />
  </SettingsSection>;
}
