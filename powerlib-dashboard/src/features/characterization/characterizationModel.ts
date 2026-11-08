import type { ControlMode, RobotStatus, Target } from "../../../electron/characterization/types";

export function characterizationControlMode(status: RobotStatus | null): ControlMode | null {
  if (!status) return null;
  if (!status.simulation) return "driver-station";
  return status.controlMode === "simulation" || status.controlMode === "driver-station" ? status.controlMode : null;
}

function decode(value: unknown): unknown {
  try { return typeof value === "string" ? JSON.parse(value) : null; }
  catch { return null; }
}

export function readCharacterizationStatus(value: unknown): RobotStatus | null {
  const data = decode(value) as Partial<RobotStatus> | null;
  if (!data || data.version !== 1) return null;
  if (![data.id, data.target, data.phase, data.state, data.error, data.file].every(item => typeof item === "string")) return null;
  if (![data.simulation, data.enabled, data.test, data.fms, data.estop].every(item => typeof item === "boolean")) return null;
  return data as RobotStatus;
}

export function readCharacterizationCatalog(value: unknown): Target[] {
  const data = decode(value);
  if (!Array.isArray(data)) return [];
  return data.filter((target): target is Target => target &&
    [target.id, target.group, target.name].every(item => typeof item === "string" && item.length > 0) &&
    ["velocity", "velocityTorque", "drive", "steer"].includes(target.kind) &&
    Array.isArray(target.motors) && target.motors.length > 0 && target.motors.every((name: unknown) => typeof name === "string"));
}
