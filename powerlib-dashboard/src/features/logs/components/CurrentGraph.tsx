import { useMemo } from "react";
import { Box, Stack, Typography } from "@mui/material";
import { slotMeans } from "../logModel";
import { logColors } from "../logUtils";
import type { PowerGroup } from "../logUtils";

type CurrentGraphProps = {
  groups: PowerGroup[];
  colorOf: (id: string) => string;
  time: number;
  windowSeconds?: number;
  height?: number;
};

/** The groups' supply current stacked over the graphs' time window, in amps. */
export function CurrentGraph({ groups, colorOf, time, windowSeconds = 20, height = 80 }: CurrentGraphProps) {
  // One y-axis scale over the whole log (the busiest 0.1 s), rounded up, so the chart doesn't rescale while it plays.
  const scale = useMemo(() => {
    if (!groups.length) return 10;
    const end = Math.max(...groups.map(group => group.current.times[group.current.times.length - 1] ?? 0));
    const slotted = groups.map(group => slotMeans(group.current, 0, end, 0.1).means);
    let peak = 10;
    for (let index = 0; index < slotted[0].length; index += 1) peak = Math.max(peak, slotted.reduce((sum, means) => sum + (Math.max(0, means[index]) || 0), 0));
    const magnitude = 10 ** Math.floor(Math.log10(peak));
    return Math.ceil(peak / (magnitude / 2)) * (magnitude / 2);
  }, [groups]);
  const width = 600;
  const slots = 200;
  const step = windowSeconds / slots;
  const from = time - windowSeconds / 2;
  // Fixed time slots (see slotMeans) so the stack slides smoothly instead of re-sampling noisy 100 Hz data each frame.
  const slotted = groups.map(group => slotMeans(group.current, from, from + windowSeconds, step));
  const starts = slotted[0]?.starts ?? [];
  const x = (start: number) => ((start + step / 2 - from) / windowSeconds) * width;
  const y = (amps: number) => height - (Math.min(amps, scale) / scale) * height;
  const floor = starts.map(() => 0);
  const areas = slotted.map(entry => {
    const lower = [...floor];
    entry.means.forEach((amps, index) => { floor[index] += Math.max(0, amps) || 0; });
    const upper = floor.map((value, index) => `${x(starts[index]).toFixed(1)},${y(value).toFixed(1)}`);
    const back = lower.map((value, index) => `${x(starts[index]).toFixed(1)},${y(value).toFixed(1)}`).reverse();
    return [...upper, ...back].join(" ");
  });
  return (
    <Stack direction="row" sx={{ gap: 0.75, flexShrink: 0 }}>
      <Stack sx={{ justifyContent: "space-between", height, textAlign: "right", minWidth: 40 }}>
        <Typography variant="caption" color="text.secondary">{Math.round(scale)} A</Typography>
        <Typography variant="caption" color="text.secondary">0</Typography>
      </Stack>
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Current per subsystem over time"
        sx={{ flex: 1, minWidth: 0, height, display: "block" }}>
        {areas.map((points, index) => <polygon key={groups[index].id} points={points} fill={colorOf(groups[index].id)} opacity={0.75} />)}
        <line x1={width / 2} x2={width / 2} y1={0} y2={height} stroke={logColors.cursor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      </Box>
    </Stack>
  );
}
