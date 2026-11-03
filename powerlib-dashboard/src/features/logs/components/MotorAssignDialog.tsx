import { Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, Table, TableBody, TableCell, TableHead, TableRow,
  Typography } from "@mui/material";
import type { LogMechanism, LogMotor } from "../logModel";
import { formatNumber } from "../logUtils";

type MotorAssignDialogProps = {
  open: boolean;
  onClose: () => void;
  motors: LogMotor[];
  mechanisms: LogMechanism[];
  overrides: Record<string, string>;
  onAssign: (key: string, group: string | null) => void;
  onReset: () => void;
};

const automatic = "__automatic__";
const sourceText: Record<LogMotor["source"], string> = {
  override: "", config: "from powerlib-subsystems.json", tuner: "from TunerConstants.java", motion: "matched by motion",
  guess: "guessed from the usual swerve IDs", "": ""
};

/** "Shooter · matched by motion (0.99)" for the dialog's Automatic option. */
function automaticLabel(motor: LogMotor, nameOf: (id: string) => string) {
  if (!motor.group || motor.source === "override") return "unassigned";
  const score = motor.source === "motion" && motor.matchScore !== undefined ? ` ${motor.matchScore.toFixed(2)}` : "";
  return `${nameOf(motor.group)} · ${sourceText[motor.source]}${score}`;
}

/**
 * Lists every motor in the log so it can be put under a subsystem or a group like Drive. Choices are
 * saved and override the CAN IDs from powerlib-subsystems.json; "Automatic" goes back to the config.
 */
export function MotorAssignDialog({ open, onClose, motors, mechanisms, overrides, onAssign, onReset }: MotorAssignDialogProps) {
  const named = mechanisms.filter(mechanism => !mechanism.id.startsWith("motor:"));
  const choices = Array.from(new Set(["Drive", ...named.map(mechanism => mechanism.id), ...motors.map(motor => motor.group).filter(Boolean)]));
  const nameOf = (id: string) => named.find(mechanism => mechanism.id === id)?.name ?? id;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Assign motors</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Motors are grouped automatically: from powerlib-subsystems.json and TunerConstants.java when Power Tool can read them, otherwise by matching each
          motor's motion to a subsystem. Change any that are wrong here; your choices are saved on this computer.
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Motor</TableCell>
              <TableCell>CAN bus</TableCell>
              <TableCell align="right">Peak current</TableCell>
              <TableCell>Counts toward</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {motors.map(motor => (
              <TableRow key={motor.key}>
                <TableCell>TalonFX {motor.id}</TableCell>
                <TableCell>{motor.bus}</TableCell>
                <TableCell align="right">{formatNumber(motor.peakCurrent, 0)} A</TableCell>
                <TableCell>
                  <Select variant="standard" size="small" sx={{ minWidth: 280 }} value={motor.key in overrides ? overrides[motor.key] : automatic}
                    onChange={event => onAssign(motor.key, event.target.value === automatic ? null : event.target.value)}
                    inputProps={{ "aria-label": `Subsystem for TalonFX ${motor.id} on ${motor.bus}` }}>
                    <MenuItem value={automatic}>Automatic{motor.key in overrides ? "" : ` (${automaticLabel(motor, nameOf)})`}</MenuItem>
                    <MenuItem value="">Unassigned</MenuItem>
                    {choices.map(choice => <MenuItem key={choice} value={choice}>{nameOf(choice)}</MenuItem>)}
                  </Select>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions>
        <Button onClick={onReset} disabled={Object.keys(overrides).length === 0}>Reset all to automatic</Button>
        <Button variant="contained" onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}
