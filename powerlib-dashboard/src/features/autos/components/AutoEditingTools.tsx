import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";
import { AutoNumberField } from "./AutoNumberField";
import { allSteps, mapSteps } from "../autoModel";
import type { useAutoTools } from "../useAutoTools";
import type { useAutoEditor } from "../useAutoEditor";

type Props = { tools: ReturnType<typeof useAutoTools>; editor: ReturnType<typeof useAutoEditor> };
export function AutoEditingDialogs({ tools }: Props) {
  return <Dialog open={!!tools.dialog} onClose={() => tools.setDialog(null)} fullWidth maxWidth="sm">
    <DialogTitle>Auto keyboard shortcuts</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <>{[
        ["Ctrl/Cmd Z · Ctrl/Cmd Shift Z / Y", "Undo · Redo"], ["Ctrl/Cmd C / V / D", "Copy · Paste · Duplicate steps"],
        ["Ctrl/Cmd A · Delete", "Select all · Delete selection"], ["Ctrl/Cmd click · Shift click", "Toggle one item · Select steps between"],
        ["Drag empty field · Ctrl/Shift drag empty field", "Box select · Add to selection"],
        ["Arrow keys · Shift arrows", "Move selected points 5 cm · 25 cm"], ["Q / E · Shift Q / E", "Rotate headings ±15° · ±1°"],
        ["Alt ↑ / ↓ · Drag step row", "Reorder steps"], ["Ctrl while dragging", "Temporarily bypass snapping"], ["Escape · Ctrl/Cmd S", "Cancel drag / clear selection · Save"],
      ].map(([keys, action]) => <Stack key={keys}><Typography variant="body2">{keys}</Typography><Typography variant="caption" color="text.secondary">{action}</Typography></Stack>)}</>
    </Stack></DialogContent>
    <DialogActions><Button onClick={() => tools.setDialog(null)}>Done</Button></DialogActions>
  </Dialog>;
}
export function AutoGroupInspector({ tools }: { tools: Props["tools"] }) {
  const points = allSteps(tools.displayed?.steps ?? []).filter(step => step.type === "drive" && tools.ids.includes(step.id));
  const first = points[0];
  return <Stack spacing={1.5} aria-label="Group settings"><Typography>{tools.ids.length} steps selected</Typography>
    <Stack direction="row" spacing={1}><Button disabled={!points.length} onClick={() => { const first = points[0]; if (first?.type === "drive") tools.update(auto => ({ ...auto, steps: mapSteps(auto.steps, step => step.type === "drive" && tools.ids.includes(step.id) ? { ...step, x: first.x } : step) })); }}>Align X</Button>
      <Button disabled={!points.length} onClick={() => { const first = points[0]; if (first?.type === "drive") tools.update(auto => ({ ...auto, steps: mapSteps(auto.steps, step => step.type === "drive" && tools.ids.includes(step.id) ? { ...step, y: first.y } : step) })); }}>Align Y</Button></Stack>
    <Button disabled={!points.length} onClick={() => tools.rotate(15)}>Rotate headings +15°</Button>
    {first?.type === "drive" && <>{(["maxVelocity", "maxAcceleration", "endDistanceTolerance", "endVelocityTolerance"] as const).map((key, index) =>
      <AutoNumberField key={key} label={["Group max velocity (m/s)", "Group max acceleration (m/s²)", "Group distance tolerance (m)", "Group velocity tolerance (m/s)"][index]}
        value={first[key]} min={.001} onChange={value => tools.update(auto => ({ ...auto, steps: mapSteps(auto.steps, step => step.type === "drive" && tools.ids.includes(step.id) ? { ...step, [key]: value } : step) }))} />)}</>}
    <Button onClick={tools.actions.duplicate}>Duplicate selected</Button>
  </Stack>;
}
