import { useMemo } from "react";
import { Button, Divider, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { averageAt } from "../logModel";
import type { LogMechanism, Series } from "../logModel";
import { formatNumber, groupColor, pickedGroups } from "../logUtils";
import type { PowerGroup } from "../logUtils";
import { CurrentGraph } from "./CurrentGraph";
import { LogCard } from "./LogCard";
import { PowerTable } from "./PowerTable";

type PowerCardProps = {
  allGroups: PowerGroup[];
  selected: LogMechanism[];
  battery?: Series<number>;
  motorCount: number;
  time: number;
  onAssign: () => void;
  /** Height of the current graph; a tall column can give it more. */
  graphHeight?: number;
  sx?: SxProps<Theme>;
};

/**
 * Current draw of the subsystems picked in the Subsystems dropdown: a stacked graph in amps, then a table of
 * current and temperature per subsystem. The header has the whole robot's current and the battery voltage.
 */
export function PowerCard({ allGroups, selected, battery, motorCount, time, onAssign, graphHeight, sx }: PowerCardProps) {
  const groups = useMemo(() => pickedGroups(allGroups, selected), [allGroups, selected]);
  const colorOf = (id: string) => groupColor(id, allGroups);
  const assign = motorCount > 0 && <Button size="small" onClick={onAssign}>Assign motors</Button>;
  if (allGroups.length === 0) {
    return (
      <LogCard title="Power" action={assign} sx={sx}>
        <Typography variant="body2" color="text.secondary">
          No motor current in this log. It comes from Phoenix's auto-logged motor signals, which are in the CAN bus .hoot files (opening a .hoot opens them all).
        </Typography>
      </LogCard>
    );
  }
  const robotAmps = allGroups.reduce((sum, group) => sum + (Math.max(0, averageAt(group.current, time) ?? 0) || 0), 0);
  const volts = averageAt(battery, time);
  const summary = (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1.5 }}>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontVariantNumeric: "tabular-nums" }}>Robot <b>{formatNumber(robotAmps, 0)} A</b></Typography>
      <Typography variant="caption" noWrap sx={{ fontVariantNumeric: "tabular-nums" }} color={volts !== undefined && volts < 8 ? "error" : "text.secondary"}>
        Battery <b>{formatNumber(volts, 1)} V</b>
      </Typography>
      {assign}
    </Stack>
  );
  const rows = selected.filter(subsystem => groups.some(group => group.id === subsystem.id));
  return (
    <LogCard title="Power" action={summary} sx={sx}>
      {groups.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          None of the picked subsystems have motor data. Pick one with motors in the Subsystems dropdown, or use Assign motors.
        </Typography>
      ) : (
        <>
          <CurrentGraph groups={groups} colorOf={colorOf} time={time} height={graphHeight} />
          <Divider flexItem />
          <PowerTable subsystems={rows} colorOf={colorOf} time={time} />
        </>
      )}
    </LogCard>
  );
}
