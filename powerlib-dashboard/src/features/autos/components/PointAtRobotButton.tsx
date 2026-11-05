import { Button, Tooltip } from "@mui/material";
import MyLocationIcon from "@mui/icons-material/MyLocation";

type PointAtRobotButtonProps = {
  /** A robot is connected and reporting its pose. */
  robotConnected: boolean;
  disabled: boolean;
  onClick: () => void;
};

/** Adds a drive point where the connected robot is. */
export function PointAtRobotButton({ robotConnected, disabled, onClick }: PointAtRobotButtonProps) {
  return <Tooltip title={robotConnected ? "Insert a drive point at the robot's live position" : "Connect to a robot to use its position"}>
    <span>
      <Button size="small" startIcon={<MyLocationIcon />} disabled={disabled} sx={{ whiteSpace: "nowrap" }} onClick={onClick}>Point at robot</Button>
    </span>
  </Tooltip>;
}
