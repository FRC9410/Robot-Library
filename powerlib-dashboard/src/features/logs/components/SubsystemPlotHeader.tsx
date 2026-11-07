import { Box, Stack, Typography } from "@mui/material";
import { formatNumber, logColors } from "../logUtils";

type SubsystemPlotHeaderProps = {
  name: string;
  /** Hottest motor, °C. */
  temp?: number;
  value?: number;
  /** Setpoint now; `null` when this view has a setpoint but the log didn't record one. */
  setpoint?: number | null;
  units: string;
  places: number;
};

/** A graph's title row: the subsystem and its hottest motor on the left, the value now (and setpoint) on the right. */
export function SubsystemPlotHeader({ name, temp, value, setpoint, units, places }: SubsystemPlotHeaderProps) {
  return (
    <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1, minWidth: 0 }}>
      <Typography variant="body2" noWrap sx={{ fontWeight: 700, minWidth: 0 }}>
        {name}
        {temp !== undefined && (
          <Typography component="span" variant="caption" title="Hottest motor" sx={{ ml: 0.75, color: temp >= 70 ? logColors.bad : "text.secondary" }}>
            {formatNumber(temp, 0)} °C
          </Typography>
        )}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
        <Box component="span" sx={{ color: logColors.value, fontSize: 15, fontWeight: 800 }}>{formatNumber(value, places)}</Box> {units}
        {setpoint !== undefined && (setpoint === null
          ? <Box component="span" title="This log has no setpoint for this subsystem" sx={{ ml: 1 }}>no setpoint</Box>
          : <Box component="span" sx={{ ml: 1, color: logColors.setpoint, fontWeight: 700 }}>→ {formatNumber(setpoint, places)}</Box>)}
      </Typography>
    </Stack>
  );
}
