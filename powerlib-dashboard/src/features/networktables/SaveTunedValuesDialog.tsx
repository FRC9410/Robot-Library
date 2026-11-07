import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { useSaveTunedValues } from "./useSaveTunedValues";
import { formatValue } from "./saveTunedValuesModel";
export { buildChanges } from "./saveTunedValuesModel";

type SaveTunedValuesDialogProps = { open: boolean; topics: NtTopicSnapshot[]; onClose: () => void };
export function SaveTunedValuesDialog({ open, topics, onClose }: SaveTunedValuesDialogProps) {
  const {loading,saving,error,message,changes,selectedCount,setAllSelected,toggleChange,saveSelectedChanges,loadChanges}=useSaveTunedValues(open,topics);

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Save Tuned Values</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {loading && <LinearProgress />}
          {saving && <LinearProgress color="warning" />}
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <Typography color="text.secondary">
            Review live tunables that differ from Java defaults. Save selected values directly to the robot source.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button disabled={loading || saving || changes.length === 0} onClick={() => setAllSelected(true)} size="small">
              Check all
            </Button>
            <Button disabled={loading || saving || changes.length === 0} onClick={() => setAllSelected(false)} size="small">
              Uncheck all
            </Button>
            <Chip label={`${selectedCount} selected`} size="small" />
            <Chip label={`${changes.length} changed`} size="small" variant="outlined" />
          </Stack>

          {changes.length > 0 ? (
            <Stack spacing={1}>
              {changes.map((change) => (
                <Box
                  key={change.id}
                  component="label"
                  sx={{
                    alignItems: "center",
                    border: "1px solid",
                    borderColor: change.selected ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    cursor: loading || saving ? "default" : "pointer",
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: { xs: "auto minmax(0, 1fr)", md: "auto minmax(0, 1fr) auto" },
                    p: 1.25,
                    ...(change.selected
                      ? {
                          bgcolor: "rgba(255, 204, 0, 0.08)"
                        }
                      : {
                          "&:hover": {
                            bgcolor: loading || saving ? "transparent" : "action.hover"
                          }
                        })
                  }}
                >
                  <Checkbox
                    checked={change.selected}
                    disabled={loading || saving}
                    onChange={() => toggleChange(change.id)}
                  />
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>{change.label}</Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Chip
                        label={
                          change.target === "subsystem"
                            ? "Subsystem Java"
                            : change.target === "swerve" ? "Swerve Java" : change.target === "localization" ? "Localization Java" : "Constants Java"
                        }
                        size="small"
                        variant="outlined"
                      />
                      <Typography color="text.secondary" sx={{ fontFamily: "monospace" }} variant="body2">
                        {change.oldValueText} -&gt; {formatValue(change.newValue)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            !loading && (
              <Alert severity="info" variant="outlined">
                No changed tunables were found. Apply tuned values first, then reopen or refresh this dialog.
              </Alert>
            )
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => void loadChanges()}>
          Refresh
        </Button>
        <Button disabled={saving} onClick={onClose}>
          Close
        </Button>
        <Button disabled={loading || saving || selectedCount === 0} onClick={() => void saveSelectedChanges()} variant="contained">
          Save selected
        </Button>
      </DialogActions>
    </Dialog>
  );
}
