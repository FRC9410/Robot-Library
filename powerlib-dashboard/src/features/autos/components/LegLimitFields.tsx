import type { LegConstraints } from "../autoModel";
import { FieldRow } from "./FieldRow";
import { NumberField } from "./NumberField";

type LimitKey = keyof LegConstraints;

const limitLabels: Record<LimitKey, { label: string; unit: string }> = {
  maxVelocity: { label: "Max velocity", unit: "m/s" },
  maxAcceleration: { label: "Max accel", unit: "m/s²" },
  endDistanceTolerance: { label: "Within", unit: "m" },
  endVelocityTolerance: { label: "Slower than", unit: "m/s" }
};

type LegLimitFieldsProps = {
  keys: LimitKey[];
  /** The value for each key; null shows "Mixed" when several steps differ. */
  value: (key: LimitKey) => number | null;
  /** Several steps at once: a blank field means they differ, and stays blank until a value is typed. */
  mixed?: boolean;
  onChange: (key: LimitKey, value: number) => void;
};

/** A drive leg's motion limits or finish tolerances, side by side. */
export function LegLimitFields({ keys, value, mixed = false, onChange }: LegLimitFieldsProps) {
  return <FieldRow>
    {keys.map(key => <NumberField key={key} label={limitLabels[key].label} unit={limitLabels[key].unit} value={value(key)}
      allowEmpty={mixed} placeholder={mixed ? "Mixed" : undefined}
      onChange={next => { if (next !== null) onChange(key, next); }} />)}
  </FieldRow>;
}
