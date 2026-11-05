import type { ReactNode } from "react";
import { DialogTitle, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

type DialogTitleBarProps = {
  onClose: () => void;
  /** The title. */
  children: ReactNode;
};

/** A dialog title with a close button at the right. */
export function DialogTitleBar({ onClose, children }: DialogTitleBarProps) {
  return <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
    <span style={{ flex: 1 }}>{children}</span>
    <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
  </DialogTitle>;
}
