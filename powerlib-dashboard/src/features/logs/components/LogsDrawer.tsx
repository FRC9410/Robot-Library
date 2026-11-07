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
    // Above the app bar, but starts below the 40 px window title bar (`.window-titlebar`), which sits over every
    // drawer and dialog; at top 0 the title bar would hide the drawer's header and close button.
    <Drawer anchor="right" open={open} onClose={onClose} sx={{ zIndex: theme => theme.zIndex.modal }}
      slotProps={{ paper: { sx: { ...logsSurface, width: "min(100vw, 520px)", top: 40, height: "calc(100% - 40px)",
        borderTop: 0, borderRight: 0, borderBottom: 0 } } }}>
      {children}
    </Drawer>
  );
}
