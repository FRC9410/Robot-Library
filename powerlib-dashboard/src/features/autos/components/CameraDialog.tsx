import { Alert, Button, Dialog, DialogContent, Stack, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { CameraMount } from "../autoModel";
import { newCamera } from "../autoModel";
import { cameraColors } from "../cameraColors";
import { CameraMountCard } from "./CameraMountCard";
import { DialogTitleBar } from "./DialogTitleBar";

type CameraDialogProps = {
  open: boolean;
  cameras: CameraMount[];
  /** Limelight names from the robot's VisionConstants, offered when a camera hasn't been added yet. */
  robotCameraNames: string[];
  onChange: (cameras: CameraMount[]) => void;
  onClose: () => void;
};

/**
 * Where each Limelight sits on the robot. Power Tool can't read a Limelight's mount pose from the
 * robot project, so it is entered here and saved with the autos; the numbers are the same ones as
 * the Limelight web UI's robot-space camera pose.
 */
export function CameraDialog({ open, cameras, robotCameraNames, onChange, onClose }: CameraDialogProps) {
  const update = (id: string, patch: Partial<CameraMount>) => onChange(cameras.map(camera => camera.id === id ? { ...camera, ...patch } : camera));
  const missing = robotCameraNames.filter(name => !cameras.some(camera => camera.name === name));

  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitleBar onClose={onClose}>Cameras</DialogTitleBar>
    <DialogContent>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Where each Limelight sits on the robot, measured from the robot's center: X forward, Y left, Z up from the carpet.
          Yaw turns it left, pitch tilts it up. These are the same numbers as the Limelight web UI's robot-space camera pose,
          and the tag view is only as right as they are.
        </Typography>
        {cameras.length === 0 && <Alert severity="info">Add a camera to see which tags the robot can use along an auto.</Alert>}
        {cameras.map((camera, index) => <CameraMountCard key={camera.id} camera={camera} color={cameraColors[index % cameraColors.length]}
          onChange={patch => update(camera.id, patch)} onRemove={() => onChange(cameras.filter(other => other.id !== camera.id))} />)}
        <Stack direction="row" spacing={1}>
          <Button size="small" startIcon={<AddIcon />} onClick={() => onChange([...cameras, newCamera(`Camera ${cameras.length + 1}`)])}>
            Add camera
          </Button>
          {missing.length > 0 && <Tooltip title="Add the Limelights named in the robot's VisionConstants, ready to be measured">
            <Button size="small" variant="outlined" onClick={() => onChange([...cameras, ...missing.map(newCamera)])}>
              Add {missing.join(", ")}
            </Button>
          </Tooltip>}
        </Stack>
      </Stack>
    </DialogContent>
  </Dialog>;
}
