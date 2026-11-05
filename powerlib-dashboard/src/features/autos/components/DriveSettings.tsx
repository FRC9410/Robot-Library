import { Button, Tooltip } from "@mui/material";
import type { DriveStep, LegConstraints, NamedPoint } from "../autoModel";
import { constraintKeys, defaultConstraints, legConstraints } from "../autoModel";
import type { DrivetrainLimits } from "../autoLimits";
import type { LegReplayInfo } from "../types";
import { DrivetrainCaption } from "./DrivetrainCaption";
import { FieldRow } from "./FieldRow";
import { LegLimitFields } from "./LegLimitFields";
import { LegReplaySummary } from "./LegReplaySummary";
import { SettingsSection } from "./SettingsSection";
import { SubpointsSection } from "./SubpointsSection";
import { TargetPoseSection } from "./TargetPoseSection";
import { TurningSection } from "./TurningSection";

type DriveSettingsProps = {
  step: DriveStep;
  isFirstLeg: boolean;
  states: string[];
  legInfo?: LegReplayInfo;
  /** What the robot's drivetrain can do; null when the project has no TunerConstants, undefined while loading. */
  drivetrain?: DrivetrainLimits | null;
  mirrored: boolean;
  points: NamedPoint[];
  onChange: (patch: Partial<DriveStep>) => void;
  onApplyLimitsToAll: (limits: LegConstraints) => void;
  onLinkPoint: (pointId: string | null) => void;
  onSavePoint: () => void;
  onRenamePoint: (name: string) => void;
};

/** A drive leg's settings: target pose, turning, limits, finish tolerances and states requested along the way. */
export function DriveSettings({ step, isFirstLeg, states, legInfo, drivetrain, mirrored, points, onChange, onApplyLimitsToAll,
  onLinkPoint, onSavePoint, onRenamePoint }: DriveSettingsProps) {
  const isDefault = constraintKeys.every(key => step[key] === defaultConstraints[key]);
  const setLimit = (key: keyof LegConstraints, value: number) => onChange({ [key]: value });
  return <>
    <TargetPoseSection step={step} mirrored={mirrored} points={points} onChange={onChange}
      onLinkPoint={onLinkPoint} onSavePoint={onSavePoint} onRenamePoint={onRenamePoint} />
    <TurningSection step={step} points={points} onChange={onChange} />
    <SettingsSection title="Motion limits">
      <LegLimitFields keys={["maxVelocity", "maxAcceleration"]} value={key => step[key]} onChange={setLimit} />
      {drivetrain !== undefined && <DrivetrainCaption drivetrain={drivetrain} />}
    </SettingsSection>
    <SettingsSection title="Finish when" hint="The leg ends once the robot is inside both. Loosen them to round this point without stopping; tighten them to stop precisely.">
      <LegLimitFields keys={["endDistanceTolerance", "endVelocityTolerance"]} value={key => step[key]} onChange={setLimit} />
    </SettingsSection>
    <SubpointsSection step={step} isFirstLeg={isFirstLeg} states={states} onChange={subpoints => onChange({ subpoints })} />
    {legInfo && <LegReplaySummary info={legInfo} />}
    <FieldRow>
      <Tooltip title="Copy these motion limits and finish tolerances to every drive step in this auto">
        <Button size="small" variant="outlined" onClick={() => onApplyLimitsToAll(legConstraints(step))}>Use for all legs</Button>
      </Tooltip>
      <Button size="small" disabled={isDefault} onClick={() => onChange({ ...defaultConstraints })}>Reset limits</Button>
    </FieldRow>
  </>;
}
