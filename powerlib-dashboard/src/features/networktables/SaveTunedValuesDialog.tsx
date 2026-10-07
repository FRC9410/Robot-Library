import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Stack,
  Typography
} from "@mui/material";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { GeneratedSubsystem, GeneratedSwerveConstants } from "../subsystems/types";
import type { ConstantsFile } from "../constants/types";
import { formatNumericConstantValue } from "../constants/types";

type SaveTarget = "subsystem" | "swerve" | "constant";
type JsonPathSegment = string | number;
type JsonContainer = Record<string | number, unknown>;
type SaveValue = number | boolean | string;
type SubsystemVariableValueKind = "number" | "boolean" | "brakeMode";

type SaveValueChange = {
  id: string;
  selected: boolean;
  target: SaveTarget;
  label: string;
  oldValueText: string;
  newValue: SaveValue;
  subsystemIndex?: number;
  subsystemPath?: JsonPathSegment[];
  swervePath?: JsonPathSegment[];
  constantsFileId?: string;
  constantName?: string;
};

type SaveTunedValuesDialogProps = {
  open: boolean;
  topics: NtTopicSnapshot[];
  onClose: () => void;
};

type LoadedDocuments = {
  subsystems: GeneratedSubsystem[];
  swerve: GeneratedSwerveConstants;
  constants: ConstantsFile[];
};

const subsystemVariablesPrefix = "/PowerLib/Subsystems/";
const swerveTopicName = "Swerve";

const subsystemVariableMappings: Record<
  string,
  { jsonPath: JsonPathSegment[]; label: string; valueKind?: SubsystemVariableValueKind }
> = {
  "Control/FOCEnabled": { jsonPath: ["focEnabled"], label: "FOC enabled", valueKind: "boolean" },
  "PID/kP": { jsonPath: ["pid", "kP"], label: "PID kP" },
  "PID/kI": { jsonPath: ["pid", "kI"], label: "PID kI" },
  "PID/kD": { jsonPath: ["pid", "kD"], label: "PID kD" },
  "PID/kG": { jsonPath: ["pid", "kG"], label: "PID kG" },
  "Feedforward/kS": { jsonPath: ["pid", "kS"], label: "Feedforward kS" },
  "Feedforward/kV": { jsonPath: ["pid", "kV"], label: "Feedforward kV" },
  "Feedforward/kA": { jsonPath: ["pid", "kA"], label: "Feedforward kA" },
  "Feedforward/Torque": { jsonPath: ["torqueFF"], label: "Torque feedforward" },
  "Cancoder/MagnetOffset": {
    jsonPath: ["cancoder", "magnetOffset"],
    label: "CANcoder magnet offset"
  },
  "Cancoder/DiscontinuityPoint": {
    jsonPath: ["cancoder", "discontinuityPoint"],
    label: "CANcoder discontinuity point"
  },
  "Ratios/SensorToMechanism": {
    jsonPath: ["ratios", "sensorToMechanism"],
    label: "Sensor to mechanism ratio"
  },
  "Ratios/RotorToSensor": {
    jsonPath: ["ratios", "rotorToSensor"],
    label: "Rotor to sensor ratio"
  },
  "MotionMagic/CruiseVelocity": {
    jsonPath: ["motionMagic", "cruiseVelocity"],
    label: "Motion Magic cruise velocity"
  },
  "MotionMagic/Acceleration": {
    jsonPath: ["motionMagic", "acceleration"],
    label: "Motion Magic acceleration"
  },
  "SlowMotionMagic/CruiseVelocity": {
    jsonPath: ["slowMotionMagic", "cruiseVelocity"],
    label: "Slow Motion Magic cruise velocity"
  },
  "SlowMotionMagic/Acceleration": {
    jsonPath: ["slowMotionMagic", "acceleration"],
    label: "Slow Motion Magic acceleration"
  },
  "Position/Default": {
    jsonPath: ["absolutePosition", "default"],
    label: "Default position"
  }
};

const defaultSwerveConstants: GeneratedSwerveConstants = {
  driver: {
    maxSpeedCoefficient: 0.75,
    velocityScale: 0.95,
    maxAngularRateRadiansPerSecond: 9.42477796076938,
    joystickDeadband: 0.1,
    skewCompensation: -0.03
  },
  requests: {
    maxAngularRateRadiansPerSecond: 4.71238898038469,
    translationDeadbandMetersPerSecond: 0.572,
    rotationalDeadbandRadiansPerSecond: 0.471238898038469
  },
  driveToPoint: {
    maxAngularRateRadiansPerSecond: 3.141592653589793,
    maxSpeedCoefficient: 0.75,
    slowSpeedCoefficient: 0.1875,
    staticFrictionConstant: 0.085
  },
  heading: {
    kP: 7,
    kI: 0,
    kD: 0
  }
};

const swerveVariableMappings: Record<string, { jsonPath: JsonPathSegment[]; label: string }> = {
  "Driver/MaxSpeedCoefficient": {
    jsonPath: ["driver", "maxSpeedCoefficient"],
    label: "Driver max speed coefficient"
  },
  "Driver/VelocityScale": {
    jsonPath: ["driver", "velocityScale"],
    label: "Driver velocity scale"
  },
  "Driver/MaxAngularRateRadiansPerSecond": {
    jsonPath: ["driver", "maxAngularRateRadiansPerSecond"],
    label: "Driver max angular rate"
  },
  "Driver/JoystickDeadband": {
    jsonPath: ["driver", "joystickDeadband"],
    label: "Driver joystick deadband"
  },
  "Driver/SkewCompensation": {
    jsonPath: ["driver", "skewCompensation"],
    label: "Driver skew compensation"
  },
  "Requests/MaxAngularRateRadiansPerSecond": {
    jsonPath: ["requests", "maxAngularRateRadiansPerSecond"],
    label: "Request max angular rate"
  },
  "Requests/TranslationDeadbandMetersPerSecond": {
    jsonPath: ["requests", "translationDeadbandMetersPerSecond"],
    label: "Request translation deadband"
  },
  "Requests/RotationalDeadbandRadiansPerSecond": {
    jsonPath: ["requests", "rotationalDeadbandRadiansPerSecond"],
    label: "Request rotational deadband"
  },
  "DriveToPoint/MaxAngularRateRadiansPerSecond": {
    jsonPath: ["driveToPoint", "maxAngularRateRadiansPerSecond"],
    label: "Drive-to-point max angular rate"
  },
  "DriveToPoint/MaxSpeedCoefficient": {
    jsonPath: ["driveToPoint", "maxSpeedCoefficient"],
    label: "Drive-to-point max speed coefficient"
  },
  "DriveToPoint/SlowSpeedCoefficient": {
    jsonPath: ["driveToPoint", "slowSpeedCoefficient"],
    label: "Drive-to-point slow speed coefficient"
  },
  "DriveToPoint/StaticFrictionConstant": {
    jsonPath: ["driveToPoint", "staticFrictionConstant"],
    label: "Drive-to-point static friction"
  },
  "Heading/kP": {
    jsonPath: ["heading", "kP"],
    label: "Heading kP"
  },
  "Heading/kI": {
    jsonPath: ["heading", "kI"],
    label: "Heading kI"
  },
  "Heading/kD": {
    jsonPath: ["heading", "kD"],
    label: "Heading kD"
  }
};

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
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
      jsonPath: ["motors", motorIndex, "neutralMode"],
      label: `Motor ${canId} brake mode`,
      valueKind: "brakeMode" as const
    };
  }

  return {
    jsonPath: ["motors", motorIndex, "reversed"],
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

function getNestedValue(root: unknown, path: JsonPathSegment[]) {
  let current = root as JsonContainer | undefined;
  for (const segment of path) {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    current = current[segment] as JsonContainer | undefined;
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
  mapping: { jsonPath: JsonPathSegment[]; valueKind: SubsystemVariableValueKind }
) {
  const oldValue = getNestedValue(subsystem, mapping.jsonPath);
  if (mapping.valueKind !== "brakeMode" || oldValue !== undefined) {
    return oldValue;
  }

  const [rootKey, motorIndex] = mapping.jsonPath;
  if (rootKey === "motors" && typeof motorIndex === "number") {
    return getEffectiveMotorNeutralMode(subsystem, motorIndex);
  }

  return oldValue;
}

function getSwerveOldValue(swerve: GeneratedSwerveConstants, mapping: { jsonPath: JsonPathSegment[] }) {
  const oldValue = getNestedValue(swerve, mapping.jsonPath);
  return oldValue === undefined ? getNestedValue(defaultSwerveConstants, mapping.jsonPath) : oldValue;
}

function setNestedValue(root: unknown, path: JsonPathSegment[], value: SaveValue) {
  let current = root as JsonContainer;
  path.slice(0, -1).forEach((segment, index) => {
    let next = current[segment] as JsonContainer | undefined;
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

function formatValue(value: unknown) {
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
  swerve: GeneratedSwerveConstants
) {
  const changes: SaveValueChange[] = [];

  topics.forEach((topic) => {
    const parsed = parseVariableTopic(topic.name, subsystemVariablesPrefix);
    if (!parsed) {
      return;
    }

    if (parsed.ownerName === swerveTopicName) {
      const mapping = swerveVariableMappings[parsed.variableKey];
      const newValue = getTopicNumber(topic);
      if (!mapping || newValue === null) {
        return;
      }

      const oldValue = getSwerveOldValue(swerve, mapping);
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
        swervePath: mapping.jsonPath
      });
      return;
    }

    const subsystemIndex = subsystems.findIndex((subsystem) => getSubsystemTopicName(subsystem) === parsed.ownerName);
    if (subsystemIndex < 0) {
      return;
    }

    const subsystem = subsystems[subsystemIndex];
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
      subsystemPath: mapping.jsonPath
    });
  });

  return changes;
}

function buildChanges(topics: NtTopicSnapshot[], documents: LoadedDocuments) {
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
  return [...buildSubsystemChanges(topics, documents.subsystems, documents.swerve), ...constantChanges]
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function SaveTunedValuesDialog({ open, topics, onClose }: SaveTunedValuesDialogProps) {
  const [documents, setDocuments] = useState<LoadedDocuments>({
    subsystems: [],
    swerve: {},
    constants: []
  });
  const [changes, setChanges] = useState<SaveValueChange[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selectedCount = useMemo(() => changes.filter((change) => change.selected).length, [changes]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadChanges();
    // Snapshot the current topic values when the dialog opens; users can close/reopen to refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function loadChanges() {
    setLoading(true);
    setSaving(false);
    setError(null);
    setMessage(null);

    try {
      if (!window.powerlib?.readSubsystems || !window.powerlib?.readConstants) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const [subsystemsResult, constants] = await Promise.all([window.powerlib.readSubsystems(), window.powerlib.readConstants()]);
      if (subsystemsResult.error) {
        throw new Error(subsystemsResult.error);
      }

      const loaded = {
        subsystems: subsystemsResult.subsystems as GeneratedSubsystem[],
        swerve: (subsystemsResult.swerve ?? {}) as GeneratedSwerveConstants,
        constants
      };
      setDocuments(loaded);
      setChanges(buildChanges(topics, loaded));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not compare tuned values.");
      setChanges([]);
    } finally {
      setLoading(false);
    }
  }

  function setAllSelected(selected: boolean) {
    setChanges((current) => current.map((change) => ({ ...change, selected })));
  }

  function toggleChange(id: string) {
    setChanges((current) =>
      current.map((change) => (change.id === id ? { ...change, selected: !change.selected } : change))
    );
  }

  async function saveSelectedChanges() {
    const selectedChanges = changes.filter((change) => change.selected);
    if (selectedChanges.length === 0) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!window.powerlib?.saveSubsystems || !window.powerlib?.saveConstants) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const nextSubsystems = cloneJson(documents.subsystems);
      const nextSwerve = cloneJson(documents.swerve);
      const nextConstants = cloneJson(documents.constants);
      const changedFiles = new Set<string>();
      const unselectedIds = new Set(changes.filter((change) => !change.selected).map((change) => change.id));
      let subsystemChanged = false;
      let swerveChanged = false;

      selectedChanges.forEach((change) => {
        if (change.target === "subsystem" && change.subsystemIndex !== undefined && change.subsystemPath) {
          setNestedValue(nextSubsystems[change.subsystemIndex], change.subsystemPath, change.newValue);
          subsystemChanged = true;
        }

        if (change.target === "swerve" && change.swervePath) {
          setNestedValue(nextSwerve, change.swervePath, change.newValue);
          swerveChanged = true;
        }
        if (change.target === "constant" && change.constantsFileId && change.constantName && typeof change.newValue === "number") {
          const file = nextConstants.find((candidate) => candidate.id === change.constantsFileId);
          const row = file?.constants.find((candidate) => candidate.name === change.constantName);
          if (!file || !row) throw new Error("Could not find the custom constant to save. Refresh the values.");
          row.value = formatNumericConstantValue(change.newValue, row.type);
          changedFiles.add(file.id);
        }
      });

      const savedDocuments = {
        subsystems: nextSubsystems,
        swerve: nextSwerve,
        constants: nextConstants
      };

      if (subsystemChanged || swerveChanged) {
        const result = await window.powerlib.saveSubsystems(nextSubsystems, nextSwerve);
        savedDocuments.subsystems = result.subsystems as GeneratedSubsystem[];
        savedDocuments.swerve = (result.swerve ?? nextSwerve) as GeneratedSwerveConstants;
      }
      for (const id of changedFiles) {
        const index = savedDocuments.constants.findIndex((file) => file.id === id);
        const file = savedDocuments.constants[index];
        const result = await window.powerlib.saveConstants(file.id, file.source, file.constants);
        if (result.error) throw new Error(result.error);
        savedDocuments.constants[index] = result;
      }

      setDocuments(savedDocuments);
      setChanges(
        buildChanges(topics, savedDocuments).map((change) => ({
          ...change,
          selected: !unselectedIds.has(change.id)
        }))
      );
      setMessage(
        `Saved ${selectedChanges.length} tuned value${selectedChanges.length === 1 ? "" : "s"}. Run Update Code when ready.`
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save tuned values.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Save Tuned Values</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          {loading && <LinearProgress />}
          {saving && <LinearProgress color="warning" />}
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}

          <Typography color="text.secondary">
            Review live NetworkTables tunables that differ from configured defaults. Select the values to save, then regenerate
            robot code when you are ready.
          </Typography>

          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button disabled={loading || saving || changes.length === 0} onClick={() => setAllSelected(true)} size="small">
              Check all
            </Button>
            <Button disabled={loading || saving || changes.length === 0} onClick={() => setAllSelected(false)} size="small">
              Uncheck all
            </Button>
            <Chip label={`${selectedCount} selected`} size="small" />
            <Chip label={`${changes.length} changed`} size="small" variant="outlined" />
          </Stack>

          {changes.length > 0 ? (
            <Stack spacing={1}>
              {changes.map((change) => (
                <Box
                  key={change.id}
                  component="label"
                  sx={{
                    alignItems: "center",
                    border: "1px solid",
                    borderColor: change.selected ? "primary.main" : "divider",
                    borderRadius: 1.5,
                    cursor: loading || saving ? "default" : "pointer",
                    display: "grid",
                    gap: 1.25,
                    gridTemplateColumns: { xs: "auto minmax(0, 1fr)", md: "auto minmax(0, 1fr) auto" },
                    p: 1.25,
                    ...(change.selected
                      ? {
                          bgcolor: "rgba(255, 204, 0, 0.08)"
                        }
                      : {
                          "&:hover": {
                            bgcolor: loading || saving ? "transparent" : "action.hover"
                          }
                        })
                  }}
                >
                  <Checkbox
                    checked={change.selected}
                    disabled={loading || saving}
                    onChange={() => toggleChange(change.id)}
                  />
                  <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>{change.label}</Typography>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
                      <Chip
                        label={
                          change.target === "subsystem"
                            ? "Subsystem JSON"
                            : change.target === "swerve" ? "Swerve JSON" : "Constants JSON"
                        }
                        size="small"
                        variant="outlined"
                      />
                      <Typography color="text.secondary" sx={{ fontFamily: "monospace" }} variant="body2">
                        {change.oldValueText} -&gt; {formatValue(change.newValue)}
                      </Typography>
                    </Stack>
                  </Stack>
                </Box>
              ))}
            </Stack>
          ) : (
            !loading && (
              <Alert severity="info" variant="outlined">
                No changed tunables were found. Apply tuned values first, then reopen or refresh this dialog.
              </Alert>
            )
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={() => void loadChanges()}>
          Refresh
        </Button>
        <Button disabled={saving} onClick={onClose}>
          Close
        </Button>
        <Button disabled={loading || saving || selectedCount === 0} onClick={() => void saveSelectedChanges()} variant="contained">
          Save selected
        </Button>
      </DialogActions>
    </Dialog>
  );
}
