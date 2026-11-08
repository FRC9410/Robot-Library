import { Button, Divider, IconButton, List, ListItem, ListItemButton, ListItemText, Paper, Stack, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import { round, type AutoRoutine, type NamedPoint } from "../autoModel";

type AutoRoutineListProps = { autos: AutoRoutine[]; selectedId: string | null; disabled: boolean; onSelect: (id: string) => void; onCreate: () => void; onDelete: (id: string) => void; onDuplicate: () => void;
  view: "routines" | "points"; onView: (view: "routines" | "points") => void; points: NamedPoint[]; selectedPointId: string | null;
  onSelectPoint: (id: string) => void; onCreatePoint: () => void; onDeletePoint: (id: string) => void };

export function AutoRoutineList({ autos, selectedId, disabled, onSelect, onCreate, onDelete, onDuplicate, view, onView, points, selectedPointId, onSelectPoint, onCreatePoint, onDeletePoint }: AutoRoutineListProps) {
  return <Paper variant="outlined" aria-label="Routines card" sx={{ p: 1.5, display: "flex", flexDirection: "column", minHeight: 0 }}>
    <ToggleButtonGroup exclusive fullWidth size="small" value={view} aria-label="Auto library view" onChange={(_, value) => { if (value) onView(value); }}
      sx={{ flexShrink: 0, "& .MuiToggleButton-root": { flex: 1, minWidth: 0, px: .5, textTransform: "none", fontSize: 12 },
        "& .MuiToggleButton-root.Mui-selected, & .MuiToggleButton-root.Mui-selected:hover": { bgcolor: "primary.main", color: "primary.contrastText" } }}>
      <ToggleButton value="routines">Routines</ToggleButton><ToggleButton value="points">Points</ToggleButton>
    </ToggleButtonGroup>
    {view === "routines" ? <List dense aria-label="Auto routines" sx={{ overflowY: "auto", flex: 1 }}>
      {autos.map(auto => <ListItem key={auto.id} disablePadding secondaryAction={<Tooltip title="Delete auto"><span>
        <IconButton size="small" disabled={disabled} aria-label={`Delete auto ${auto.name || "Unnamed auto"}`} onClick={() => onDelete(auto.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </span></Tooltip>}>
        <ListItemButton selected={auto.id === selectedId} onClick={() => onSelect(auto.id)} sx={{ pr: 5 }}>
          <ListItemText primary={auto.name || "Unnamed auto"} secondary={auto.alliance ?? "Any alliance"} sx={{ overflowWrap: "anywhere" }} />
        </ListItemButton>
      </ListItem>)}
    </List> : <List dense aria-label="Named points" sx={{ overflowY: "auto", flex: 1 }}>
      {points.map((point, index) => <ListItem key={point.id} disablePadding secondaryAction={<Tooltip title="Delete point"><span>
        <IconButton size="small" disabled={disabled} aria-label={`Delete named point ${point.name}`} onClick={() => onDeletePoint(point.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </span></Tooltip>}><ListItemButton selected={point.id === selectedPointId} onClick={() => onSelectPoint(point.id)} sx={{ pr: 5 }}>
        <ListItemText primary={`${index + 1}. ${point.name || "Unnamed point"}`} secondary={`X ${round(point.x)} · Y ${round(point.y)} · ${round(point.heading)}°`} sx={{ overflowWrap: "anywhere" }} />
      </ListItemButton></ListItem>)}
    </List>}
    {view === "routines" && !autos.length && <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>Create an auto, then add drive points and steps.</Typography>}
    <Divider sx={{ mb: 1.5, flexShrink: 0 }} />
    <Stack spacing={1} sx={{ flexShrink: 0 }}>
      {view === "routines" ? <><Button variant="outlined" size="small" disabled={disabled} onClick={onCreate}>New auto</Button>
        <Button variant="outlined" size="small" disabled={disabled || !selectedId} onClick={onDuplicate}>Duplicate auto</Button></>
        : <Button variant="outlined" size="small" disabled={disabled} onClick={onCreatePoint}>New point</Button>}
    </Stack>
  </Paper>;
}
