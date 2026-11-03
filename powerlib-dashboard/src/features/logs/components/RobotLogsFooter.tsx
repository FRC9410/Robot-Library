import { Box, Button, LinearProgress, Stack, Typography } from "@mui/material";
import { formatBytes } from "../logLibraryModel";

type RobotLogsFooterProps = {
  count: number;
  bytes: number;
  progress: { done: number; total: number } | null;
  onCancel: () => void;
  onDownload: () => void;
};

/** What's picked, the download button ("Download and open" for one, "Download 3" for several), and progress while copying. */
export function RobotLogsFooter({ count, bytes, progress, onCancel, onDownload }: RobotLogsFooterProps) {
  const percent = progress && progress.total > 0 ? Math.min(100, (progress.done / progress.total) * 100) : 0;
  return (
    <Stack spacing={1} sx={{ flexShrink: 0 }}>
      {progress && <LinearProgress variant="determinate" value={percent} />}
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {progress ? `Downloading… ${formatBytes(progress.done)} of ${formatBytes(progress.total)}` : count ? `${count} selected · ${formatBytes(bytes)}` : "Nothing selected"}
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button size="small" onClick={onCancel} disabled={progress !== null}>Cancel</Button>
        <Button size="small" variant="contained" onClick={onDownload} disabled={count === 0 || progress !== null}>
          {count > 1 ? `Download ${count}` : "Download and open"}
        </Button>
      </Stack>
    </Stack>
  );
}
