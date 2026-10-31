import type { MouseEvent, ReactNode } from "react";
import { Box, Checkbox, ListItemText, MenuItem, Paper, Select, Stack, Typography } from "@mui/material";
import { indexAt, segments, stepStats, toleranceFor, valueAt } from "./logModel";
import type { LogMarker, LogMechanism, LogPeriod, Series } from "./logModel";
import type { Pose } from "./wpilog";

export const logColors = {
  value: "#facc15",
  setpoint: "#a1a1aa",
  cursor: "#f97316",
  trail: "#34d399",
  grid: "rgba(250, 250, 250, 0.12)",
  good: "#22c55e",
  bad: "#ef4444"
};
const periodColors: Record<string, string> = { AUTO: "#3b82f6", TELEOP: "#22c55e", TEST: "#a855f7", ENABLED: "#22c55e" };
export const markerColors: Record<LogMarker["kind"], string> = { brownout: "#ef4444", setpoint: "#f59e0b", can: "#f59e0b" };
const statePalette = ["#60a5fa", "#f59e0b", "#a78bfa", "#34d399", "#f472b6", "#22d3ee", "#fb923c", "#a3e635"];
const idleStates = new Set(["", "IDLE", "DISABLED", "NONE"]);

export function stateColor(state: string, order: string[]) {
  if (idleStates.has(state.toUpperCase())) return "#52525b";
  return statePalette[Math.max(0, order.indexOf(state)) % statePalette.length];
}

export const formatNumber = (value: number | undefined, places = 1) =>
  value === undefined || !Number.isFinite(value) ? "–" : value.toFixed(places).replace(/^-(0(?:\.0+)?)$/, "$1");
export const formatClock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${Math.floor(seconds % 60).toString().padStart(2, "0")}.${Math.floor((seconds * 10) % 10)}`;

export function Card({ title, action, children }: { title: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, minWidth: 0, display: "flex", flexDirection: "column", gap: 1 }}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, minHeight: 28 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}

/**
 * One path through the visible samples; non-finite values break the line. When there are too many
 * samples to draw, it keeps every Nth sample of the whole log (not of the window), with N fixed by
 * the window length, so the same samples stay drawn while the window slides during playback.
 */
function seriesPath(series: Series<number>, from: number, to: number, x: (time: number) => number, y: (value: number) => number, stepped: boolean) {
  const count = series.times.length;
  const spacing = count > 1 ? (series.times[count - 1] - series.times[0]) / (count - 1) : 1;
  const stride = Math.max(1, Math.ceil((to - from) / Math.max(spacing, 1e-6) / 900));
  let first = Math.max(0, indexAt(series.times, from));
  first -= first % stride;
  const last = Math.min(count - 1, indexAt(series.times, to) + stride);
  if (last < first) return "";
  let path = "";
  let drawing = false;
  let previousY = 0;
  for (let index = first; index <= last; index += stride) {
    const value = series.values[index];
    if (!Number.isFinite(value)) { drawing = false; continue; }
    const px = x(series.times[index]).toFixed(1);
    const py = y(value).toFixed(1);
    if (!drawing) path += `M${px} ${py}`;
    else path += stepped ? `L${px} ${previousY.toFixed(1)}L${px} ${py}` : `L${px} ${py}`;
    drawing = true;
    previousY = y(value);
  }
  return path;
}

/** Each selected mechanism gets its own graph on the same time window, so different units never share an axis. */
export function MechanismGraphs({ mechanisms, selected, onSelect, time, windowSeconds = 20 }: {
  mechanisms: LogMechanism[]; selected: LogMechanism[]; onSelect: (ids: string[]) => void; time: number; windowSeconds?: number;
}) {
  if (mechanisms.length === 0) {
    return <Card title="Mechanisms"><Typography variant="body2" color="text.secondary">No mechanisms (Velocity or Position data) in this log.</Typography></Card>;
  }
  const height = selected.length <= 1 ? 200 : selected.length === 2 ? 120 : 88;
  const picker = (
    <Select multiple displayEmpty size="small" value={selected.map(item => item.id)}
      onChange={event => onSelect(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)}
      renderValue={ids => ids.length === 0 ? "Pick mechanisms" : ids.map(id => mechanisms.find(item => item.id === id)?.name ?? id).join(", ")}
      inputProps={{ "aria-label": "Mechanisms to graph" }}
      sx={{ minWidth: 220, maxWidth: 380, "& .MuiSelect-select": { py: 0.5, fontSize: 13 } }}>
      {mechanisms.map(item => (
        <MenuItem key={item.id} value={item.id} dense>
          <Checkbox size="small" checked={selected.some(chosen => chosen.id === item.id)} sx={{ p: 0.5, mr: 1 }} />
          <ListItemText primary={item.name} secondary={`${item.kind} · ${item.units}`} />
        </MenuItem>
      ))}
    </Select>
  );
  return (
    <Card title={`Mechanisms · ${windowSeconds} s window`} action={picker}>
      {selected.length === 0 && <Typography variant="body2" color="text.secondary">Pick one or more mechanisms to graph.</Typography>}
      {selected.map(mechanism => <MechanismPlot key={mechanism.id} mechanism={mechanism} time={time} height={height} windowSeconds={windowSeconds} />)}
      {selected.length > 0 && (
        <Stack direction="row" sx={{ justifyContent: "space-between", pl: 5.5 }}>
          <Typography variant="caption" color="text.secondary">−{windowSeconds / 2} s</Typography>
          <Typography variant="caption" color="text.secondary">now</Typography>
          <Typography variant="caption" color="text.secondary">+{windowSeconds / 2} s</Typography>
        </Stack>
      )}
    </Card>
  );
}

function MechanismPlot({ mechanism, time, height, windowSeconds }: { mechanism: LogMechanism; time: number; height: number; windowSeconds: number }) {
  const width = 600;
  const span = Math.max(mechanism.max - mechanism.min, 1e-6);
  const low = mechanism.min - span * 0.08;
  const high = mechanism.max + span * 0.08;
  const from = time - windowSeconds / 2;
  const to = time + windowSeconds / 2;
  const x = (sample: number) => ((sample - from) / windowSeconds) * width;
  const y = (value: number) => height - ((value - low) / (high - low)) * height;
  const zero = low < 0 && high > 0 ? y(0) : null;
  const places = mechanism.kind === "velocity" ? 1 : 2;
  return (
    <Box>
      <Stack direction="row" sx={{ justifyContent: "space-between", alignItems: "baseline", gap: 1, pl: 5.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 700 }}>{mechanism.name}</Typography>
        <Typography variant="caption" color="text.secondary">
          <Box component="span" sx={{ color: logColors.value }}>━</Box> {mechanism.kind === "velocity" ? "Velocity" : "Position"}{" "}
          <b>{formatNumber(valueAt(mechanism.value, time), places)}</b>
          {mechanism.setpoint && <> · <Box component="span" sx={{ color: logColors.setpoint }}>┅</Box> Setpoint <b>{formatNumber(valueAt(mechanism.setpoint, time), places)}</b></>}
          {" "}{mechanism.units}
        </Typography>
      </Stack>
      <Stack direction="row" sx={{ gap: 0.75, minWidth: 0 }}>
        <Stack sx={{ justifyContent: "space-between", height, textAlign: "right", minWidth: 36 }}>
          <Typography variant="caption" color="text.secondary">{formatNumber(high, places)}</Typography>
          {height >= 120 && <Typography variant="caption" color="text.secondary">{formatNumber((high + low) / 2, places)}</Typography>}
          <Typography variant="caption" color="text.secondary">{formatNumber(low, places)}</Typography>
        </Stack>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
          aria-label={`${mechanism.name} value and setpoint`} sx={{ flex: 1, minWidth: 0, height, display: "block" }}>
          {[0.25, 0.5, 0.75].map(fraction => (
            <line key={fraction} x1={0} x2={width} y1={height * fraction} y2={height * fraction} stroke={logColors.grid} vectorEffect="non-scaling-stroke" />
          ))}
          {zero !== null && <line x1={0} x2={width} y1={zero} y2={zero} stroke="rgba(250,250,250,0.3)" vectorEffect="non-scaling-stroke" />}
          {mechanism.setpoint && (
            <path d={seriesPath(mechanism.setpoint, from, to, x, y, true)} fill="none" stroke={logColors.setpoint}
              strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
          )}
          <path d={seriesPath(mechanism.value, from, to, x, y, false)} fill="none" stroke={logColors.value} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <line x1={width / 2} x2={width / 2} y1={0} y2={height} stroke={logColors.cursor} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        </Box>
      </Stack>
    </Box>
  );
}

export function FieldView({ pose, time, field }: { pose?: Series<Pose>; time: number; field: { length: number; width: number; flip: boolean } }) {
  if (!pose) {
    return <Card title="Field · Drive/Pose"><Typography variant="body2" color="text.secondary">No robot pose in this log.</Typography></Card>;
  }
  const { length, width } = field;
  const index = indexAt(pose.times, time);
  const current = index >= 0 ? pose.values[index] : undefined;
  const first = Math.max(0, indexAt(pose.times, time - 3));
  const trail = index >= 0 ? pose.values.slice(first, index + 1) : [];
  const stride = Math.max(1, Math.ceil(trail.length / 300));
  const points = trail.filter((_, sample) => sample % stride === 0 || sample === trail.length - 1)
    .map(sample => `${sample.x.toFixed(2)},${(width - sample.y).toFixed(2)}`).join(" ");
  const stale = index >= 0 && time - pose.times[index] > 1;
  return (
    <Card title="Field · Drive/Pose" action={current && (
      <Typography variant="caption" color="text.secondary">x {current.x.toFixed(2)} m · y {current.y.toFixed(2)} m · {((current.heading * 180) / Math.PI).toFixed(0)}°</Typography>
    )}>
      <Box component="svg" viewBox={`-0.1 -0.1 ${length + 0.2} ${width + 0.2}`} role="img" aria-label="Robot position on the field"
        sx={{ width: "100%", aspectRatio: `${length + 0.2} / ${width + 0.2}`, display: "block" }}>
        <g transform={field.flip ? `rotate(180 ${length / 2} ${width / 2})` : undefined}>
          <rect x={0} y={0} width={length} height={width} rx={0.15} fill="rgba(255,255,255,0.02)" stroke="rgba(250,250,250,0.35)" strokeWidth={0.04} />
          <line x1={length / 2} x2={length / 2} y1={0} y2={width} stroke="rgba(250,250,250,0.2)" strokeWidth={0.03} />
          <rect x={0} y={width * 0.3} width={0.6} height={width * 0.4} fill="#3b82f6" opacity={0.25} />
          <rect x={length - 0.6} y={width * 0.3} width={0.6} height={width * 0.4} fill="#ef4444" opacity={0.25} />
          {points && <polyline points={points} fill="none" stroke={logColors.trail} strokeWidth={0.07} strokeLinejoin="round" />}
          {current && (
            <g transform={`translate(${current.x} ${width - current.y}) rotate(${(-current.heading * 180) / Math.PI})`} opacity={stale ? 0.4 : 1}>
              <rect x={-0.4} y={-0.4} width={0.8} height={0.8} rx={0.08} fill="rgba(250,204,21,0.15)" stroke={logColors.value} strokeWidth={0.07} />
              <line x1={0} y1={0} x2={0.55} y2={0} stroke={logColors.value} strokeWidth={0.07} />
            </g>
          )}
        </g>
      </Box>
      <Typography variant="caption" color="text.secondary"><Box component="span" sx={{ color: logColors.trail }}>━</Box> Last 3 s</Typography>
    </Card>
  );
}

/** One row per selected mechanism: on target, value, setpoint, error, and the last step's overshoot and settle time. */
export function MechanismStatus({ mechanisms, time }: { mechanisms: LogMechanism[]; time: number }) {
  const labels = ["Mechanism", "At setpoint", "Value", "Setpoint", "Error", "Overshoot", "Settle time"];
  return (
    <Card title="Mechanism status · last setpoint step">
      {mechanisms.length === 0 ? (
        <Typography variant="body2" color="text.secondary">Pick mechanisms above to see their status.</Typography>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(110px, 1.4fr) repeat(6, minmax(0, 1fr))", columnGap: 1.5, rowGap: 0.75, alignItems: "center" }}>
          {labels.map(label => <Typography key={label} variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{label}</Typography>)}
          {mechanisms.map(mechanism => <StatusRow key={mechanism.id} mechanism={mechanism} time={time} />)}
        </Box>
      )}
    </Card>
  );
}

function StatusRow({ mechanism, time }: { mechanism: LogMechanism; time: number }) {
  const value = valueAt(mechanism.value, time);
  const target = valueAt(mechanism.setpoint, time);
  const logged = mechanism.atTarget ? valueAt(mechanism.atTarget, time) : undefined;
  const estimated = logged === undefined && target !== undefined && value !== undefined && Number.isFinite(target) && Number.isFinite(value)
    ? Math.abs(value - target) <= toleranceFor(mechanism, target) : undefined;
  const onTarget = logged ?? estimated;
  const stats = stepStats(mechanism, time);
  const places = mechanism.kind === "velocity" ? 1 : 2;
  const units = (text: string) => text === "–" ? text : `${text} ${mechanism.units}`;
  const cell = (text: string, color?: string) => <Typography variant="body2" sx={{ fontVariantNumeric: "tabular-nums", color }}>{text}</Typography>;
  return (
    <>
      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{mechanism.name}</Typography>
      <Box component="span" title={logged === undefined && estimated !== undefined ? "Estimated from value and setpoint" : undefined}
        sx={{ justifySelf: "start", px: 1, py: 0.25, borderRadius: 1, fontSize: 13, fontWeight: 700,
          bgcolor: onTarget === undefined ? "action.hover" : onTarget ? "rgba(34,197,94,0.18)" : "rgba(239,68,68,0.18)",
          color: onTarget === undefined ? "text.secondary" : onTarget ? logColors.good : logColors.bad }}>
        {onTarget === undefined ? "no setpoint" : `${onTarget}${logged === undefined ? " (est.)" : ""}`}
      </Box>
      {cell(units(formatNumber(value, places)))}
      {cell(units(formatNumber(target, places)))}
      {cell(units(formatNumber(value !== undefined && target !== undefined ? target - value : undefined, places)))}
      {cell(stats ? `${stats.overshootPercent.toFixed(0)}%` : "–")}
      {cell(stats ? stats.settleSeconds !== null ? `${stats.settleSeconds.toFixed(2)} s` : stats.settling ? "settling…" : "not settled" : "–",
        stats && stats.settleSeconds === null ? "#f59e0b" : undefined)}
    </>
  );
}

export function NumberTile({ title, value, units, places = 1, warn }: { title: string; value?: number; units?: string; places?: number; warn?: boolean }) {
  return (
    <Card title={title}>
      <Typography sx={{ fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: warn ? logColors.bad : "text.primary" }}>
        {formatNumber(value, places)}{value !== undefined && Number.isFinite(value) && units ? <Typography component="span" color="text.secondary" sx={{ ml: 0.5 }}>{units}</Typography> : null}
      </Typography>
    </Card>
  );
}

function seekFromClick(event: MouseEvent<SVGSVGElement>, duration: number, onSeek: (time: number) => void) {
  const box = event.currentTarget.getBoundingClientRect();
  onSeek(((event.clientX - box.left) / box.width) * duration);
}

export function StateStrip({ state, duration, time, onSeek }: { state?: Series<string>; duration: number; time: number; onSeek: (time: number) => void }) {
  if (!state || duration <= 0) {
    return <Card title="Drive/ActualState"><Typography variant="body2" color="text.secondary">No robot state in this log.</Typography></Card>;
  }
  const runs = segments(state, duration);
  const order = Array.from(new Set(state.values.filter(value => !idleStates.has(value.toUpperCase()))));
  const current = valueAt(state, time) ?? "";
  return (
    <Card title="Drive/ActualState" action={<Typography variant="caption" sx={{ fontWeight: 700 }}>{current || "–"}</Typography>}>
      <Box component="svg" viewBox="0 0 1000 24" preserveAspectRatio="none" role="img" aria-label="Robot state over time"
        onClick={(event: MouseEvent<SVGSVGElement>) => seekFromClick(event, duration, onSeek)}
        sx={{ width: "100%", height: 24, display: "block", cursor: "pointer" }}>
        {runs.map(run => (
          <rect key={run.start} x={(run.start / duration) * 1000} y={2} width={Math.max(0.5, ((run.end - run.start) / duration) * 1000)} height={20}
            fill={stateColor(run.value, order)} opacity={0.75} />
        ))}
        <line x1={(time / duration) * 1000} x2={(time / duration) * 1000} y1={0} y2={24} stroke={logColors.cursor} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      </Box>
      <Stack direction="row" sx={{ gap: 1.5, flexWrap: "wrap" }}>
        {order.slice(0, 10).map(name => (
          <Typography key={name} variant="caption" color="text.secondary">
            <Box component="span" sx={{ display: "inline-block", width: 10, height: 10, borderRadius: 0.5, bgcolor: stateColor(name, order), mr: 0.5 }} />{name}
          </Typography>
        ))}
      </Stack>
    </Card>
  );
}

export function TimelineBar({ periods, markers, duration, time, onSeek }: {
  periods: LogPeriod[]; markers: LogMarker[]; duration: number; time: number; onSeek: (time: number) => void;
}) {
  const x = (sample: number) => (duration > 0 ? (sample / duration) * 1000 : 0);
  return (
    <Box component="svg" viewBox="0 0 1000 34" preserveAspectRatio="none" role="img" aria-label="Match periods and problem markers"
      onClick={(event: MouseEvent<SVGSVGElement>) => seekFromClick(event, duration, onSeek)}
      sx={{ width: "100%", height: 34, display: "block", cursor: "pointer" }}>
      <rect x={0} y={14} width={1000} height={18} fill="rgba(250,250,250,0.05)" />
      {periods.map(period => (
        <rect key={period.start} x={x(period.start)} y={14} width={Math.max(1, x(period.end) - x(period.start))} height={18}
          fill={periodColors[period.mode] ?? "#22c55e"} opacity={0.35} />
      ))}
      {markers.map(marker => (
        <rect key={`${marker.kind}-${marker.time}-${marker.mechanismId ?? ""}`} x={x(marker.time) - 1.5} y={1} width={3} height={10} rx={1}
          fill={markerColors[marker.kind]} />
      ))}
      <line x1={x(time)} x2={x(time)} y1={0} y2={34} stroke={logColors.cursor} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
    </Box>
  );
}
