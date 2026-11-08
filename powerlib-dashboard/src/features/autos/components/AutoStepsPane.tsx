import { useEffect, useId, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { Box, Button, Divider, IconButton, List, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Paper, Stack, Tooltip, Typography } from "@mui/material";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import UndoIcon from "@mui/icons-material/Undo";
import RedoIcon from "@mui/icons-material/Redo";
import { AutoInspector } from "./AutoInspector";
import { stepLabels, type AutoRoutine, type AutoStep, type AutoStepType } from "../autoModel";
import type { AutoSelectMode } from "../autoSelection";

type AutoStepsPaneProps = { auto: AutoRoutine | undefined; selectedId: string | null; states: string[]; disabled: boolean;
  onSelect: (id: string, mode?: AutoSelectMode) => void; onAdd: (type: AutoStepType) => void; onRemove: (id: string) => void; onChange: (step: AutoStep) => void; footer: ReactNode;
  selectedIds?: string[]; groupInspector?: ReactNode; pointSettings?: ReactNode; onDrop?: (source: string, before: string | null) => void; onClear?: () => void;
  onDuplicate: (id: string) => void; onUndo: () => void; onRedo: () => void; canUndo: boolean; canRedo: boolean };

export function AutoStepsPane({ auto, selectedId, selectedIds = [], groupInspector, pointSettings, onDrop, onClear, states, disabled, onSelect, onAdd, onRemove, onChange, footer,
  onDuplicate, onUndo, onRedo, canUndo, canRedo }: AutoStepsPaneProps) {
  const selected = auto?.steps.find(step => step.id === selectedId);
  const [pointMenuAnchor, setPointMenuAnchor] = useState<HTMLElement | null>(null);
  const dragged = useRef<string | null>(null);
  const [insertion, setInsertion] = useState<{ before: string | null; top: number } | null>(null);
  function clearDrag() { dragged.current = null; setInsertion(null); }
  useEffect(clearDrag, [auto?.id, disabled]);
  function dropPosition(event: DragEvent<HTMLUListElement>) {
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-auto-step-row]")];
    const next = rows.find(row => { const rect = row.getBoundingClientRect(); return event.clientY < rect.top + rect.height / 2; });
    const list = event.currentTarget.getBoundingClientRect();
    return { before: next?.dataset.autoStepRow ?? null,
      top: (next?.getBoundingClientRect().top ?? rows.at(-1)?.getBoundingClientRect().bottom ?? list.top + 8) - list.top + event.currentTarget.scrollTop };
  }
  const pointMenuId = useId();
  const pointMenuOpen = !!pointMenuAnchor && !disabled && !!auto;
  const addStep = (type: "drive" | "wait" | "requestState" | "waitForState") => { setPointMenuAnchor(null); onAdd(type); };
  return <Paper variant="outlined" aria-label="Steps card" sx={{ p: 1.5, overflow: "hidden", minHeight: 0, display: "flex", flexDirection: "column" }}>
    <Box sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
    <Stack direction="row" spacing={.5} sx={{ flexShrink: 0, alignItems: "center" }}>
      <Typography variant="subtitle1" sx={{ flex: 1 }}>Steps</Typography>
      <Tooltip title="Undo (Ctrl+Z)"><span><IconButton size="small" aria-label="Undo auto edit" disabled={disabled || !canUndo} onClick={onUndo}><UndoIcon fontSize="small" /></IconButton></span></Tooltip>
      <Tooltip title="Redo (Ctrl+Shift+Z)"><span><IconButton size="small" aria-label="Redo auto edit" disabled={disabled || !canRedo} onClick={onRedo}><RedoIcon fontSize="small" /></IconButton></span></Tooltip>
    </Stack>
    <Box sx={{ my: 1, flexShrink: 0, display: "flex", gap: 1 }}>
      <Button size="small" variant="outlined" fullWidth disabled={disabled || !auto} aria-haspopup="menu" aria-expanded={pointMenuOpen}
        aria-controls={pointMenuOpen ? pointMenuId : undefined} onClick={event => setPointMenuAnchor(event.currentTarget)}>Add step</Button>
    </Box>
    <Menu id={pointMenuId} anchorEl={pointMenuAnchor} open={pointMenuOpen} onClose={() => setPointMenuAnchor(null)}>
      <MenuItem onClick={() => addStep("drive")}>Add point</MenuItem>
      <MenuItem onClick={() => addStep("wait")}>Add wait</MenuItem>
      <MenuItem disabled={!states.length} onClick={() => addStep("requestState")}>Execute state</MenuItem>
      <MenuItem disabled={!states.length} onClick={() => addStep("waitForState")}>Wait for state</MenuItem>
    </Menu>
    <List dense aria-label="Auto steps" onClick={event => { if (event.target === event.currentTarget) onClear?.(); }} sx={{ flex: 1, minHeight: 80, overflowY: "auto", position: "relative" }}
      onDragOver={event => {
        if (disabled || !dragged.current || !event.dataTransfer.types.includes("application/x-powerlib-step")) return;
        event.preventDefault(); event.dataTransfer.dropEffect = "move"; setInsertion(dropPosition(event));
      }}
      onDragLeave={event => {
        if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX >= rect.right || event.clientY < rect.top || event.clientY >= rect.bottom) setInsertion(null);
      }}
      onDrop={event => {
        const source = event.dataTransfer.getData("application/x-powerlib-step");
        if (!disabled && dragged.current === source) { event.preventDefault(); onDrop?.(source, dropPosition(event).before); }
        clearDrag();
      }}>
      {auto?.steps.map((step, index) => <ListItem key={step.id} data-auto-step-row={step.id} disablePadding secondaryAction={<Stack direction="row">
        <Tooltip title="Duplicate step"><span><IconButton size="small" disabled={disabled} aria-label={`Duplicate step ${index + 1}`} onClick={() => onDuplicate(step.id)}><ContentCopyOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
        <Tooltip title="Delete step"><span><IconButton size="small" disabled={disabled} aria-label={`Delete step ${index + 1}`} onClick={() => onRemove(step.id)}><DeleteOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
      </Stack>}>
        <ListItemButton selected={selectedIds.includes(step.id) || step.id === selectedId} onClick={event => onSelect(step.id, event.shiftKey ? "range" : event.ctrlKey || event.metaKey)}
          sx={{ pl: .5, pr: 8, cursor: disabled ? "default" : "grab", "&:active": { cursor: disabled ? "default" : "grabbing" } }}
          draggable={!disabled} onDragStart={event => { dragged.current = step.id; event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("application/x-powerlib-step", step.id); }}
          onDragEnd={clearDrag}>
        <Tooltip title="Drag row to move"><DragIndicatorIcon data-step-move-icon="true" fontSize="small" color="action" sx={{ mr: .5, flexShrink: 0 }} /></Tooltip>
        <ListItemText primary={`${index + 1}. ${stepLabels[step.type]}`} secondary={step.type === "drive" ? `X ${step.x} · Y ${step.y} · ${step.heading}°`
          : step.type === "wait" ? `${step.seconds} s` : step.type === "requestState" || step.type === "waitForState" ? step.state : ""} />
        </ListItemButton>
      </ListItem>)}
      {insertion && <Box data-step-drop-indicator="true" data-before-step={insertion.before ?? "end"} aria-hidden="true"
        sx={{ position: "absolute", top: insertion.top - 1.5, left: 0, right: 0, height: 3, borderRadius: 1, bgcolor: "#facc15", pointerEvents: "none", zIndex: 2 }} />}
    </List>
    <Divider aria-label="Step settings divider" sx={{ flexShrink: 0 }} />
    {selected && <Stack spacing={2} sx={{ maxHeight: "55%", overflowY: "auto", flexShrink: 0, pt: 1 }}>
      {selectedIds.length > 1 ? groupInspector : <><AutoInspector key={selected.id} step={selected} states={states} disabled={disabled} onChange={onChange} />{selected.type === "drive" && pointSettings}</>}
    </Stack>}
    </Box>
    <Box sx={{ pt: 1.5, flexShrink: 0 }}>{footer}</Box>
  </Paper>;
}
