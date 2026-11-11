import { LinearProgress, Stack, Typography } from "@mui/material";
import type { ManualStep } from "./runCharacterization";

type CharacterizationManualStepProps = { step: ManualStep; station: string };

export function CharacterizationManualStep({ step, station }: CharacterizationManualStepProps) {
  const instruction = {
    arm: "Keep the robot disabled. Reposition the robot or mechanism if needed, then arm this test.",
    prepare: "Keep the robot disabled while Power Tool prepares the test.",
    enable: `Test armed. Enable in Test mode using ${station} within 30 seconds.`,
    running: `Test running. Disable in ${station} to stop early and end the walkthrough.`,
    disable: `Test finished. Disable the robot in ${station} to continue.`,
    collect: "Robot disabled. Collecting the log and waiting for the mechanism to settle.",
    cancel: `Disable the robot in ${station} to finish stopping the walkthrough.`
  }[step.state];

  return (
    <Stack spacing={1.5} sx={{ py: 2 }}>
      <Typography variant="overline">Test {step.number} of {step.total}</Typography>
      <Typography variant="h6">{step.label}</Typography>
      <LinearProgress variant="determinate" value={(step.number - (step.state === "collect" ? 0 : 1)) / step.total * 100}
        aria-label="Characterization walkthrough progress" />
      <Typography role="status">{step.detail && step.detail + " "}{instruction}</Typography>
    </Stack>
  );
}
