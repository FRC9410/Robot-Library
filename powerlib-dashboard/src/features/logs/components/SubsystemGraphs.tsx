import { Box, Typography, useMediaQuery } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { GraphView, LogMechanism } from "../logModel";
import { LogCard } from "./LogCard";
import { ScrollArea } from "./ScrollArea";
import { SubsystemPicker } from "./SubsystemPicker";
import { SubsystemPlot } from "./SubsystemPlot";

type SubsystemGraphsProps = {
  subsystems: LogMechanism[];
  selected: LogMechanism[];
  onSelect: (ids: string[]) => void;
  views: Record<string, GraphView>;
  onView: (id: string, view: GraphView) => void;
  time: number;
  windowSeconds?: number;
  /** Each subsystem's color, the same as in the Power card; undefined for one with no motors. */
  colorOf?: (id: string) => string | undefined;
  /** Draw each graph's line in its subsystem's color. */
  colorLines?: boolean;
  sx?: SxProps<Theme>;
};

/**
 * Every graph is the same fixed height, however many are picked; the tiles scroll when they don't fit. Tall windows
 * (1080p) get taller graphs so four tiles fill the column; 720p gets short ones so four still fit.
 */
const plotHeights = { short: 90, tall: 170 };
/** Wide enough for two tiles side by side (each needs about 250 px for its header and view buttons). */
const twoTilesWidth = 500;

/** Each picked subsystem gets its own graph tile on the same time window, so different units never share an axis. Tiles go two across when there's room. */
export function SubsystemGraphs({ subsystems, selected, onSelect, views, onView, time, windowSeconds = 20, colorOf, colorLines = false, sx }: SubsystemGraphsProps) {
  const plotHeight = useMediaQuery("(min-height: 1000px)") ? plotHeights.tall : plotHeights.short;
  if (subsystems.length === 0) {
    return (
      <LogCard title="Subsystem graphs" sx={sx}>
        <Typography variant="body2" color="text.secondary">No subsystems (Velocity or Position data) in this log.</Typography>
      </LogCard>
    );
  }
  return (
    <LogCard title="Subsystem graphs" action={<SubsystemPicker subsystems={subsystems} selected={selected} onSelect={onSelect} />} sx={sx}>
      {selected.length === 0 && <Typography variant="body2" color="text.secondary">Pick one or more subsystems to graph.</Typography>}
      <ScrollArea sx={{ containerType: "inline-size" }}>
        <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "minmax(0, 1fr)",
          [`@container (min-width: ${twoTilesWidth}px)`]: { gridTemplateColumns: "repeat(2, minmax(0, 1fr))" } }}>
          {selected.map(subsystem => (
            <SubsystemPlot key={subsystem.id} subsystem={subsystem} view={views[subsystem.id]} onView={view => onView(subsystem.id, view)}
              time={time} height={plotHeight} windowSeconds={windowSeconds} accent={colorOf?.(subsystem.id)} colorLine={colorLines} />
          ))}
        </Box>
      </ScrollArea>
    </LogCard>
  );
}
