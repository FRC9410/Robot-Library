import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Select, Stack, Table, TableBody, TableCell, TableHead,
  TableRow, Typography } from "@mui/material";
import { useMemo } from "react";
import { averageAt, slotMeans } from "./logModel";
import type { LogMechanism, LogModel, LogMotor, Series } from "./logModel";
import { Card, formatNumber, logColors } from "./LogWidgets";

const groupPalette = ["#60a5fa", "#f59e0b", "#34d399", "#f472b6", "#a78bfa", "#22d3ee", "#fb923c", "#a3e635", "#e879f9", "#facc15"];
const unassignedColor = "#71717a";

type PowerGroup = LogModel["powerGroups"][number];

/**
 * Power of the mechanisms picked in the Mechanisms dropdown, stacked over the graphs' time window, next to
 * the whole robot's total and the battery voltage. Unpicked mechanisms are left out to keep it readable.
 */
export function PowerWidget({ allGroups, selected, battery, motorCount, time, onAssign, windowSeconds = 20 }: {
  allGroups: LogModel["powerGroups"]; selected: LogMechanism[]; battery?: Series<number>; motorCount: number; time: number;
  onAssign: () => void; windowSeconds?: number;
}) {
  const assign = motorCount > 0 && <Button size="small" onClick={onAssign}>Assign motors</Button>;
  // Picked groups in the model's fixed order, then picked single motors (they aren't power groups on their own).
  const groups = useMemo<PowerGroup[]>(() => {
    const ids = new Set(selected.map(mechanism => mechanism.id));
    const extras = selected.filter(mechanism => mechanism.metrics.power && !allGroups.some(group => group.id === mechanism.id))
      .map(mechanism => ({ id: mechanism.id, name: mechanism.name, power: mechanism.metrics.power! }));
    return [...allGroups.filter(group => ids.has(group.id)), ...extras];
  }, [allGroups, selected]);
  // A color per group from the full list, so a mechanism keeps its color whatever else is picked.
  const colorOf = (id: string) => {
    if (id === "unassigned") return unassignedColor;
    const index = allGroups.findIndex(group => group.id === id);
    const slot = index >= 0 ? index : allGroups.length + [...id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    return groupPalette[slot % groupPalette.length];
  };
  // One y-axis scale for the picked groups over the whole log (the busiest 0.1 s), rounded up, so the chart doesn't rescale while it plays.
  const scale = useMemo(() => {
    if (!groups.length) return 100;
    const end = Math.max(...groups.map(group => group.power.times[group.power.times.length - 1] ?? 0));
    const slotted = groups.map(group => slotMeans(group.power, 0, end, 0.1).means);
    let peak = 100;
    for (let index = 0; index < slotted[0].length; index += 1) peak = Math.max(peak, slotted.reduce((sum, means) => sum + (Math.max(0, means[index]) || 0), 0));
    const magnitude = 10 ** Math.floor(Math.log10(peak));
    return Math.ceil(peak / (magnitude / 2)) * (magnitude / 2);
  }, [groups]);
  if (allGroups.length === 0) {
    return (
      <Card title="Power by mechanism" action={assign}>
        <Typography variant="body2" color="text.secondary">
          No motor current in this log. Power comes from Phoenix's auto-logged motor signals, which are in the CAN bus .hoot files (opening a .hoot opens them all).
        </Typography>
      </Card>
    );
  }
  const robotTotal = allGroups.reduce((sum, group) => sum + (Math.max(0, averageAt(group.power, time) ?? 0) || 0), 0);
  if (groups.length === 0) {
    return (
      <Card title="Power · picked mechanisms" action={assign}>
        <Typography variant="body2" color="text.secondary">
          None of the mechanisms you picked have motor data. Pick one with motors in the Mechanisms dropdown, or use Assign motors.
          The whole robot is drawing {formatNumber(robotTotal, 0)} W.
        </Typography>
      </Card>
    );
  }
  const width = 600;
  const height = 110;
  const slots = 200;
  const step = windowSeconds / slots;
  const from = time - windowSeconds / 2;
  // Fixed time slots (see slotMeans) so the stack slides smoothly instead of re-sampling noisy 100 Hz data each frame.
  const slotted = groups.map(group => slotMeans(group.power, from, from + windowSeconds, step));
  const starts = slotted[0].starts;
  const stacks = slotted.map(entry => entry.means.map(watts => Math.max(0, watts) || 0));
  const x = (start: number) => ((start + step / 2 - from) / windowSeconds) * width;
  const y = (watts: number) => height - (Math.min(watts, scale) / scale) * height;
  const floor = starts.map(() => 0);
  const areas = stacks.map(stack => {
    const lower = [...floor];
    for (let index = 0; index < floor.length; index += 1) floor[index] += stack[index];
    const upper = floor.map((value, index) => `${x(starts[index]).toFixed(1)},${y(value).toFixed(1)}`);
    const back = lower.map((value, index) => `${x(starts[index]).toFixed(1)},${y(value).toFixed(1)}`).reverse();
    return [...upper, ...back].join(" ");
  });
  // Readouts are 0.5 s averages, listed in the groups' fixed order so rows don't jump around.
  const now = groups.map(group => ({ group, watts: Math.max(0, averageAt(group.power, time) ?? 0) || 0 }));
  const total = now.reduce((sum, entry) => sum + entry.watts, 0);
  const volts = averageAt(battery, time);
  return (
    <Card title={`Power · picked mechanisms · ${windowSeconds} s window`} action={assign}>
      <Stack direction="row" sx={{ gap: 0.75 }}>
        <Stack sx={{ justifyContent: "space-between", height, textAlign: "right", minWidth: 40 }}>
          <Typography variant="caption" color="text.secondary">{Math.round(scale)} W</Typography>
          <Typography variant="caption" color="text.secondary">0</Typography>
        </Stack>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Power per mechanism over time"
          sx={{ flex: 1, minWidth: 0, height, display: "block" }}>
          {areas.map((points, index) => <polygon key={groups[index].id} points={points} fill={colorOf(groups[index].id)} opacity={0.75} />)}
          <line x1={width / 2} x2={width / 2} y1={0} y2={height} stroke={logColors.cursor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </Box>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: "space-between", flexWrap: "wrap", gap: 1 }}>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }}>
          <b>Picked {formatNumber(total, 0)} W</b> <Box component="span" sx={{ color: "text.secondary" }}>of {formatNumber(robotTotal, 0)} W robot total</Box>
        </Typography>
        <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums" }} color={volts !== undefined && volts < 8 ? "error" : "text.secondary"}>
          Battery {formatNumber(volts, 1)} V
        </Typography>
      </Stack>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", columnGap: 1.5, rowGap: 0.25 }}>
        {now.map(({ group, watts }) => (
          <Typography key={group.id} variant="caption" color="text.secondary" noWrap sx={{ fontVariantNumeric: "tabular-nums" }}>
            <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: 0.5, bgcolor: colorOf(group.id), mr: 0.5 }} />
            {group.name} <b>{formatNumber(watts, 0)} W</b>
          </Typography>
        ))}
      </Box>
    </Card>
  );
}

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
 * Lists every motor in the log so it can be put under a mechanism or a group like Drive. Choices are
 * saved and override the CAN IDs from powerlib-subsystems.json; "Automatic" goes back to the config.
 */
export function MotorAssignDialog({ open, onClose, motors, mechanisms, overrides, onAssign, onReset }: {
  open: boolean; onClose: () => void; motors: LogMotor[]; mechanisms: LogMechanism[]; overrides: Record<string, string>;
  onAssign: (key: string, group: string | null) => void; onReset: () => void;
}) {
  const named = mechanisms.filter(mechanism => !mechanism.id.startsWith("motor:"));
  const choices = Array.from(new Set(["Drive", ...named.map(mechanism => mechanism.id), ...motors.map(motor => motor.group).filter(Boolean)]));
  const nameOf = (id: string) => named.find(mechanism => mechanism.id === id)?.name ?? id;
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Assign motors</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Motors are grouped automatically: from powerlib-subsystems.json and TunerConstants.java when Power Tool can read them, otherwise by matching each
          motor's motion to a mechanism. Change any that are wrong here; your choices are saved on this computer.
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
                    inputProps={{ "aria-label": `Mechanism for TalonFX ${motor.id} on ${motor.bus}` }}>
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
