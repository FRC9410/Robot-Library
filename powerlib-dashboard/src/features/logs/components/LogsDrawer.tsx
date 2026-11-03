import type { ReactNode } from "react";
import { Drawer } from "@mui/material";
import { logsSurface } from "../logUtils";

type LogsDrawerProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** Slides in from the right over an open log, so another log can be picked without leaving this one. */
export function LogsDrawer({ open, onClose, children }: LogsDrawerProps) {
  return (
    // Above the app bar, which sits over drawers so the Robot tab's tuning drawer stays under it.
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: theme => theme.zIndex.modal }}
      slotProps={{ paper: { sx: { ...logsSurface, width: "min(100vw, 520px)", borderTop: 0, borderRight: 0, borderBottom: 0 } } }}>
      {children}
    </Drawer>
  );
}
