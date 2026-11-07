import { Alert, Box, Button, Chip, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { GeneratedSubsystem, SubsystemDocumentState } from "../subsystems/types";
import { SubsystemExpander } from "./SubsystemExpander";

export function SubsystemSettings({ document, onRefresh, onCreate, onEdit }: {
  document: SubsystemDocumentState;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (subsystem: GeneratedSubsystem, index: number) => void;
}) {
  return <Box className="config-content">
    <Box className="config-content-heading">
      <Box><Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}><Typography variant="h5" component="h3">Subsystems</Typography><Chip label={document.subsystems.length} size="small" /></Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Inspect your robot’s mechanisms and hardware configuration.</Typography></Box>
      <IconButton aria-label="Refresh subsystems" disabled={document.loading} onClick={onRefresh}><RefreshIcon /></IconButton>
    </Box>
    <Box className="config-subsystem-list">
      {document.loading ? <Stack role="status" direction="row" spacing={1.5} sx={{ p: 3, alignItems: "center" }}><CircularProgress size={20} /><Typography>Loading subsystems…</Typography></Stack>
        : document.error ? <Alert severity="error" action={<Button color="inherit" onClick={onRefresh}>Retry</Button>}>{document.error}</Alert>
        : document.subsystems.length ? <Stack spacing={1.5}>{document.subsystems.map((subsystem, index) => <SubsystemExpander
            key={`${subsystem.id ?? subsystem.name}-${index}`} subsystem={subsystem} onEdit={() => onEdit(subsystem, index)} />)}</Stack>
        : <Box className="config-empty"><LayersOutlinedIcon sx={{ fontSize: 40, color: "text.secondary" }} />
          <Typography variant="h6">No subsystems yet</Typography><Typography color="text.secondary">Add your first subsystem to configure its motors and controls.</Typography></Box>}
    </Box>
    <Box className="config-footer"><Button variant="contained" startIcon={<AddIcon />} disabled={document.loading || !!document.error} onClick={onCreate}>Add Subsystem</Button>
      <Typography variant="caption" color="text.secondary" sx={{ ml: "auto" }}>Changes are saved to your robot project.</Typography></Box>
  </Box>;
}
