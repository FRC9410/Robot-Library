import { Box, Typography } from "@mui/material";
import type { GeneratedSubsystem } from "../subsystems/types";

const labels: Record<string, string> = {
  name: "Name", type: "Control type", focEnabled: "FOC enabled", torqueFF: "Torque feedforward",
  statorCurrentLimitAmps: "Stator current limit (A)", pid: "PID & feedforward", ratios: "Gear ratios",
  motionMagic: "Motion Magic", slowMotionMagic: "Slow Motion Magic", cancoder: "CANcoder",
  absolutePosition: "Absolute position", relativePosition: "Relative position", motorType: "Motor type",
  neutralMode: "Neutral mode", sensorToMechanism: "Sensor to mechanism", rotorToSensor: "Rotor to sensor",
  kP: "kP", kI: "kI", kD: "kD", kG: "kG", kS: "kS", kV: "kV", kA: "kA"
};
function label(key: string) { return labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, char => char.toUpperCase()); }
function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function SubsystemDetails({ subsystem }: { subsystem: GeneratedSubsystem }) {
  const rows = Object.entries(subsystem).filter(([key, value]) => key !== "id" && (value === null || typeof value !== "object"));
  const groups = Object.entries(subsystem).filter(([, value]) => value && typeof value === "object");
  return <Box className="config-details">
    <DetailsGroup title="General" rows={rows} />
    {groups.map(([key, value]) => key === "motors"
      ? (value as NonNullable<GeneratedSubsystem["motors"]>).map((motor, index) => <DetailsGroup key={`motor-${index}`} title={index === 0 ? "Leader motor" : `Follower motor ${index}`} rows={Object.entries(motor).map(([name, item]) => [name === "id" ? "CAN ID" : name, item])} />)
      : <DetailsGroup key={key} title={label(key)} rows={Object.entries(value)} />)}
  </Box>;
}

function DetailsGroup({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return <Box className="config-detail-group">
    <Typography component="h4" variant="subtitle2">{title}</Typography>
    <Box component="dl">
      {rows.map(([key, value]) => <Box key={key} className="config-detail-row">
        <Typography component="dt" variant="body2" color="text.secondary">{label(key)}</Typography>
        <Typography component="dd" variant="body2">{valueText(value)}</Typography>
      </Box>)}
    </Box>
  </Box>;
}
