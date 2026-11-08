import { Button, IconButton, List, ListItem, ListItemButton, ListItemText, Paper, Stack, Tooltip, Typography } from "@mui/material";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import type { AutoRoutine } from "../autoModel";

type AutoRoutineListProps = { autos: AutoRoutine[]; selectedId: string | null; disabled: boolean; onSelect: (id: string) => void; onCreate: () => void; onDelete: (id: string) => void };

export function AutoRoutineList({ autos, selectedId, disabled, onSelect, onCreate, onDelete }: AutoRoutineListProps) {
  return <Paper variant="outlined" sx={{ p: 1.5, display: "flex", flexDirection: "column", minHeight: 0 }}>
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "center" }}>
      <Typography variant="subtitle1">Routines</Typography>
      <Button size="small" disabled={disabled} onClick={onCreate}>New auto</Button>
    </Stack>
    <List dense aria-label="Auto routines" sx={{ overflowY: "auto", flex: 1 }}>
      {autos.map(auto => <ListItem key={auto.id} disablePadding secondaryAction={<Tooltip title="Delete auto"><span>
        <IconButton size="small" disabled={disabled} aria-label={`Delete auto ${auto.name || "Unnamed auto"}`} onClick={() => onDelete(auto.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
      </span></Tooltip>}>
        <ListItemButton selected={auto.id === selectedId} onClick={() => onSelect(auto.id)} sx={{ pr: 5 }}>
          <ListItemText primary={auto.name || "Unnamed auto"} secondary={auto.alliance ?? "Any alliance"} sx={{ overflowWrap: "anywhere" }} />
        </ListItemButton>
      </ListItem>)}
    </List>
    {!autos.length && <Typography color="text.secondary" variant="body2" sx={{ py: 2 }}>Create an auto, then add drive points and steps.</Typography>}
  </Paper>;
}
