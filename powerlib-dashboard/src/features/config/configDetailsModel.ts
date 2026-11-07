const labels: Record<string, string> = {
  name: "Name", type: "Control type", focEnabled: "FOC enabled", torqueFF: "Torque feedforward",
  statorCurrentLimitAmps: "Stator current limit (A)", pid: "PID & feedforward", ratios: "Gear ratios",
  motionMagic: "Motion Magic", slowMotionMagic: "Slow Motion Magic", cancoder: "CANcoder",
  absolutePosition: "Absolute position", relativePosition: "Relative position", motorType: "Motor type",
  neutralMode: "Neutral mode", sensorToMechanism: "Sensor to mechanism", rotorToSensor: "Rotor to sensor",
  kP: "kP", kI: "kI", kD: "kD", kG: "kG", kS: "kS", kV: "kV", kA: "kA"
};
export function label(key: string) { return labels[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, char => char.toUpperCase()); }
export function valueText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

