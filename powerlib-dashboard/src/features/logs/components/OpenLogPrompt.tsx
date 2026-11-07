import type { ReactNode } from "react";
import { Box, Button, LinearProgress, Paper, Stack, Typography } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TimelineIcon from "@mui/icons-material/Timeline";

type OpenLogPromptProps = {
  dragging: boolean;
  loading: boolean;
  onOpen: () => void;
  /** More buttons beside Open log, like Get logs from robot. */
  actions?: ReactNode;
};

/** What the Logs tab shows before a log is open, centered in the tab; the panel around it takes the dropped file. */
export function OpenLogPrompt({ dragging, loading, onOpen, actions }: OpenLogPromptProps) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Paper variant="outlined" sx={{ p: 6, borderRadius: 2, borderStyle: "dashed", borderColor: dragging ? "primary.main" : "divider",
        display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
        <TimelineIcon color="primary" sx={{ fontSize: 48 }} />
        <Typography variant="h6" sx={{ fontWeight: 800 }}>Open a robot log</Typography>
        <Stack direction="row" sx={{ gap: 1 }}>
          <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={onOpen} disabled={loading}>Open log</Button>
          {actions}
        </Stack>
        {loading && <LinearProgress sx={{ width: 240 }} />}
      </Paper>
    </Box>
  );
}
