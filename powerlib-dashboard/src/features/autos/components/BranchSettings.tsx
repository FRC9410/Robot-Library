import { Button, Stack, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { BranchArm, BranchStep } from "../autoModel";
import { armLabels, format, stepCount } from "../stepText";
import type { BranchView } from "../types";
import { BranchConditionSection } from "./BranchConditionSection";
import { SettingsSection } from "./SettingsSection";

type BranchSettingsProps = {
  step: BranchStep;
  states: string[];
  view: BranchView;
  onChange: (patch: Partial<BranchStep>) => void;
};

/** A branch's condition, which side the field shows, and its two sides' steps. */
export function BranchSettings({ step, states, view, onChange }: BranchSettingsProps) {
  const condition = step.condition;
  const left = view.reachedAt === undefined ? undefined : view.period - view.reachedAt;
  return <>
    <BranchConditionSection step={step} states={states} checks={view.checks} onChange={next => onChange({ condition: next })} />
    <SettingsSection title="Field and replay show" hint={"The field and the replay follow one side at a time; the robot picks its side when it runs. "
      + "Selecting a step on the other side shows that side."}>
      <ToggleButtonGroup size="small" exclusive fullWidth value={view.showing} onChange={(_, arm: BranchArm | null) => arm && view.onShow(arm)}>
        <ToggleButton value="then">Then</ToggleButton>
        <ToggleButton value="otherwise">Otherwise</ToggleButton>
      </ToggleButtonGroup>
      {left !== undefined && <Typography variant="body2" color="text.secondary">
        Replay gets here at {format(view.reachedAt!, 1)} s with {format(left, 1)} s left
        {condition.kind === "timeLeft" && Number.isFinite(condition.seconds) ? `, so the robot would run ${left >= condition.seconds ? "Then" : "Otherwise"}` : ""}.
      </Typography>}
    </SettingsSection>
    <SettingsSection title="Steps">
      {(["then", "otherwise"] as const).map(arm => <Stack key={arm} direction="row" sx={{ alignItems: "center" }}>
        <Typography variant="body2" sx={{ flex: 1 }}>{armLabels[arm]}: {stepCount(step[arm])}</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={event => view.onAddTo(arm, event.currentTarget)}>Add step</Button>
      </Stack>)}
    </SettingsSection>
  </>;
}
