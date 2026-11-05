import { IconButton, Switch, TextField, Tooltip, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import type { CameraMount } from "../autoModel";
import { FieldRow } from "./FieldRow";
import { NumberField } from "./NumberField";

type CameraMountCardProps = {
  camera: CameraMount;
  color: string;
  onChange: (patch: Partial<CameraMount>) => void;
  onRemove: () => void;
};

/** One Limelight: its name, whether it counts, where it sits on the robot, and what it sees. */
export function CameraMountCard({ camera, color, onChange, onRemove }: CameraMountCardProps) {
  const number = (label: string, key: "x" | "y" | "z" | "yaw" | "pitch" | "hFov" | "vFov" | "imageWidth", unit: string, positive = false) =>
    <NumberField label={label} unit={unit} value={camera[key]} error={positive && camera[key] <= 0} onChange={value => onChange({ [key]: value ?? 0 })} />;
  return <section className="ab-camera">
    <FieldRow center>
      <span className="ab-camera-dot" style={{ background: color }} />
      <TextField size="small" label="Name" value={camera.name} sx={{ flex: 1 }} onChange={event => onChange({ name: event.target.value })} />
      <Tooltip title={camera.enabled ? "Counted in the tag view" : "Ignored, as if it were unplugged"}>
        <Switch checked={camera.enabled} onChange={event => onChange({ enabled: event.target.checked })}
          slotProps={{ input: { "aria-label": `Use ${camera.name}` } }} />
      </Tooltip>
      <IconButton size="small" aria-label={`Remove ${camera.name}`} onClick={onRemove}><DeleteIcon fontSize="small" /></IconButton>
    </FieldRow>
    <FieldRow>
      {number("X", "x", "m")}{number("Y", "y", "m")}{number("Z", "z", "m")}{number("Yaw", "yaw", "°")}{number("Pitch", "pitch", "°")}
    </FieldRow>
    <FieldRow>
      {number("Wide FOV", "hFov", "°", true)}{number("Tall FOV", "vFov", "°", true)}{number("Image width", "imageWidth", "px", true)}
    </FieldRow>
    <Typography variant="caption" color="text.secondary">
      A Limelight 3G or 4 sees 80° × 56°, a Limelight 2 59.6° × 49.7°. Check your model's datasheet, and use the
      detector resolution the pipeline runs at, not the stream size.
    </Typography>
  </section>;
}
