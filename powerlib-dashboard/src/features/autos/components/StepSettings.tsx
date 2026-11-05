import type { AutoStep, LegConstraints, NamedPoint } from "../autoModel";
import type { DrivetrainLimits } from "../autoLimits";
import type { BranchView, LegReplayInfo } from "../types";
import { BranchSettings } from "./BranchSettings";
import { DriveSettings } from "./DriveSettings";
import { RequestStateSettings } from "./RequestStateSettings";
import { WaitForStateSettings } from "./WaitForStateSettings";
import { WaitSettings } from "./WaitSettings";

type StepSettingsProps = {
  step: AutoStep;
  driveNumber: number;
  states: string[];
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
};

/** The settings for one step, by its kind. */
export function StepSettings({ step, driveNumber, states, legInfo, drivetrain, branch, mirrored, points, onChange, onApplyLimitsToAll,
  onLinkPoint, onSavePoint, onRenamePoint }: StepSettingsProps) {
  switch (step.type) {
    case "drive": return <DriveSettings step={step} isFirstLeg={driveNumber === 1} states={states} legInfo={legInfo} drivetrain={drivetrain}
      mirrored={mirrored} points={points} onChange={onChange} onApplyLimitsToAll={onApplyLimitsToAll}
      onLinkPoint={onLinkPoint} onSavePoint={onSavePoint} onRenamePoint={onRenamePoint} />;
    case "requestState": return <RequestStateSettings step={step} states={states} onChange={onChange} />;
    case "waitForState": return <WaitForStateSettings step={step} states={states} onChange={onChange} />;
    case "wait": return <WaitSettings step={step} onChange={onChange} />;
    case "branch": return <BranchSettings step={step} states={states} view={branch} onChange={onChange} />;
  }
}
