import { useMemo, useState } from "react";
import { Box } from "@mui/material";
import { averageAt, motorAverage, motorMetrics, motorSignalFor, valueAt } from "../logModel";
import type { GraphView, LogMechanism, MotorMetric } from "../logModel";
import { logColors, motorLineColor } from "../logUtils";
import { GraphViewSelector } from "./GraphViewSelector";
import { LineKey } from "./LineKey";
import { PlotChart } from "./PlotChart";
import { SubsystemPlotHeader } from "./SubsystemPlotHeader";

type SubsystemPlotProps = {
  subsystem: LogMechanism;
  view?: GraphView;
  onView: (view: GraphView) => void;
  time: number;
  height: number;
  windowSeconds: number;
  /** The subsystem's color (the same as in the Power card): a stripe down the tile's left edge. */
  accent?: string;
  /** Draw the line in `accent` instead of the Logs value yellow. */
  colorLine?: boolean;
};

const valueLabel = (subsystem: LogMechanism) => subsystem.kind === "velocity" ? "Velocity" : subsystem.kind === "position" ? "Position" : "Power";
/**
 * Motor readings worth a graph. With two or more motors the graph draws each motor thin and their average bold; with one
 * it's just that motor. Power has its own card and temperature is a number by the name.
 */
const graphMetrics: { metric: MotorMetric; label: string }[] = [
  { metric: "current", label: "Current" }, { metric: "voltage", label: "Voltage" }, { metric: "stator", label: "Stator" }
];

/** One subsystem's graph tile: title and value now, what it shows, and the chart. */
export function SubsystemPlot({ subsystem, view, onView, time, height, windowSeconds, accent, colorLine = false }: SubsystemPlotProps) {
  /** Motor key whose line is bold instead of the average; null for the average. */
  const [focus, setFocus] = useState<string | null>(null);
  const options = [
    ...(subsystem.kind !== "motors" ? [{ view: "value" as GraphView, label: valueLabel(subsystem) }] : []),
    ...graphMetrics.filter(({ metric }) => subsystem.metrics[metric]).map(({ metric, label }) => ({ view: metric as GraphView, label }))
  ];
  // Motor groups have no PowerLib value, so they open on current.
  const shownView: GraphView = view && options.some(option => option.view === view) ? view : options[0]?.view ?? "value";
  const perMotor = shownView === "current" || shownView === "voltage" || shownView === "stator";
  const average = useMemo(() => (perMotor && subsystem.motors.length > 1 ? motorAverage(subsystem.motors, motorSignalFor[shownView]) : undefined),
    [perMotor, shownView, subsystem.motors]);
  const metric = average ?? (shownView !== "value" ? subsystem.metrics[shownView] : undefined);
  const series = metric ?? subsystem.value;
  const motorLines = average && perMotor ? subsystem.motors.flatMap((motor, index) => {
    const motorSeries = motor.signals[motorSignalFor[shownView]];
    return motorSeries ? [{ key: motor.key, label: motor.label, color: motorLineColor(index), series: motorSeries, id: motor.id }] : [];
  }) : [];
  const focused = motorLines.find(line => line.key === focus);
  const lineColor = colorLine && accent ? accent : logColors.value;
  const showsSetpoint = shownView === "value" && subsystem.kind !== "motors";
  const setpoint = showsSetpoint ? subsystem.setpoint : undefined;
  const range = metric ?? subsystem;
  const places = subsystem.kind === "position" && shownView === "value" ? 2 : 1;
  return (
    // A bordered card per graph, so the eye sees where one ends and the next begins.
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, p: 1.25, borderRadius: 1.5, bgcolor: "rgba(255,255,255,0.02)", minWidth: 0,
      border: 1, borderColor: "rgba(250,250,250,0.1)", ...(accent ? { borderLeft: `3px solid ${accent}` } : {}) }}>
      <SubsystemPlotHeader name={subsystem.name} temp={subsystem.metrics.temp ? averageAt(subsystem.metrics.temp, time) : undefined}
        value={focused ? averageAt(focused.series, time) : metric ? averageAt(series, time) : valueAt(series, time)}
        units={shownView !== "value" ? `${motorMetrics[shownView].units}${focused ? ` #${focused.id}` : average ? " avg" : ""}` : subsystem.units}
        setpoint={showsSetpoint ? (setpoint ? valueAt(setpoint, time) : null) : undefined} places={places} />
      <GraphViewSelector options={options} value={shownView} name={subsystem.name} onChange={onView} />
      <PlotChart series={series} setpoint={setpoint} min={range.min} max={range.max} places={places} time={time} windowSeconds={windowSeconds}
        height={height} averageSeconds={metric ? 0.05 : 0} color={lineColor} extraLines={motorLines} focus={focused?.key ?? null} label={`${subsystem.name} ${shownView === "value" ? "value and setpoint" : shownView}`} />
      {motorLines.length > 0 && (
        <LineKey main={{ label: "Avg", color: lineColor }} focus={focused?.key ?? null} onFocus={setFocus}
          entries={motorLines.map(line => ({ key: line.key, label: `#${line.id}`, title: line.label, color: line.color }))} />
      )}
    </Box>
  );
}
