import { useId } from "react";
import { Box, Stack, Typography } from "@mui/material";
import type { Series } from "../logModel";
import { areaPath, formatNumber, logColors, seriesPath } from "../logUtils";

type PlotChartProps = {
  series: Series<number>;
  setpoint?: Series<number>;
  /** Value range of the whole log, so the axis doesn't move while it plays. */
  min: number;
  max: number;
  places: number;
  time: number;
  windowSeconds: number;
  height: number;
  /** Draw each group of samples as their mean, at least this long per point (for noisy 100 Hz motor readings). */
  averageSeconds?: number;
  /** Line and shading color; defaults to the Logs value yellow. */
  color?: string;
  /** Thin lines drawn behind the main one, e.g. each motor behind their average. Hover one to see its name. */
  extraLines?: { key: string; label: string; color: string; series: Series<number> }[];
  /** Key of the extra line to draw bold (and shade) instead of the main line, which then goes thin. */
  focus?: string | null;
  label: string;
};

/** A line over the time window centered on `time`, shaded underneath, with an optional dashed setpoint and the axis ends labeled. */
export function PlotChart({ series, setpoint, min, max, places, time, windowSeconds, height, averageSeconds = 0, color = logColors.value, extraLines = [], focus = null, label }: PlotChartProps) {
  const fillId = useId();
  const width = 600;
  const span = Math.max(max - min, 1e-6);
  const low = min - span * 0.08;
  const high = max + span * 0.08;
  const from = time - windowSeconds / 2;
  const to = time + windowSeconds / 2;
  const x = (sample: number) => ((sample - from) / windowSeconds) * width;
  const y = (value: number) => height - ((value - low) / (high - low)) * height;
  const zero = low < 0 && high > 0 ? y(0) : null;
  const line = seriesPath(series, from, to, x, y, false, averageSeconds);
  const extraSeconds = Math.max(averageSeconds, 0.1);
  const focused = extraLines.find(extra => extra.key === focus);
  const boldLine = focused ? seriesPath(focused.series, from, to, x, y, false, extraSeconds) : line;
  const boldColor = focused ? focused.color : color;
  // Shade between the line and zero (or the nearer edge when zero is off the chart), not down to the bottom.
  const baseline = Math.min(height, Math.max(0, y(0)));
  const axis = (text: string) => <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10, lineHeight: 1 }}>{text}</Typography>;
  return (
    <Box>
      <Stack direction="row" sx={{ gap: 0.75, minWidth: 0 }}>
        <Stack sx={{ justifyContent: "space-between", height, textAlign: "right", minWidth: 32 }}>
          {axis(formatNumber(high, places))}
          {axis(formatNumber(low, places))}
        </Stack>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={label}
          sx={{ flex: 1, minWidth: 0, height, display: "block", borderRadius: 1, bgcolor: "rgba(255,255,255,0.02)" }}>
          <defs>
            <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={boldColor} stopOpacity={0.28} />
              <stop offset="1" stopColor={boldColor} stopOpacity={0} />
            </linearGradient>
          </defs>
          {[1 / 3, 2 / 3].map(fraction => (
            <line key={fraction} x1={0} x2={width} y1={height * fraction} y2={height * fraction} stroke={logColors.grid} strokeDasharray="2 4"
              vectorEffect="non-scaling-stroke" />
          ))}
          {zero !== null && <line x1={0} x2={width} y1={zero} y2={zero} stroke="rgba(250,250,250,0.25)" vectorEffect="non-scaling-stroke" />}
          {boldLine && <path d={areaPath(boldLine, baseline)} fill={`url(#${fillId})`} stroke="none" />}
          {extraLines.filter(extra => extra !== focused).map(extra => (
            <path key={extra.key} d={seriesPath(extra.series, from, to, x, y, false, extraSeconds)} fill="none" stroke={extra.color} strokeWidth={1}
              strokeOpacity={focused ? 0.2 : 0.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke">
              <title>{extra.label}</title>
            </path>
          ))}
          {setpoint && (
            <path d={seriesPath(setpoint, from, to, x, y, true)} fill="none" stroke={logColors.setpoint} strokeWidth={1.75} strokeDasharray="5 4"
              vectorEffect="non-scaling-stroke" />
          )}
          {focused && <path d={line} fill="none" stroke={color} strokeWidth={1.25} strokeOpacity={0.6} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
          <path d={boldLine} fill="none" stroke={boldColor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          <line x1={width / 2} x2={width / 2} y1={0} y2={height} stroke={logColors.cursor} strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
        </Box>
      </Stack>
      <Stack direction="row" sx={{ justifyContent: "space-between", pl: "38px", pt: 0.25 }}>
        {axis(`−${windowSeconds / 2} s`)}
        {axis("now")}
        {axis(`+${windowSeconds / 2} s`)}
      </Stack>
    </Box>
  );
}
