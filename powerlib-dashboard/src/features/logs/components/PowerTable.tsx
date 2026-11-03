import { useState } from "react";
import { Box, Typography } from "@mui/material";
import type { LogMechanism } from "../logModel";
import { PowerTableRow } from "./PowerTableRow";
import { ScrollArea } from "./ScrollArea";

type PowerTableProps = {
  subsystems: LogMechanism[];
  colorOf: (id: string) => string;
  time: number;
};

const labels = ["", "Subsystem", "Current", "Temp"];

/** Current and temperature per subsystem. One subsystem's motors can be open at a time, so the table stays short. */
export function PowerTable({ subsystems, colorOf, time }: PowerTableProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ScrollArea>
      <Box sx={{ display: "grid", gridTemplateColumns: "28px minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr)", columnGap: 1, rowGap: 0.5, alignItems: "center" }}>
        {labels.map(label => <Typography key={label} variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 700 }}>{label}</Typography>)}
        {subsystems.map(subsystem => (
          <PowerTableRow key={subsystem.id} subsystem={subsystem} color={colorOf(subsystem.id)} time={time} open={openId === subsystem.id}
            onToggle={() => setOpenId(current => current === subsystem.id ? null : subsystem.id)} />
        ))}
      </Box>
    </ScrollArea>
  );
}
