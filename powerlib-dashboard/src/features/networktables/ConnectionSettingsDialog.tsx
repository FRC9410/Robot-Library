import { useEffect, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField
} from "@mui/material";
import type { ConnectionSettings } from "./NetworkTablesContext";

type TargetPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
};

const targetPresets: TargetPreset[] = [
  { id: "sim-localhost", label: "Local simulation", host: "localhost", port: 5810 },
  { id: "sim-loopback", label: "Loopback", host: "127.0.0.1", port: 5810 },
  { id: "robot-ip", label: "Robot radio / roboRIO IP", host: "10.94.10.2", port: 5810 },
  { id: "robot-mdns", label: "roboRIO mDNS", host: "roborio-9410-frc.local", port: 5810 },
  { id: "driver-station", label: "Driver Station laptop", host: "10.94.10.5", port: 5810 },
  { id: "custom", label: "Custom", host: "", port: 5810 }
];

type ConnectionSettingsDialogProps = {
  open: boolean;
  settings: ConnectionSettings;
  onClose: () => void;
  onSave: (settings: ConnectionSettings) => void;
};

export function ConnectionSettingsDialog({ open, settings, onClose, onSave }: ConnectionSettingsDialogProps) {
  const [draft, setDraft] = useState(settings);

  useEffect(() => {
    if (open) {
      setDraft(settings);
    }
  }, [open, settings]);

  function setPreset(id: string) {
    const preset = targetPresets.find((item) => item.id === id);
    if (preset && preset.id !== "custom") {
      setDraft({
        targetId: preset.id,
        host: preset.host,
        port: preset.port
      });
      return;
    }

    setDraft((current) => ({ ...current, targetId: id }));
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Connection Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <FormControl fullWidth size="small">
            <InputLabel id="target-preset-label">Target</InputLabel>
            <Select labelId="target-preset-label" label="Target" value={draft.targetId} onChange={(event) => setPreset(event.target.value)}>
              {targetPresets.map((preset) => (
                <MenuItem key={preset.id} value={preset.id}>
                  {preset.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <TextField
            label="Host"
            size="small"
            value={draft.host}
            onChange={(event) => setDraft((current) => ({ ...current, targetId: "custom", host: event.target.value }))}
          />
          <TextField
            label="NT4 port"
            size="small"
            type="number"
            value={draft.port}
            onChange={(event) => setDraft((current) => ({ ...current, port: Number(event.target.value) }))}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={() => {
            onSave(draft);
            onClose();
          }}
        >
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}
