import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack } from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import type { ConnectionState } from "../../../types/app";
import type { CharacterizationCommand } from "../types";

type CharacterizationDialogProps = {
  open: boolean;
  subsystemName?: string;
  status: ConnectionState;
  commands: CharacterizationCommand[];
  onRunCommand: (command: CharacterizationCommand) => void;
  onClose: () => void;
};

export function CharacterizationDialog({
  open,
  subsystemName,
  status,
  commands,
  onRunCommand,
  onClose
}: CharacterizationDialogProps) {
  return (
    <Dialog open={open} maxWidth="sm" fullWidth>
      <DialogTitle>Characterization{subsystemName ? `: ${subsystemName}` : ""}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {status !== "connected" && (
            <Alert severity="warning" variant="outlined">
              Connect to NetworkTables to run characterization commands.
            </Alert>
          )}
          {status === "connected" && commands.length === 0 && (
            <Alert severity="info" variant="outlined">
              No characterization commands found yet. Make sure robot code is running and code was updated after creating
              this velocity subsystem.
            </Alert>
          )}
          <Box
            sx={{
              display: "grid",
              gap: 1.25,
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" }
            }}
          >
            {commands.map((command) => (
              <Button
                key={command.baseTopic}
                startIcon={<PlayArrowIcon />}
                variant="contained"
                onClick={() => onRunCommand(command)}
                disabled={status !== "connected" || command.running}
                sx={{
                  justifyContent: "flex-start",
                  minHeight: 48,
                  px: 2,
                  textAlign: "left",
                  width: "100%"
                }}
              >
                {command.running ? `${command.label} running` : command.label}
              </Button>
            ))}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
