import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { formatBytes } from "../logLibraryModel";

type RobotLogsFooterProps = {
  count: number;
  bytes: number;
  progress: { done: number; total: number } | null;
  deleting: boolean;
  onCancel: () => void;
  onDelete: () => void;
  onDownload: () => void;
};

/** What's picked, Delete, the download button ("Download and open" for one, "Download 3" for several), and progress while copying. */
export function RobotLogsFooter({ count, bytes, progress, deleting, onCancel, onDelete, onDownload }: RobotLogsFooterProps) {
  const percent = progress && progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0;
  const busy = progress !== null || deleting;
  const status = progress ? `Downloading… ${formatBytes(progress.done)} of ${formatBytes(progress.total)}`
    : deleting ? "Deleting…" : count ? `${count} selected · ${formatBytes(bytes)}` : "Nothing selected";
  return (
    <Stack spacing={1} sx={{ flexShrink: 0 }}>
      {progress && <LinearProgress variant="determinate" value={percent} />}
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">{status}</Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" color="error" startIcon={<DeleteIcon fontSize="small" />} onClick={onDelete} disabled={count === 0 || busy}>
          Delete
        </Button>
        <Button size="small" onClick={onCancel} disabled={busy}>Cancel</Button>
        <Button size="small" variant="contained" onClick={onDownload} disabled={count === 0 || busy}>
          {count > 1 ? `Download ${count}` : "Download and open"}
        </Button>
      </Stack>
    </Stack>
  );
}
