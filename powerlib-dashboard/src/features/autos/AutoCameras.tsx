import { Alert, Button, Dialog, DialogContent, DialogTitle, IconButton, Stack, Switch, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import type { CameraMount } from "./autoModel";
import { newCamera } from "./autoModel";
import { NumberField } from "./AutoSteps";

/** The colors the field overlay and this dialog use, in camera order. */
export const cameraColors = ["#22d3ee", "#f472b6", "#a3e635", "#fbbf24"];

export const cameraColor = (cameras: CameraMount[], id: string) =>
  cameraColors[Math.max(0, cameras.findIndex(camera => camera.id === id)) % cameraColors.length];

/**
 * Where each Limelight sits on the robot. Power Tool can't read a Limelight's mount pose from the
 * robot project, so it is entered here and saved with the autos; the numbers are the same ones as
 * the Limelight web UI's robot-space camera pose.
 */
export function CameraDialog({ open, cameras, robotCameraNames, onChange, onClose }: {
  open: boolean;
  cameras: CameraMount[];
  /** Limelight names from the robot's VisionConstants, offered when a camera hasn't been added yet. */
  robotCameraNames: string[];
  onChange: (cameras: CameraMount[]) => void;
  onClose: () => void;
}) {
  const update = (id: string, patch: Partial<CameraMount>) =>
    onChange(cameras.map(camera => camera.id === id ? { ...camera, ...patch } : camera));
  const missing = robotCameraNames.filter(name => !cameras.some(camera => camera.name === name));

  return <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
      <span style={{ flex: 1 }}>Cameras</span>
      <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
    </DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Where each Limelight sits on the robot, measured from the robot's center: X forward, Y left, Z up from the carpet.
          Yaw turns it left, pitch tilts it up. These are the same numbers as the Limelight web UI's robot-space camera pose,
          and the tag view is only as right as they are.
        </Typography>
        {cameras.length === 0 && <Alert severity="info">Add a camera to see which tags the robot can use along an auto.</Alert>}
        {cameras.map((camera, index) => <section key={camera.id} className="ab-camera">
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <span className="ab-camera-dot" style={{ background: cameraColors[index % cameraColors.length] }} />
            <TextField size="small" label="Name" value={camera.name} sx={{ flex: 1 }}
              onChange={event => update(camera.id, { name: event.target.value })} />
            <Tooltip title={camera.enabled ? "Counted in the tag view" : "Ignored, as if it were unplugged"}>
              <Switch checked={camera.enabled} onChange={event => update(camera.id, { enabled: event.target.checked })}
                slotProps={{ input: { "aria-label": `Use ${camera.name}` } }} />
            </Tooltip>
            <IconButton size="small" aria-label={`Remove ${camera.name}`}
              onClick={() => onChange(cameras.filter(other => other.id !== camera.id))}><DeleteIcon fontSize="small" /></IconButton>
          </Stack>
          <Stack direction="row" spacing={1}>
            <NumberField label="X" unit="m" value={camera.x} onChange={value => update(camera.id, { x: value ?? 0 })} />
            <NumberField label="Y" unit="m" value={camera.y} onChange={value => update(camera.id, { y: value ?? 0 })} />
            <NumberField label="Z" unit="m" value={camera.z} onChange={value => update(camera.id, { z: value ?? 0 })} />
            <NumberField label="Yaw" unit="°" value={camera.yaw} onChange={value => update(camera.id, { yaw: value ?? 0 })} />
            <NumberField label="Pitch" unit="°" value={camera.pitch} onChange={value => update(camera.id, { pitch: value ?? 0 })} />
          </Stack>
          <Stack direction="row" spacing={1}>
            <NumberField label="Wide FOV" unit="°" value={camera.hFov} error={camera.hFov <= 0}
              onChange={value => update(camera.id, { hFov: value ?? 0 })} />
            <NumberField label="Tall FOV" unit="°" value={camera.vFov} error={camera.vFov <= 0}
              onChange={value => update(camera.id, { vFov: value ?? 0 })} />
            <NumberField label="Image width" unit="px" value={camera.imageWidth} error={camera.imageWidth <= 0}
              onChange={value => update(camera.id, { imageWidth: value ?? 0 })} />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            A Limelight 3G or 4 sees 80° × 56°, a Limelight 2 59.6° × 49.7°. Check your model's datasheet, and use the
            detector resolution the pipeline runs at, not the stream size.
          </Typography>
        </section>)}
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
