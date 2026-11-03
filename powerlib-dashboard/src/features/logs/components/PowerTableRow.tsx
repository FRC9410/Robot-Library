import { Box, IconButton, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { averageAt } from "../logModel";
import type { LogMechanism } from "../logModel";
import { formatNumber, logColors } from "../logUtils";
import { PowerMotorRow } from "./PowerMotorRow";

type PowerTableRowProps = {
  subsystem: LogMechanism;
  color: string;
  time: number;
  open: boolean;
  onToggle: () => void;
};

/** A subsystem's total supply current and hottest motor, with its motors underneath when open. */
export function PowerTableRow({ subsystem, color, time, open, onToggle }: PowerTableRowProps) {
  const current = averageAt(subsystem.metrics.current, time);
  const hottest = averageAt(subsystem.metrics.temp, time);
  const number = (text: string, warn = false) => (
    <Typography variant="body2" noWrap sx={{ fontVariantNumeric: "tabular-nums", color: warn ? logColors.bad : undefined }}>{text}</Typography>
  );
  return (
    <>
      {subsystem.motors.length > 0 ? (
        <IconButton size="small" onClick={onToggle} aria-expanded={open} aria-label={`${open ? "Hide" : "Show"} ${subsystem.name} motors`}
          sx={{ p: 0.25, transform: open ? "rotate(180deg)" : undefined, transition: "transform 150ms" }}>
          <ExpandMoreIcon fontSize="small" />
        </IconButton>
      ) : <span />}
      <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
        <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: 0.5, bgcolor: color, mr: 0.75 }} />
        {subsystem.name}
      </Typography>
      {number(`${formatNumber(current, 1)} A`)}
      {number(`${formatNumber(hottest, 0)} °C`, hottest !== undefined && hottest >= 70)}
      {open && subsystem.motors.map(motor => <PowerMotorRow key={motor.key} motor={motor} time={time} />)}
    </>
  );
}
