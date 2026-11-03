import type { ReactNode } from "react";
import { Box } from "@mui/material";

type LogsLayoutProps = {
  graphs: ReactNode;
  field: ReactNode;
  power: ReactNode;
};

/** The Power card's width: enough for its header and the Subsystem / Current / Temp table, no more. */
const powerCardWidth = 400;

/**
 * Where the Logs tab's main widgets go: graphs, the field standing up, then the Power card at a fixed width. Each widget is
 * a standalone component, so trying another arrangement only changes this file.
 */
export function LogsLayout({ graphs, field, power }: LogsLayoutProps) {
  return (
    <Box sx={{ flex: 1, minHeight: 0, display: "grid", gap: 1.5, gridTemplateColumns: `minmax(0, 1fr) minmax(0, 0.5fr) ${powerCardWidth}px` }}>
      {graphs}
      {field}
      {power}
    </Box>
  );
}
