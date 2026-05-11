import type { NtValue } from "../../networktables/nt4Client";
import type { GeneratedMotor, GeneratedSubsystem, SubsystemFormMotor, SubsystemFormState } from "./types";

export const motorTypes = ["X60", "X44"];

export function toCamelCase(value: string) {
  const parts = value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean);

  return parts
    .map((part, index) => {
      const lower = part.toLowerCase();
      return index === 0 ? lower : `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
    })
    .join("");
}

export function toNumberText(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

export function generatedMotorToForm(motor: GeneratedMotor | undefined, index: number): SubsystemFormMotor {
  return {
    role: index === 0 ? "leader" : motor?.role === "leader" ? "leader" : "follower",
    id: toNumberText(motor?.id, ""),
    motorType: motor?.motorType === "X44" ? "X44" : "X60",
    reversed: Boolean(motor?.reversed)
  };
}

export function createEmptyMotor(role: "leader" | "follower" = "follower"): SubsystemFormMotor {
  return {
    role,
    id: "",
    motorType: "X60",
    reversed: false
  };
}

export function createEmptySubsystemForm(): SubsystemFormState {
  return {
    mode: "create",
    index: null,
    id: "",
    name: "",
    type: "velocity",
    focEnabled: true,
    torqueFF: "0.0",
    neutralMode: "Brake",
    motors: [createEmptyMotor("leader")],
    sensorToMechanism: "1.0",
    rotorToSensor: "1.0",
    kP: "0.0",
    kI: "0.0",
    kD: "0.0",
    kG: "0.0",
    kS: "0.0",
    kV: "0.0",
    kA: "0.0",
    cruiseVelocity: "0.0",
    acceleration: "0.0",
    slowCruiseVelocity: "0.0",
    slowAcceleration: "0.0",
    cancoderId: "",
    cancoderMagnetOffset: "0.0",
    cancoderDiscontinuityPoint: "0.5",
    positionUnits: "rotations",
    defaultPosition: "",
    homePosition: "0.0",
    forwardSoftLimit: "0.0",
    reverseSoftLimit: "0.0",
    slowThreshold: "0.0",
    tolerance: "0.05",
    stopVoltage: "0.0"
  };
}

export function subsystemToForm(subsystem: GeneratedSubsystem, index: number): SubsystemFormState {
  const motors = subsystem.motors?.length ? subsystem.motors : [{ role: "leader" as const }];
  const leader = motors.find((motor) => motor.role === "leader") ?? motors[0];
  return {
    mode: "edit",
    index,
    id: subsystem.id ?? toCamelCase(subsystem.name ?? ""),
    name: subsystem.name ?? "",
    type:
      subsystem.type === "position"
        ? "position"
        : subsystem.type === "velocityTorque"
          ? "velocityTorque"
          : subsystem.type === "absolutePosition"
          ? "absolutePosition"
          : "velocity",
    focEnabled: subsystem.focEnabled !== false,
    torqueFF: toNumberText(subsystem.torqueFF, "0.0"),
    neutralMode: leader?.neutralMode === "Coast" ? "Coast" : "Brake",
    motors: motors.map((motor, motorIndex) => generatedMotorToForm(motor, motorIndex)),
    sensorToMechanism: toNumberText(subsystem.ratios?.sensorToMechanism, "1.0"),
    rotorToSensor: toNumberText(subsystem.ratios?.rotorToSensor, "1.0"),
    kP: toNumberText(subsystem.pid?.kP, "0.0"),
    kI: toNumberText(subsystem.pid?.kI, "0.0"),
    kD: toNumberText(subsystem.pid?.kD, "0.0"),
    kG: toNumberText(subsystem.pid?.kG, "0.0"),
    kS: toNumberText(subsystem.pid?.kS, "0.0"),
    kV: toNumberText(subsystem.pid?.kV, "0.0"),
    kA: toNumberText(subsystem.pid?.kA, "0.0"),
    cruiseVelocity: toNumberText(subsystem.motionMagic?.cruiseVelocity, "0.0"),
    acceleration: toNumberText(subsystem.motionMagic?.acceleration, "0.0"),
    slowCruiseVelocity: toNumberText(subsystem.slowMotionMagic?.cruiseVelocity, "0.0"),
    slowAcceleration: toNumberText(subsystem.slowMotionMagic?.acceleration, "0.0"),
    cancoderId: toNumberText(subsystem.cancoder?.id, ""),
    cancoderMagnetOffset: toNumberText(subsystem.cancoder?.magnetOffset, "0.0"),
    cancoderDiscontinuityPoint: toNumberText(subsystem.cancoder?.discontinuityPoint, "0.5"),
    positionUnits: subsystem.position?.units ?? subsystem.absolutePosition?.units ?? "rotations",
    defaultPosition: toNumberText(subsystem.position?.default, ""),
    homePosition: toNumberText(subsystem.absolutePosition?.homePosition, "0.0"),
    forwardSoftLimit: toNumberText(subsystem.absolutePosition?.forwardSoftLimit, "0.0"),
    reverseSoftLimit: toNumberText(subsystem.absolutePosition?.reverseSoftLimit, "0.0"),
    slowThreshold: toNumberText(subsystem.absolutePosition?.slowThreshold, "0.0"),
    tolerance: toNumberText(subsystem.absolutePosition?.tolerance, "0.05"),
    stopVoltage: toNumberText(subsystem.absolutePosition?.stopVoltage, "0.0")
  };
}

export function textToNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formToSubsystem(form: SubsystemFormState, existing?: GeneratedSubsystem): GeneratedSubsystem {
  const id = form.id.trim() || toCamelCase(form.name);
  const motors = form.motors.map((motor, index) => ({
    role: index === 0 ? "leader" : motor.role,
    id: textToNumber(motor.id, 0),
    motorType: motor.motorType,
    neutralMode: index === 0 ? form.neutralMode : undefined,
    reversed: motor.reversed
  }));
  const subsystem: GeneratedSubsystem = {
    ...existing,
    id,
    name: form.name.trim(),
    type: form.type,
    focEnabled: form.focEnabled,
    torqueFF: form.type === "velocityTorque" ? textToNumber(form.torqueFF, 0) : 0,
    motors,
    pid: {
      kP: textToNumber(form.kP, 0),
      kI: textToNumber(form.kI, 0),
      kD: textToNumber(form.kD, 0),
      kG: textToNumber(form.kG, 0),
      kS: textToNumber(form.kS, 0),
      kV: textToNumber(form.kV, 0),
      kA: textToNumber(form.kA, 0)
    },
    ratios: {
      sensorToMechanism: textToNumber(form.sensorToMechanism, 1),
      rotorToSensor: textToNumber(form.rotorToSensor, 1)
    },
    motionMagic: {
      ...existing?.motionMagic,
      cruiseVelocity: textToNumber(form.cruiseVelocity, 0),
      acceleration: textToNumber(form.acceleration, 0)
    }
  };

  if (form.type === "position") {
    subsystem.cancoder = {
      id: textToNumber(form.cancoderId, 0),
      magnetOffset: textToNumber(form.cancoderMagnetOffset, 0),
      discontinuityPoint: textToNumber(form.cancoderDiscontinuityPoint, 0.5)
    };
    subsystem.motionMagic = {
      ...subsystem.motionMagic,
      cruiseVelocity: textToNumber(form.cruiseVelocity, 0)
    };
    subsystem.position = {
      units: form.positionUnits.trim() || "rotations",
      default: form.defaultPosition.trim() ? textToNumber(form.defaultPosition, 0) : null
    };
  }

  if (form.type === "absolutePosition") {
    subsystem.slowMotionMagic = {
      cruiseVelocity: textToNumber(form.slowCruiseVelocity, 0),
      acceleration: textToNumber(form.slowAcceleration, 0)
    };
    subsystem.absolutePosition = {
      units: form.positionUnits.trim() || "rotations",
      homePosition: textToNumber(form.homePosition, 0),
      forwardSoftLimit: textToNumber(form.forwardSoftLimit, 0),
      reverseSoftLimit: textToNumber(form.reverseSoftLimit, 0),
      slowThreshold: textToNumber(form.slowThreshold, 0),
      tolerance: textToNumber(form.tolerance, 0.05),
      stopVoltage: textToNumber(form.stopVoltage, 0)
    };
  }

  return subsystem;
}

export function stringifyValue(value: NtValue) {
  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer(${value.byteLength})`;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

export function stringifyOptional(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

export function getCharacterizationName(value: string) {
  return value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

export function getMotorSummary(subsystem: GeneratedSubsystem) {
  const motors = subsystem.motors ?? [];
  if (motors.length === 0) {
    return "-";
  }

  return motors
    .map((motor) => `${motor.role ?? "motor"} ${stringifyOptional(motor.id)}`)
    .join(", ");
}

export function getPidSummary(subsystem: GeneratedSubsystem) {
  const pid = subsystem.pid ?? {};
  return ["kP", "kI", "kD", "kG"]
    .map((key) => `${key} ${stringifyOptional(pid[key])}`)
    .join(" / ");
}

export function getMotorIdsSummary(subsystem: GeneratedSubsystem) {
  const ids = (subsystem.motors ?? [])
    .map((motor) => motor.id)
    .filter((id) => id !== null && id !== undefined && String(id).length > 0);
  const parts = [];

  if (ids.length > 0) {
    parts.push(`Motors ${ids.join(", ")}`);
  }

  if (subsystem.cancoder?.id !== null && subsystem.cancoder?.id !== undefined) {
    parts.push(`Sensor ${subsystem.cancoder.id}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "No CAN IDs";
}

export function summarizeUpdateOutput(output: string) {
  const generatedCount = output
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith("Generated "))
    .length;
  const buildTime = output.match(/BUILD SUCCESSFUL in ([^\r\n]+)/)?.[1];
  const warningCount = output.match(/(\d+) warning(?:s)?/i)?.[1];

  const parts = ["Generated subsystem code"];
  if (generatedCount > 0) {
    parts.push(`wrote ${generatedCount} Java file${generatedCount === 1 ? "" : "s"}`);
  }
  if (buildTime) {
    parts.push(`robot build passed in ${buildTime}`);
  } else if (output.includes("BUILD SUCCESSFUL")) {
    parts.push("robot build passed");
  }
  if (warningCount) {
    parts.push(`${warningCount} warning${warningCount === "1" ? "" : "s"}`);
  }

  return `${parts.join("; ")}.`;
}
