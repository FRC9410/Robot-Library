import { ToggleButton, ToggleButtonGroup } from "@mui/material";
import type { LogPeriod } from "../logModel";

type PhaseToggleProps = {
  periods: LogPeriod[];
  current?: LogPeriod;
  onSeek: (time: number) => void;
};

/** One box with a segment per match period (Auto | Teleop); the period being played is highlighted and clicking one jumps to its start. */
export function PhaseToggle({ periods, current, onSeek }: PhaseToggleProps) {
  if (periods.length === 0) return null;
  return (
    <ToggleButtonGroup exclusive size="small" color="primary" value={current?.start ?? null} aria-label="Jump to a match period" sx={{ flexShrink: 0 }}>
      {periods.map(period => (
        <ToggleButton key={period.start} value={period.start} onClick={() => onSeek(period.start)}
          sx={{ py: 0.25, px: 1.5, textTransform: "none", fontWeight: 700, fontSize: 13 }}>
          {period.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
