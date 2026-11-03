import { Button, LinearProgress, Paper, Typography } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import TimelineIcon from "@mui/icons-material/Timeline";

type OpenLogPromptProps = {
  dragging: boolean;
  loading: boolean;
  onOpen: () => void;
};

/** What the Logs tab shows before a log is open; the panel around it takes the dropped file. */
export function OpenLogPrompt({ dragging, loading, onOpen }: OpenLogPromptProps) {
  return (
    <Paper variant="outlined" sx={{ p: 6, borderRadius: 2, borderStyle: "dashed", borderColor: dragging ? "primary.main" : "divider",
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
      <TimelineIcon color="primary" sx={{ fontSize: 48 }} />
      <Typography variant="h6" sx={{ fontWeight: 800 }}>Open a robot log</Typography>
      <Button variant="contained" startIcon={<FolderOpenIcon />} onClick={onOpen} disabled={loading}>Open log</Button>
      {loading && <LinearProgress sx={{ width: 240 }} />}
    </Paper>
  );
}
