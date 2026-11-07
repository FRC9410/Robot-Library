import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { GeneratedSubsystem, GeneratedSwerveConstants } from "../subsystems/types";
import type { ConstantsFile } from "../constants/types";
import { formatNumericConstantValue } from "../constants/types";
import { localizationVariableMappings, type LocalizationConfig } from "../../../electron/localizationConfig";
type SaveTarget = "subsystem" | "swerve" | "localization" | "constant";
type ValuePathSegment = string | number;
type ValueContainer = Record<string | number, unknown>;
type SaveValue = number | boolean | string;
type SubsystemVariableValueKind = "number" | "boolean" | "brakeMode";

export type SaveValueChange = {
  id: string;
  selected: boolean;
  target: SaveTarget;
  label: string;
  oldValueText: string;
  newValue: SaveValue;
  subsystemIndex?: number;
  subsystemPath?: ValuePathSegment[];
  swervePath?: ValuePathSegment[];
  localizationPath?: ValuePathSegment[];
  constantsFileId?: string;
  constantName?: string;
};

export type LoadedDocuments = {
  subsystems: GeneratedSubsystem[];
  swerve: GeneratedSwerveConstants;
  localization: LocalizationConfig | null;
  constants: ConstantsFile[];
};

const subsystemVariablesPrefix = "/PowerLib/Subsystems/";
const swerveTopicName = "Swerve";

const subsystemVariableMappings: Record<
  string,
  { valuePath: ValuePathSegment[]; label: string; valueKind?: SubsystemVariableValueKind }
> = {
  "Control/FOCEnabled": { valuePath: ["focEnabled"], label: "FOC enabled", valueKind: "boolean" },
  "PID/kP": { valuePath: ["pid", "kP"], label: "PID kP" },
  "PID/kI": { valuePath: ["pid", "kI"], label: "PID kI" },
  "PID/kD": { valuePath: ["pid", "kD"], label: "PID kD" },
  "PID/kG": { valuePath: ["pid", "kG"], label: "PID kG" },
  "Feedforward/kS": { valuePath: ["pid", "kS"], label: "Feedforward kS" },
  "Feedforward/kV": { valuePath: ["pid", "kV"], label: "Feedforward kV" },
  "Feedforward/kA": { valuePath: ["pid", "kA"], label: "Feedforward kA" },
  "Feedforward/Torque": { valuePath: ["torqueFF"], label: "Torque feedforward" },
  "Cancoder/MagnetOffset": {
    valuePath: ["cancoder", "magnetOffset"],
    label: "CANcoder magnet offset"
  },
  "Cancoder/DiscontinuityPoint": {
    valuePath: ["cancoder", "discontinuityPoint"],
    label: "CANcoder discontinuity point"
  },
  "Ratios/SensorToMechanism": {
    valuePath: ["ratios", "sensorToMechanism"],
    label: "Sensor to mechanism ratio"
  },
  "Ratios/RotorToSensor": {
    valuePath: ["ratios", "rotorToSensor"],
    label: "Rotor to sensor ratio"
  },
  "MotionMagic/CruiseVelocity": {
    valuePath: ["motionMagic", "cruiseVelocity"],
    label: "Motion Magic cruise velocity"
  },
  "MotionMagic/Acceleration": {
    valuePath: ["motionMagic", "acceleration"],
    label: "Motion Magic acceleration"
  },
  "SlowMotionMagic/CruiseVelocity": {
    valuePath: ["slowMotionMagic", "cruiseVelocity"],
    label: "Slow Motion Magic cruise velocity"
  },
  "SlowMotionMagic/Acceleration": {
    valuePath: ["slowMotionMagic", "acceleration"],
    label: "Slow Motion Magic acceleration"
  },
  "Position/Default": {
    valuePath: ["absolutePosition", "default"],
    label: "Default position"
  }
};

const swerveVariableMappings: Record<string, { valuePath: ValuePathSegment[]; label: string }> = {
  "Driver/MaxSpeedCoefficient": {
    valuePath: ["driver", "maxSpeedCoefficient"],
    label: "Driver max speed coefficient"
  },
  "Driver/VelocityScale": {
    valuePath: ["driver", "velocityScale"],
    label: "Driver velocity scale"
  },
  "Driver/MaxAngularRateRadiansPerSecond": {
    valuePath: ["driver", "maxAngularRateRadiansPerSecond"],
    label: "Driver max angular rate"
  },
  "Driver/JoystickDeadband": {
    valuePath: ["driver", "joystickDeadband"],
    label: "Driver joystick deadband"
  },
  "Driver/SkewCompensation": {
    valuePath: ["driver", "skewCompensation"],
    label: "Driver skew compensation"
  },
  "Requests/MaxAngularRateRadiansPerSecond": {
    valuePath: ["requests", "maxAngularRateRadiansPerSecond"],
    label: "Request max angular rate"
  },
  "Requests/TranslationDeadbandMetersPerSecond": {
    valuePath: ["requests", "translationDeadbandMetersPerSecond"],
    label: "Request translation deadband"
  },
  "Requests/RotationalDeadbandRadiansPerSecond": {
    valuePath: ["requests", "rotationalDeadbandRadiansPerSecond"],
    label: "Request rotational deadband"
  },
  "DriveToPoint/MaxAngularRateRadiansPerSecond": {
    valuePath: ["driveToPoint", "maxAngularRateRadiansPerSecond"],
    label: "Drive-to-point max angular rate"
  },
  "DriveToPoint/MaxSpeedCoefficient": {
    valuePath: ["driveToPoint", "maxSpeedCoefficient"],
    label: "Drive-to-point max speed coefficient"
  },
  "DriveToPoint/SlowSpeedCoefficient": {
    valuePath: ["driveToPoint", "slowSpeedCoefficient"],
    label: "Drive-to-point slow speed coefficient"
  },
  "DriveToPoint/StaticFrictionConstant": {
    valuePath: ["driveToPoint", "staticFrictionConstant"],
    label: "Drive-to-point static friction"
  },
  "Heading/kP": {
    valuePath: ["heading", "kP"],
    label: "Heading kP"
  },
  "Heading/kI": {
    valuePath: ["heading", "kI"],
    label: "Heading kI"
  },
  "Heading/kD": {
    valuePath: ["heading", "kD"],
    label: "Heading kD"
  }
};

export function cloneValues<T>(value: T): T {
  return structuredClone(value);
}

function toPascalName(value: string | undefined) {
  return (value ?? "")
    .trim()
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function getSubsystemTopicName(subsystem: GeneratedSubsystem) {
  return toPascalName(subsystem.name || subsystem.id);
}

function parseVariableTopic(name: string, prefix: string) {
  if (!name.startsWith(prefix)) {
    return null;
  }

  const [ownerName, section, ...variableParts] = name.slice(prefix.length).split("/").filter(Boolean);
  if (!ownerName || section !== "Variables" || variableParts.length === 0) {
    return null;
  }

  return {
    ownerName,
    variableKey: variableParts.join("/")
  };
}

function getSubsystemVariableMapping(variableKey: string, subsystem: GeneratedSubsystem) {
  const staticMapping = subsystemVariableMappings[variableKey];
  if (staticMapping) {
    return {
      ...staticMapping,
      valueKind: staticMapping.valueKind ?? ("number" as const)
    };
  }

  const motorMatch = variableKey.match(/^Motors\/([^/]+)\/(BrakeMode|Reversed)$/);
  if (!motorMatch) {
    return null;
  }

  const canId = Number(motorMatch[1]);
  if (!Number.isFinite(canId)) {
    return null;
  }

  const motorIndex = (subsystem.motors ?? []).findIndex((motor) => Number(motor.id) === canId);
  if (motorIndex < 0) {
    return null;
  }

  if (motorMatch[2] === "BrakeMode") {
    return {
      valuePath: ["motors", motorIndex, "neutralMode"],
      label: `Motor ${canId} brake mode`,
      valueKind: "brakeMode" as const
    };
  }

  return {
    valuePath: ["motors", motorIndex, "reversed"],
    label: `Motor ${canId} reversed`,
    valueKind: "boolean" as const
  };
}

function getTopicNumber(topic: NtTopicSnapshot) {
  if (typeof topic.value === "number" && Number.isFinite(topic.value)) {
    return topic.value;
  }

  if (typeof topic.value === "string") {
    const parsed = Number(topic.value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function getTopicBoolean(topic: NtTopicSnapshot) {
  if (typeof topic.value === "boolean") {
    return topic.value;
  }

  if (typeof topic.value === "number" && Number.isFinite(topic.value)) {
    return topic.value !== 0;
  }

  if (typeof topic.value === "string") {
    return toBooleanOrNull(topic.value);
  }

  return null;
}

function getTopicValue(topic: NtTopicSnapshot, valueKind: SubsystemVariableValueKind) {
  if (valueKind === "number") {
    return getTopicNumber(topic);
  }

  const boolValue = getTopicBoolean(topic);
  if (boolValue === null) {
    return null;
  }

  return valueKind === "brakeMode" ? (boolValue ? "Brake" : "Coast") : boolValue;
}

function getNestedValue(root: unknown, path: ValuePathSegment[]) {
  let current = root as ValueContainer | undefined;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment] as ValueContainer | undefined;
  }
  return current;
}

function getEffectiveMotorNeutralMode(subsystem: GeneratedSubsystem, motorIndex: number) {
  const motors = subsystem.motors ?? [];
  const motorNeutralMode = motors[motorIndex]?.neutralMode;
  if (motorNeutralMode === "Brake" || motorNeutralMode === "Coast") {
    return motorNeutralMode;
  }

  const leader = motors.find((motor) => motor.role === "leader") ?? motors[0];
  return leader?.neutralMode === "Coast" ? "Coast" : "Brake";
}

function getSubsystemOldValue(
  subsystem: GeneratedSubsystem,
  mapping: { valuePath: ValuePathSegment[]; valueKind: SubsystemVariableValueKind }
) {
  const oldValue = getNestedValue(subsystem, mapping.valuePath);
  if (mapping.valueKind !== "brakeMode" || oldValue !== undefined) {
    return oldValue;
  }

  const [rootKey, motorIndex] = mapping.valuePath;
  if (rootKey === "motors" && typeof motorIndex === "number") {
    return getEffectiveMotorNeutralMode(subsystem, motorIndex);
  }

  return oldValue;
}

function getSwerveOldValue(swerve: GeneratedSwerveConstants, mapping: { valuePath: ValuePathSegment[] }) {
  return getNestedValue(swerve, mapping.valuePath);
}

export function setNestedValue(root: unknown, path: ValuePathSegment[], value: SaveValue) {
  let current = root as ValueContainer;
  path.slice(0, -1).forEach((segment, index) => {
    let next = current[segment] as ValueContainer | undefined;
    if (!next || typeof next !== "object") {
      next = {};
      current[segment] = next;
    }
    current = next;
  });
  current[path[path.length - 1]] = value;
}

function toNumberOrNull(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toBooleanOrNull(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "brake"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off", "coast"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

export function formatValue(value: unknown) {
  if (value === undefined) {
    return "unset";
  }
  if (value === null) {
    return "null";
  }
  return String(value);
}

function valuesDiffer(oldValue: unknown, newValue: SaveValue) {
  if (typeof newValue === "number") {
    const oldNumber = toNumberOrNull(oldValue);
    if (oldNumber === null) {
      return true;
    }

    return Math.abs(oldNumber - newValue) > 1.0e-9;
  }

  if (typeof newValue === "boolean") {
    const oldBoolean = toBooleanOrNull(oldValue);
    return oldBoolean === null || oldBoolean !== newValue;
  }

  return String(oldValue ?? "") !== newValue;
}

function buildSubsystemChanges(
  topics: NtTopicSnapshot[],
  subsystems: GeneratedSubsystem[],
  swerve: GeneratedSwerveConstants,
  localization: LocalizationConfig | null
) {
  const changes: SaveValueChange[] = [];

  topics.forEach((topic) => {
    const parsed = parseVariableTopic(topic.name, subsystemVariablesPrefix);
    if (!parsed) {
      return;
    }

    if (parsed.ownerName === "Vision") {
      const mapping = localizationVariableMappings[parsed.variableKey as keyof typeof localizationVariableMappings];
      const newValue = getTopicNumber(topic);
      if (mapping && newValue !== null && localization) {
        if (mapping.field === "targetAreaThreshold" ? newValue < 0 || newValue > 100 : newValue <= 0) return;
        const valuePath = [mapping.section, mapping.field];
        const oldValue = getNestedValue(localization, valuePath);
        if (valuesDiffer(oldValue, newValue)) changes.push({ id: topic.name, selected: true, target: "localization",
          label: `Localization: ${mapping.label}`, oldValueText: formatValue(oldValue), newValue, localizationPath: valuePath });
      }
      return;
    }

    if (parsed.ownerName === swerveTopicName) {
      const mapping = swerveVariableMappings[parsed.variableKey];
      const newValue = getTopicNumber(topic);
      if (!mapping || newValue === null) {
        return;
      }

      const oldValue = getSwerveOldValue(swerve, mapping);
      if (oldValue === undefined) return;
      if (!valuesDiffer(oldValue, newValue)) {
        return;
      }

      changes.push({
        id: topic.name,
        selected: true,
        target: "swerve",
        label: `Swerve: ${mapping.label}`,
        oldValueText: formatValue(oldValue),
        newValue,
        swervePath: mapping.valuePath
      });
      return;
    }

    const subsystemIndex = subsystems.findIndex((subsystem) => getSubsystemTopicName(subsystem) === parsed.ownerName);
    if (subsystemIndex < 0) {
      return;
    }

    const subsystem = subsystems[subsystemIndex];
    if (subsystem.sourceError) return;
    const mapping = getSubsystemVariableMapping(parsed.variableKey, subsystem);
    if (!mapping) {
      return;
    }

    const newValue = getTopicValue(topic, mapping.valueKind);
    if (newValue === null) {
      return;
    }

    const oldValue = getSubsystemOldValue(subsystem, mapping);
    if (!valuesDiffer(oldValue, newValue)) {
      return;
    }

    changes.push({
      id: topic.name,
      selected: true,
      target: "subsystem",
      label: `${subsystem.name || parsed.ownerName}: ${mapping.label}`,
      oldValueText: formatValue(oldValue),
      newValue,
      subsystemIndex,
      subsystemPath: mapping.valuePath
    });
  });

  return changes;
}

export function buildChanges(topics: NtTopicSnapshot[], documents: LoadedDocuments) {
  const constantChanges: SaveValueChange[] = [];
  for (const topic of topics) {
    const parsed = parseVariableTopic(topic.name, subsystemVariablesPrefix);
    const value = getTopicNumber(topic);
    if (!parsed || !parsed.variableKey.startsWith("Custom/") || value === null) continue;
    const name = parsed.variableKey.slice("Custom/".length);
    const file = documents.constants.find((candidate) => toPascalName(candidate.name) === parsed.ownerName);
    const row = file?.constants.find((candidate) => candidate.name === name && candidate.tunable);
    if (!file || !row) continue;
    let formatted: string;
    try { formatted = formatNumericConstantValue(value, row.type); } catch { continue; }
    if (row.value === formatted || !valuesDiffer(row.value.replace(/[fFLlDd]$/, ""), value)) continue;
    constantChanges.push({ id: topic.name, selected: true, target: "constant", label: `${parsed.ownerName}: ${name}`,
      oldValueText: row.value, newValue: value, constantsFileId: file.id, constantName: name });
  }
  return [...buildSubsystemChanges(topics, documents.subsystems, documents.swerve, documents.localization), ...constantChanges]
    .sort((left, right) => left.label.localeCompare(right.label));
}

