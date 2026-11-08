import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Box, Button, Divider, IconButton, List, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Paper, Stack, Tooltip, Typography } from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { AutoInspector } from "./AutoInspector";
import { stepLabels, type AutoRoutine, type AutoStep, type AutoStepType } from "../autoModel";

type AutoStepsPaneProps = { auto: AutoRoutine | undefined; selectedId: string | null; states: string[]; disabled: boolean;
  onSelect: (id: string) => void; onAdd: (type: AutoStepType) => void; onRemove: (id: string) => void; onChange: (step: AutoStep) => void; footer: ReactNode };

export function AutoStepsPane({ auto, selectedId, states, disabled, onSelect, onAdd, onRemove, onChange, footer }: AutoStepsPaneProps) {
  const selected = auto?.steps.find(step => step.id === selectedId);
  const [pointMenuAnchor, setPointMenuAnchor] = useState<HTMLElement | null>(null);
  const pointMenuId = useId();
  const pointMenuOpen = !!pointMenuAnchor && !disabled && !!auto;
  const addStep = (type: "drive" | "wait" | "requestState" | "waitForState") => { setPointMenuAnchor(null); onAdd(type); };
  return <Paper variant="outlined" aria-label="Steps card" sx={{ p: 1.5, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
    <Typography variant="subtitle1">Steps</Typography>
    <Box sx={{ my: 1, flexShrink: 0 }}>
      <Button size="small" variant="outlined" fullWidth disabled={disabled || !auto} aria-haspopup="menu" aria-expanded={pointMenuOpen}
        aria-controls={pointMenuOpen ? pointMenuId : undefined} onClick={event => setPointMenuAnchor(event.currentTarget)}>Add step</Button>
    </Box>
    <Menu id={pointMenuId} anchorEl={pointMenuAnchor} open={pointMenuOpen} onClose={() => setPointMenuAnchor(null)}>
      <MenuItem onClick={() => addStep("drive")}>Add point</MenuItem>
      <MenuItem onClick={() => addStep("wait")}>Add wait</MenuItem>
      <MenuItem disabled={!states.length} onClick={() => addStep("requestState")}>Execute state</MenuItem>
      <MenuItem disabled={!states.length} onClick={() => addStep("waitForState")}>Wait for state</MenuItem>
    </Menu>
    <List dense aria-label="Auto steps" sx={{ flex: 1, minHeight: 80, overflowY: "auto" }}>
      {auto?.steps.map((step, index) => <ListItem key={step.id} disablePadding secondaryAction={<Tooltip title="Delete step"><span>
        <IconButton size="small" disabled={disabled} aria-label={`Delete step ${index + 1}`} onClick={() => onRemove(step.id)}><DeleteOutlinedIcon fontSize="small" /></IconButton>
      </span></Tooltip>}>
        <ListItemButton selected={step.id === selectedId} onClick={() => onSelect(step.id)} sx={{ pr: 5 }}>
        <ListItemText primary={`${index + 1}. ${stepLabels[step.type]}`} secondary={step.type === "drive" ? `X ${step.x} · Y ${step.y} · ${step.heading}°`
          : step.type === "wait" ? `${step.seconds} s` : step.type === "requestState" || step.type === "waitForState" ? step.state : ""} />
        </ListItemButton>
      </ListItem>)}
    </List>
    <Divider aria-label="Step settings divider" sx={{ flexShrink: 0 }} />
    {selected && <Stack spacing={2} sx={{ maxHeight: "55%", overflowY: "auto", flexShrink: 0, pt: 1 }}>
      <AutoInspector key={selected.id} step={selected} states={states} disabled={disabled} onChange={onChange} />
    </Stack>}
    </Box>
    <Box sx={{ pt: 1.5, flexShrink: 0 }}>{footer}</Box>
  </Paper>;
}
