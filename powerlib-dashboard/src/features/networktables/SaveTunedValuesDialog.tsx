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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography
} from "@mui/material";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { GeneratedSubsystem } from "../subsystems/types";
import { methodNeedsValue, toBindingId, toConstantName } from "../bindings/bindingUtils";
import type { BindingCommand, GeneratedBinding } from "../bindings/types";

type SaveTarget = "subsystem" | "command";
type JsonPathSegment = string | number;
type JsonContainer = Record<string | number, unknown>;
type SaveValue = number | boolean | string;
type SubsystemVariableValueKind = "number" | "boolean" | "brakeMode";

type SaveValueChange = {
  id: string;
  selected: boolean;
  target: SaveTarget;
  label: string;
  topicName: string;
  oldValueText: string;
  newValue: SaveValue;
  subsystemIndex?: number;
  subsystemPath?: JsonPathSegment[];
  bindingIndex?: number;
  commandVariableKey?: string;
};

type SaveTunedValuesDialogProps = {
  open: boolean;
  topics: NtTopicSnapshot[];
  onClose: () => void;
};

type LoadedDocuments = {
  subsystems: GeneratedSubsystem[];
  bindings: GeneratedBinding[];
};

const subsystemVariablesPrefix = "/PowerLib/Subsystems/";
const commandVariablesPrefix = "/PowerLib/Commands/";

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
    jsonPath: ["position", "default"],
    label: "Default position"
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

function getBindingTopicName(binding: GeneratedBinding) {
  return toBindingId(binding.id || binding.name || "binding");
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

function getCommandKind(command: BindingCommand) {
  return command.kind === "sequence" ||
    command.kind === "parallel" ||
    command.kind === "parallelRace" ||
    command.kind === "wait"
    ? command.kind
    : "function";
}

function getCommandVariableKey(command: BindingCommand, subsystems: GeneratedSubsystem[]) {
  const kind = getCommandKind(command);
  if (kind === "wait") {
    return command.constantName ? `Wait/${toConstantName(command.constantName)}` : null;
  }

  if (kind !== "function" || !command.constantName || !methodNeedsValue(subsystems, command)) {
    return null;
  }

  const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
  if (!subsystem || !command.method) {
    return null;
  }

  return `${getSubsystemTopicName(subsystem)}/${command.method}/${toConstantName(command.constantName)}`;
}

function findCommandByVariableKey(
  commands: BindingCommand[] | undefined,
  subsystems: GeneratedSubsystem[],
  variableKey: string
): BindingCommand | null {
  for (const command of commands ?? []) {
    const kind = getCommandKind(command);
    if (kind === "sequence" || kind === "parallel" || kind === "parallelRace") {
      const childMatch = findCommandByVariableKey(command.children, subsystems, variableKey);
      if (childMatch) {
        return childMatch;
      }
      continue;
    }

    if (getCommandVariableKey(command, subsystems) === variableKey) {
      return command;
    }
  }

  return null;
}

function applyCommandValue(
  commands: BindingCommand[] | undefined,
  subsystems: GeneratedSubsystem[],
  variableKey: string,
  value: number
) {
  for (const command of commands ?? []) {
    const kind = getCommandKind(command);
    if (kind === "sequence" || kind === "parallel" || kind === "parallelRace") {
      applyCommandValue(command.children, subsystems, variableKey, value);
      continue;
    }

    if (getCommandVariableKey(command, subsystems) === variableKey) {
      command.value = value;
    }
  }
}

function buildSubsystemChanges(topics: NtTopicSnapshot[], subsystems: GeneratedSubsystem[]) {
  const changes: SaveValueChange[] = [];

  topics.forEach((topic) => {
    const parsed = parseVariableTopic(topic.name, subsystemVariablesPrefix);
    if (!parsed) {
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
      topicName: topic.name,
      oldValueText: formatValue(oldValue),
      newValue,
      subsystemIndex,
      subsystemPath: mapping.jsonPath
    });
  });

  return changes;
}

function buildCommandChanges(
  topics: NtTopicSnapshot[],
  bindings: GeneratedBinding[],
  subsystems: GeneratedSubsystem[]
) {
  const changes: SaveValueChange[] = [];

  topics.forEach((topic) => {
    const parsed = parseVariableTopic(topic.name, commandVariablesPrefix);
    const newValue = getTopicNumber(topic);
    if (!parsed || newValue === null) {
      return;
    }

    const bindingIndex = bindings.findIndex((binding) => getBindingTopicName(binding) === parsed.ownerName);
    if (bindingIndex < 0) {
      return;
    }

    const binding = bindings[bindingIndex];
    const command = findCommandByVariableKey(binding.commands, subsystems, parsed.variableKey);
    if (!command) {
      return;
    }

    if (!valuesDiffer(command.value, newValue)) {
      return;
    }

    changes.push({
      id: topic.name,
      selected: true,
      target: "command",
      label: `${binding.name || parsed.ownerName}: ${parsed.variableKey}`,
      topicName: topic.name,
      oldValueText: formatValue(command.value),
      newValue,
      bindingIndex,
      commandVariableKey: parsed.variableKey
    });
  });

  return changes;
}

function buildChanges(topics: NtTopicSnapshot[], documents: LoadedDocuments) {
  return [
    ...buildSubsystemChanges(topics, documents.subsystems),
    ...buildCommandChanges(topics, documents.bindings, documents.subsystems)
  ].sort((left, right) => left.label.localeCompare(right.label));
}

export function SaveTunedValuesDialog({ open, topics, onClose }: SaveTunedValuesDialogProps) {
  const [documents, setDocuments] = useState<LoadedDocuments>({ subsystems: [], bindings: [] });
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
      if (!window.powerlib?.readSubsystems || !window.powerlib?.readBindings) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const [subsystemsResult, bindingsResult] = await Promise.all([
        window.powerlib.readSubsystems(),
        window.powerlib.readBindings()
      ]);
      if (subsystemsResult.error) {
        throw new Error(subsystemsResult.error);
      }
      if (bindingsResult.error) {
        throw new Error(bindingsResult.error);
      }

      const loaded = {
        subsystems: subsystemsResult.subsystems as GeneratedSubsystem[],
        bindings: bindingsResult.bindings as GeneratedBinding[]
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
      if (!window.powerlib?.saveSubsystems || !window.powerlib?.saveBindings) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const nextSubsystems = cloneJson(documents.subsystems);
      const nextBindings = cloneJson(documents.bindings);
      const unselectedIds = new Set(changes.filter((change) => !change.selected).map((change) => change.id));
      let subsystemChanged = false;
      let commandChanged = false;

      selectedChanges.forEach((change) => {
        if (change.target === "subsystem" && change.subsystemIndex !== undefined && change.subsystemPath) {
          setNestedValue(nextSubsystems[change.subsystemIndex], change.subsystemPath, change.newValue);
          subsystemChanged = true;
        }

        if (
          change.target === "command" &&
          change.bindingIndex !== undefined &&
          change.commandVariableKey &&
          typeof change.newValue === "number"
        ) {
          applyCommandValue(
            nextBindings[change.bindingIndex].commands,
            nextSubsystems,
            change.commandVariableKey,
            change.newValue
          );
          commandChanged = true;
        }
      });

      const savedDocuments = {
        subsystems: nextSubsystems,
        bindings: nextBindings
      };

      if (subsystemChanged) {
        const result = await window.powerlib.saveSubsystems(nextSubsystems);
        savedDocuments.subsystems = result.subsystems as GeneratedSubsystem[];
      }
      if (commandChanged) {
        const result = await window.powerlib.saveBindings(nextBindings);
        savedDocuments.bindings = result.bindings as GeneratedBinding[];
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
            Review live NetworkTables tunables that differ from JSON defaults. Select the values to save, then regenerate
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
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>Value</TableCell>
                  <TableCell>File</TableCell>
                  <TableCell>Change</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {changes.map((change) => (
                  <TableRow key={change.id} hover selected={change.selected}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={change.selected}
                        disabled={loading || saving}
                        onChange={() => toggleChange(change.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5}>
                        <Typography>{change.label}</Typography>
                        <Typography color="text.secondary" sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                          {change.topicName}
                        </Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={change.target === "subsystem" ? "powerlib-subsystems.json" : "powerlib-bindings.json"}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ fontFamily: "monospace", whiteSpace: "nowrap" }}>
                        {change.oldValueText} -&gt; {formatValue(change.newValue)}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            !loading && (
              <Alert severity="info" variant="outlined">
                No changed tunables were found.
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
