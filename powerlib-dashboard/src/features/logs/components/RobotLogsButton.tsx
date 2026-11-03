import { useState } from "react";
import { Button } from "@mui/material";
import type { ButtonProps } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import type { SavedLog } from "../logLibraryModel";
import { useRobotReachable } from "../useRobotReachable";
import { RobotLogsDialog } from "./RobotLogsDialog";

type RobotLogsButtonProps = {
  onOpenLog: (log: SavedLog) => void;
  onDownloaded?: () => void;
  /** Look of the button where it sits, like "contained" on the start page. */
  variant?: ButtonProps["variant"];
};

/** Get logs from robot: greyed out until the robot answers on SSH; opens the robot's list. */
export function RobotLogsButton({ onOpenLog, onDownloaded, variant = "text" }: RobotLogsButtonProps) {
  const host = useRobotReachable();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size={variant === "text" ? "small" : "medium"} variant={variant} startIcon={<DownloadIcon />} disabled={!host} onClick={() => setOpen(true)}
        sx={{ whiteSpace: "nowrap" }}>
        Get logs from robot
      </Button>
      <RobotLogsDialog open={open} onClose={() => setOpen(false)} onOpenLog={onOpenLog} onDownloaded={() => onDownloaded?.()} />
    </>
  );
}
