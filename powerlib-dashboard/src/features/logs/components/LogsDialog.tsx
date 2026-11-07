import type { ReactNode } from "react";
import { Dialog } from "@mui/material";
import { logsSurface } from "../logUtils";

type LogsDialogProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
};

/** The logs list as a popup in the middle of the window, opened from the start page's Open log button. */
export function LogsDialog({ open, onClose, children }: LogsDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md"
      slotProps={{ paper: { sx: { ...logsSurface, height: "min(80vh, 760px)", borderRadius: 2 } } }}>
      {children}
    </Dialog>
  );
}
