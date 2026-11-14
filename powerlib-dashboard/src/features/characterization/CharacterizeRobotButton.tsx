import { useEffect, useState } from "react";
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import type { GeneratedSubsystem } from "../subsystems/types";
import { CharacterizationDialog } from "./CharacterizationDialog";

type CharacterizeRobotButtonProps = { subsystems: GeneratedSubsystem[]; openOnStartup?: boolean };

export function CharacterizeRobotButton({ subsystems, openOnStartup }: CharacterizeRobotButtonProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function openCharacterization() {
    const access = window.powerlib?.hasCharacterizationAccess;
    try {
      setError("");
      if (access && await access()) setOpen(true);
      else setPrompt(true);
    } catch {
      setError("Power Tool could not check administrator access.");
      setPrompt(true);
    }
  }

  useEffect(() => {
    if (openOnStartup) void openCharacterization();
  }, [openOnStartup]);

  async function restart() {
    const launch = window.powerlib?.restartForCharacterization;
    if (!launch) return;
    setBusy(true);
    setError("");
    try {
      if (!await launch()) setError("Administrator restart canceled.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outlined" startIcon={<ScienceOutlinedIcon />} onClick={() => void openCharacterization()}>Characterize Robot</Button>
      <Dialog open={prompt} aria-labelledby="characterization-admin-title">
        <DialogTitle id="characterization-admin-title">Restart Power Tool as administrator?</DialogTitle>
        <DialogContent>
          <DialogContentText>Characterization requires administrator access. Approve the Windows prompt to reopen Power Tool here.</DialogContentText>
          {error && <Alert severity="error">{error}</Alert>}
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setPrompt(false)}>Cancel</Button>
          <Button variant="contained" disabled={busy || !window.powerlib?.restartForCharacterization} onClick={() => void restart()}>
            Restart as administrator
          </Button>
        </DialogActions>
      </Dialog>
      {open && <CharacterizationDialog open onClose={() => setOpen(false)} subsystems={subsystems} />}
    </>
  );
}
