import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, Typography } from "@mui/material";
import type { GeneratedSubsystem } from "../subsystems/types";
import { useCharacterization } from "./useCharacterization";
import { CharacterizationSetup } from "./CharacterizationSetup";
import { CharacterizationResults } from "./CharacterizationResults";
import { CharacterizationManualStep } from "./CharacterizationManualStep";
import { validSettings } from "../../../electron/characterization/limits";

type CharacterizationDialogProps = { open: boolean; onClose: () => void; subsystems: GeneratedSubsystem[] };

export function CharacterizationDialog({ open, onClose, subsystems }: CharacterizationDialogProps) {
  const run = useCharacterization(subsystems);
  const drivetrain = run.subsystemType === "drivetrain";
  const station = run.controlMode === "simulation" ? "the WPILib Simulation GUI" : "FRC Driver Station";
  const { error } = run;
  const valid = validSettings(run.settings, run.picked);
  const robotReady = run.connected && run.robot && run.controlMode && !run.robot.enabled && !run.robot.fms && !run.robot.estop
    && (run.controlMode !== "driver-station" || run.robot.test);
  const canStart = robotReady && run.ready && run.picked.length > 0 && run.supported && valid;
  const canArm = run.subsystemType === "positionCrawl" ? robotReady && run.robot?.positionSysId === true : canStart;
  const control = run.controlMode === "driver-station" ? `FRC Driver Station${run.robot?.simulation ? " (simulation)" : ""}`
    : run.controlMode === "simulation" ? "Internal simulation" : "Unavailable";
  const errorNotice = error && (
    <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void navigator.clipboard.writeText(error)}>Copy details</Button>}>
      <Typography variant="body2" title={error} sx={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: 3, overflow: "hidden", overflowWrap: "anywhere" }}>
        {error}
      </Typography>
    </Alert>
  );

  function close() {
    if (run.busy) return;
    run.reset();
    onClose();
  }

  return (
    <Dialog open={open} onClose={close} maxWidth="lg" fullWidth aria-labelledby="characterization-title"
      slotProps={{ paper: { sx: { m: 2, width: "calc(100% - 32px)", maxHeight: "calc(100% - 32px)" } } }}>
      <DialogTitle id="characterization-title" sx={{ py: 1.5 }}>Characterize Robot</DialogTitle>
      <DialogContent dividers sx={{ py: 1.5, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <Stack spacing={1.5} sx={{ minHeight: 0 }}>
          {run.busy && run.manualStep ? <CharacterizationManualStep step={run.manualStep} station={station} /> : run.busy ? (
            <Stack spacing={2} sx={{ py: 2 }}>
              <Typography variant="h6">Characterization running</Typography>
              <Typography variant="body2">Enable/disable control: {control}</Typography>
              <LinearProgress aria-label="Characterization progress" />
              <Typography role="status">{run.progress || "Preparing characterization…"}</Typography>
            </Stack>
          ) : run.report ? (
            <>
              <Typography variant="h6" role="status">{run.progress}</Typography>
              <CharacterizationResults report={run.report} />
            </>
          ) : (
            <CharacterizationSetup run={run} control={drivetrain ? "Drive manual · Steering automatic" : control} errorNotice={errorNotice} drivetrain={drivetrain} />
          )}
          {(run.report || run.busy) && errorNotice}
        </Stack>
      </DialogContent>
      <DialogActions>
        {run.busy ? (
          <>
            <Button color="error" variant="outlined" onClick={run.stop}>Stop characterization</Button>
            {run.manualStep?.state === "arm" && <Button variant="contained" onClick={run.arm} disabled={!canArm}>Arm test</Button>}
          </>
        ) : (
          <>
            <Button onClick={close}>Close</Button>
            {run.report
              ? <Button variant="contained" onClick={run.prepareNextRun}>Run again</Button>
              : run.subsystemType !== "positionCrawl" && <Button variant="contained" onClick={() => void run.start()} disabled={!canStart}>{run.manualDrive ? "Start walkthrough" : "Start characterization"}</Button>}
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}
