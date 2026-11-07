import type { PointerEvent } from "react";
import { Box } from "@mui/material";
import { segments } from "../logModel";
import type { LogPeriod, Series } from "../logModel";
import { logColors, periodColors, stateColor } from "../logUtils";

type TimelineProps = {
  periods: LogPeriod[];
  state?: Series<string>;
  stateOrder: string[];
  duration: number;
  time: number;
  onSeek: (time: number) => void;
};

/** The whole log: match periods on top, the robot's state underneath. Click or drag to move the time. */
export function Timeline({ periods, state, stateOrder, duration, time, onSeek }: TimelineProps) {
  const x = (sample: number) => (duration > 0 ? (sample / duration) * 1000 : 0);
  const seekAt = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    onSeek(((event.clientX - box.left) / box.width) * duration);
  };
  const runs = state && duration > 0 ? segments(state, duration) : [];
  const periodTop = state ? 2 : 6;
  return (
    <Box component="svg" viewBox="0 0 1000 28" preserveAspectRatio="none" role="slider" aria-label="Log time"
      aria-valuemin={0} aria-valuemax={duration} aria-valuenow={time}
      onPointerDown={(event: PointerEvent<SVGSVGElement>) => { event.currentTarget.setPointerCapture(event.pointerId); seekAt(event); }}
      onPointerMove={(event: PointerEvent<SVGSVGElement>) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) seekAt(event); }}
      sx={{ flex: 1, minWidth: 120, height: 28, display: "block", cursor: "pointer", touchAction: "none" }}>
      <rect x={0} y={periodTop} width={1000} height={16} rx={2} fill="rgba(250,250,250,0.05)" />
      {periods.map(period => (
        <rect key={period.start} x={x(period.start)} y={periodTop} width={Math.max(1, x(period.end) - x(period.start))} height={16}
          fill={periodColors[period.mode] ?? "#22c55e"} opacity={0.4} />
      ))}
      {runs.map(run => (
        <rect key={run.start} x={x(run.start)} y={20} width={Math.max(0.5, x(run.end) - x(run.start))} height={6}
          fill={stateColor(run.value, stateOrder)} opacity={0.8} />
      ))}
      <line x1={x(time)} x2={x(time)} y1={0} y2={28} stroke={logColors.cursor} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
    </Box>
  );
}
