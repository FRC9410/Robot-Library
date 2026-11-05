import type { ReactNode } from "react";
import { Alert, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import type { AutoIssue, AutoStep } from "../autoModel";
import { stepTitle } from "../stepText";
import { StepIcon } from "./StepIcon";
import { TooltipIconButton } from "./TooltipIconButton";

type StepInspectorProps = {
  step: AutoStep;
  driveNumber: number;
  issues: AutoIssue[];
  /** Clears the selection, giving the step list its room back. */
  onClose: () => void;
  /** The step's settings. */
  children: ReactNode;
};

/** The selected step: its title, its problems, then its settings. */
export function StepInspector({ step, driveNumber, issues, onClose, children }: StepInspectorProps) {
  return <Stack spacing={2}>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <StepIcon type={step.type} />
      <Typography sx={{ fontWeight: 600, flex: 1 }}>{stepTitle(step, driveNumber)}</Typography>
      <TooltipIconButton title="Close (Esc)" label="Close step settings" onClick={onClose}><CloseIcon fontSize="small" /></TooltipIconButton>
    </Stack>
    {issues.map(issue => <Alert key={issue.message} severity={issue.severity} sx={{ py: 0 }}>{issue.message}</Alert>)}
    {children}
  </Stack>;
}
