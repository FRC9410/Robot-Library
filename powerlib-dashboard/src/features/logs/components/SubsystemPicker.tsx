import { Checkbox, FormControl, InputLabel, ListItemText, MenuItem, Select } from "@mui/material";
import type { LogMechanism } from "../logModel";

type SubsystemPickerProps = {
  subsystems: LogMechanism[];
  selected: LogMechanism[];
  onSelect: (ids: string[]) => void;
};

const plural = (count: number) => `${count} motor${count === 1 ? "" : "s"}`;

/** Which subsystems to graph; several can be picked at once. */
export function SubsystemPicker({ subsystems, selected, onSelect }: SubsystemPickerProps) {
  return (
    <FormControl size="small" sx={{ minWidth: 220, maxWidth: 380 }}>
      <InputLabel id="log-subsystems-label" shrink>Subsystems</InputLabel>
      <Select multiple displayEmpty notched labelId="log-subsystems-label" label="Subsystems" value={selected.map(item => item.id)}
        onChange={event => onSelect(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)}
        renderValue={ids => ids.length === 0 ? "Pick subsystems" : ids.map(id => subsystems.find(item => item.id === id)?.name ?? id).join(", ")}
        sx={{ "& .MuiSelect-select": { py: 0.75, fontSize: 13 } }}>
        {subsystems.map(item => (
          <MenuItem key={item.id} value={item.id} dense>
            <Checkbox size="small" checked={selected.some(chosen => chosen.id === item.id)} sx={{ p: 0.5, mr: 1 }} />
            <ListItemText primary={item.name} secondary={item.kind === "motors"
              ? item.id.startsWith("motor:") ? "unassigned motor" : plural(item.motors.length)
              : `${item.kind} · ${item.units}${item.motors.length ? ` · ${plural(item.motors.length)}` : ""}`} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}
