import type { ReactNode } from "react";
import { Paper, Stack, Typography } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

type LogCardProps = {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  sx?: SxProps<Theme>;
};

/** The frame every Logs widget sits in: a small title, an optional control on the right, then the content. */
export function LogCard({ title, action, children, sx }: LogCardProps) {
  return (
    <Paper variant="outlined" sx={[{ p: 1.5, borderRadius: 2, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", gap: 1 },
      ...(Array.isArray(sx) ? sx : [sx])]}>
      <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", gap: 1, minHeight: 28, flexShrink: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0 }}>{title}</Typography>
        {action}
      </Stack>
      {children}
    </Paper>
  );
}
