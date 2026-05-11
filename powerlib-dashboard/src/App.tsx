import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CableIcon from "@mui/icons-material/Cable";
import ConstructionIcon from "@mui/icons-material/Construction";
import DashboardIcon from "@mui/icons-material/Dashboard";
import DeleteIcon from "@mui/icons-material/Delete";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import InsightsIcon from "@mui/icons-material/Insights";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import {
  NtPrimitive,
  NtTopicSnapshot,
  NtTopicType,
  NtValue,
  PowerLibNt4Client
} from "./networktables/nt4Client";

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

type AppView = "networktables" | "subsystems";

type TargetPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
};

type GeneratedMotor = {
  role?: string;
  id?: number;
  motorType?: string;
  neutralMode?: string;
  reversed?: boolean;
};

type SubsystemFormMotor = {
  role: "leader" | "follower";
  id: string;
  motorType: string;
  reversed: boolean;
};

type GeneratedSubsystem = {
  id?: string;
  name?: string;
  type?: string;
  motors?: GeneratedMotor[];
  pid?: Record<string, number | string | null>;
  ratios?: {
    sensorToMechanism?: number | string;
    rotorToSensor?: number | string;
  };
  motionMagic?: Record<string, number | string | null>;
  cancoder?: {
    id?: number;
    magnetOffset?: number | string;
    discontinuityPoint?: number | string;
  };
  position?: {
    units?: string;
    default?: number | string | null;
  };
};

type SubsystemDocumentState = {
  loading: boolean;
  exists: boolean;
  path: string;
  subsystems: GeneratedSubsystem[];
  error: string | null;
};

type SubsystemFormState = {
  mode: "create" | "edit";
  index: number | null;
  id: string;
  name: string;
  type: "velocity" | "position";
  neutralMode: "Brake" | "Coast";
  motors: SubsystemFormMotor[];
  sensorToMechanism: string;
  rotorToSensor: string;
  kP: string;
  kI: string;
  kD: string;
  kG: string;
  kS: string;
  kV: string;
  kA: string;
  cruiseVelocity: string;
  acceleration: string;
  cancoderId: string;
  cancoderMagnetOffset: string;
  cancoderDiscontinuityPoint: string;
  positionUnits: string;
  defaultPosition: string;
};

type ToastState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

type CharacterizationCommand = {
  label: string;
  baseTopic: string;
  running: boolean;
};

const targetPresets: TargetPreset[] = [
  { id: "sim-localhost", label: "Local simulation", host: "localhost", port: 5810 },
  { id: "sim-loopback", label: "Loopback", host: "127.0.0.1", port: 5810 },
  { id: "robot-ip", label: "Robot radio / roboRIO IP", host: "10.94.10.2", port: 5810 },
  { id: "robot-mdns", label: "roboRIO mDNS", host: "roborio-9410-frc.local", port: 5810 },
  { id: "driver-station", label: "Driver Station laptop", host: "10.94.10.5", port: 5810 },
  { id: "custom", label: "Custom", host: "", port: 5810 }
];

const defaultTopics = [
  { name: "/SmartDashboard/PowerLib/Enabled", type: "boolean" as const, value: false },
  { name: "/SmartDashboard/PowerLib/TargetRPM", type: "double" as const, value: 0 },
  { name: "/SmartDashboard/PowerLib/Mode", type: "string" as const, value: "idle" }
];

const defaultPrefixes = ["/SmartDashboard/", "/Shuffleboard/", "/LiveWindow/", "/FMSInfo/"];

const motorTypes = ["X60", "X44"];

function toCamelCase(value: string) {
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

function toNumberText(value: unknown, fallback: string) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return String(value);
}

function generatedMotorToForm(motor: GeneratedMotor | undefined, index: number): SubsystemFormMotor {
  return {
    role: index === 0 ? "leader" : motor?.role === "leader" ? "leader" : "follower",
    id: toNumberText(motor?.id, ""),
    motorType: motor?.motorType === "X44" ? "X44" : "X60",
    reversed: Boolean(motor?.reversed)
  };
}

function createEmptyMotor(role: "leader" | "follower" = "follower"): SubsystemFormMotor {
  return {
    role,
    id: "",
    motorType: "X60",
    reversed: false
  };
}

function createEmptySubsystemForm(): SubsystemFormState {
  return {
    mode: "create",
    index: null,
    id: "",
    name: "",
    type: "velocity",
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
    cancoderId: "",
    cancoderMagnetOffset: "0.0",
    cancoderDiscontinuityPoint: "0.5",
    positionUnits: "rotations",
    defaultPosition: ""
  };
}

function subsystemToForm(subsystem: GeneratedSubsystem, index: number): SubsystemFormState {
  const motors = subsystem.motors?.length ? subsystem.motors : [{ role: "leader" as const }];
  const leader = motors.find((motor) => motor.role === "leader") ?? motors[0];
  return {
    mode: "edit",
    index,
    id: subsystem.id ?? toCamelCase(subsystem.name ?? ""),
    name: subsystem.name ?? "",
    type: subsystem.type === "position" ? "position" : "velocity",
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
    cancoderId: toNumberText(subsystem.cancoder?.id, ""),
    cancoderMagnetOffset: toNumberText(subsystem.cancoder?.magnetOffset, "0.0"),
    cancoderDiscontinuityPoint: toNumberText(subsystem.cancoder?.discontinuityPoint, "0.5"),
    positionUnits: subsystem.position?.units ?? "rotations",
    defaultPosition: toNumberText(subsystem.position?.default, "")
  };
}

function textToNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formToSubsystem(form: SubsystemFormState, existing?: GeneratedSubsystem): GeneratedSubsystem {
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

  return subsystem;
}

function stringifyValue(value: NtValue) {
  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer(${value.byteLength})`;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

function stringifyOptional(value: unknown) {
  return value === null || value === undefined || value === "" ? "-" : String(value);
}

function getCharacterizationName(value: string) {
  return value
    .trim()
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function getMotorSummary(subsystem: GeneratedSubsystem) {
  const motors = subsystem.motors ?? [];
  if (motors.length === 0) {
    return "-";
  }

  return motors
    .map((motor) => `${motor.role ?? "motor"} ${stringifyOptional(motor.id)}`)
    .join(", ");
}

function getPidSummary(subsystem: GeneratedSubsystem) {
  const pid = subsystem.pid ?? {};
  return ["kP", "kI", "kD", "kG"]
    .map((key) => `${key} ${stringifyOptional(pid[key])}`)
    .join(" / ");
}

function getMotorIdsSummary(subsystem: GeneratedSubsystem) {
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

function summarizeUpdateOutput(output: string) {
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

export function App() {
  const clientRef = useRef(new PowerLibNt4Client());
  const [activeView, setActiveView] = useState<AppView>("subsystems");
  const [targetId, setTargetId] = useState("sim-localhost");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(5810);
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [topics, setTopics] = useState<NtTopicSnapshot[]>([]);
  const [watchedPrefixes, setWatchedPrefixes] = useState<string[]>(["/SmartDashboard/"]);
  const [prefixInput, setPrefixInput] = useState("/SmartDashboard/");
  const [search, setSearch] = useState("");
  const [topicName, setTopicName] = useState("/SmartDashboard/PowerLib/TargetRPM");
  const [topicType, setTopicType] = useState<NtTopicType>("double");
  const [topicValue, setTopicValue] = useState("0");
  const [error, setError] = useState<string | null>(null);
  const [subsystemDocument, setSubsystemDocument] = useState<SubsystemDocumentState>({
    loading: false,
    exists: false,
    path: "",
    subsystems: [],
    error: null
  });
  const [subsystemForm, setSubsystemForm] = useState<SubsystemFormState | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info"
  });
  const [subsystemSaving, setSubsystemSaving] = useState(false);
  const [subsystemUpdatingCode, setSubsystemUpdatingCode] = useState(false);
  const [powerToolUpdating, setPowerToolUpdating] = useState(false);
  const [deleteSubsystemIndex, setDeleteSubsystemIndex] = useState<number | null>(null);
  const [characterizationOpen, setCharacterizationOpen] = useState(false);
  const updateSubsystemCodeRef = useRef<() => Promise<void>>(async () => {});
  const updatePowerToolRef = useRef<() => Promise<void>>(async () => {});

  const sortedTopics = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...topics]
      .filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [topics, search]);

  const characterizationCommands = useMemo<CharacterizationCommand[]>(() => {
    if (!subsystemForm?.name) {
      return [];
    }

    const characterizationName = getCharacterizationName(subsystemForm.name);
    const prefix = `/SmartDashboard/PowerLib/Characterization/${characterizationName}/`;
    return topics
      .filter((topic) => topic.name.startsWith(prefix) && topic.name.endsWith("/.type") && topic.value === "Command")
      .map((topic) => {
        const baseTopic = topic.name.slice(0, -"/.type".length);
        const label = baseTopic.slice(prefix.length);
        const runningTopic = topics.find((candidate) => candidate.name === `${baseTopic}/running`);

        return {
          label,
          baseTopic,
          running: runningTopic?.value === true
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [subsystemForm?.name, topics]);

  function showToast(message: string, severity: ToastState["severity"] = "info") {
    setToast({
      open: true,
      message,
      severity
    });
  }

  function updateSubsystemFormField<K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) {
    setSubsystemForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateSubsystemMotor(index: number, patch: Partial<SubsystemFormMotor>) {
    setSubsystemForm((current) => {
      if (!current) {
        return current;
      }

      const motors = current.motors.map((motor, motorIndex) => {
        if (motorIndex !== index) {
          return motor;
        }

        return {
          ...motor,
          ...patch,
          role: motorIndex === 0 ? "leader" : patch.role ?? motor.role
        };
      });

      return { ...current, motors };
    });
  }

  function addSubsystemMotor() {
    setSubsystemForm((current) =>
      current ? { ...current, motors: [...current.motors, createEmptyMotor("follower")] } : current
    );
  }

  function deleteSubsystemMotor(index: number) {
    if (index === 0) {
      return;
    }

    setSubsystemForm((current) =>
      current ? { ...current, motors: current.motors.filter((_, motorIndex) => motorIndex !== index) } : current
    );
  }

  async function loadSubsystems() {
    setSubsystemDocument((current) => ({ ...current, loading: true, error: null }));

    try {
      if (!window.powerlib?.readSubsystems) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const result = await window.powerlib.readSubsystems();
      setSubsystemDocument({
        loading: false,
        exists: result.exists,
        path: result.path,
        subsystems: result.subsystems as GeneratedSubsystem[],
        error: result.error ?? null
      });
    } catch (caught) {
      setSubsystemDocument((current) => ({
        ...current,
        loading: false,
        error: caught instanceof Error ? caught.message : "Could not load generated subsystems."
      }));
    }
  }

  async function saveSubsystems(subsystems: GeneratedSubsystem[]) {
    if (!window.powerlib?.saveSubsystems) {
      throw new Error("PowerLib file bridge is not available.");
    }

    const result = await window.powerlib.saveSubsystems(subsystems);
    setSubsystemDocument({
      loading: false,
      exists: result.exists,
      path: result.path,
      subsystems: result.subsystems as GeneratedSubsystem[],
      error: null
    });
  }

  async function saveSubsystemForm() {
    if (!subsystemForm) {
      return;
    }

    const existing =
      subsystemForm.mode === "edit" && subsystemForm.index !== null
        ? subsystemDocument.subsystems[subsystemForm.index]
        : undefined;
    const subsystem = formToSubsystem(subsystemForm, existing);
    if (!subsystem.name || !subsystem.id) {
      showToast("Subsystem name is required.", "error");
      return;
    }

    if (subsystem.motors?.some((motor) => !motor.id)) {
      showToast("Every motor needs a CAN ID.", "error");
      return;
    }

    setSubsystemSaving(true);
    try {
      const nextSubsystems = [...subsystemDocument.subsystems];
      if (subsystemForm.mode === "edit" && subsystemForm.index !== null) {
        nextSubsystems[subsystemForm.index] = subsystem;
      } else {
        nextSubsystems.push(subsystem);
      }

      await saveSubsystems(nextSubsystems);
      showToast(`Saved ${subsystem.name}. Use File > Update Code when you are ready to regenerate Java files.`, "success");
      setSubsystemForm(null);
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not save subsystem JSON.", "error");
    } finally {
      setSubsystemSaving(false);
    }
  }

  async function deleteSubsystem(index: number) {
    const subsystem = subsystemDocument.subsystems[index];
    setSubsystemSaving(true);
    try {
      await saveSubsystems(subsystemDocument.subsystems.filter((_, currentIndex) => currentIndex !== index));
      showToast(`Removed ${subsystem?.name ?? "subsystem"}. Use File > Update Code to reconcile generated Java files.`, "success");
      setDeleteSubsystemIndex(null);
      if (subsystemForm?.index === index) {
        setSubsystemForm(null);
      }
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not delete subsystem.", "error");
    } finally {
      setSubsystemSaving(false);
    }
  }

  async function updateSubsystemCode() {
    if (subsystemUpdatingCode) {
      return;
    }

    setSubsystemUpdatingCode(true);
    setSubsystemDocument((current) => ({ ...current, error: null }));

    try {
      if (!window.powerlib?.updateSubsystemCode) {
        throw new Error("PowerLib update bridge is not available.");
      }

      const result = await window.powerlib.updateSubsystemCode();
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      showToast(output ? summarizeUpdateOutput(output) : "Updated generated subsystem code.", "success");
      await loadSubsystems();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not update generated subsystem code.", "error");
    } finally {
      setSubsystemUpdatingCode(false);
    }
  }

  async function updatePowerTool() {
    if (powerToolUpdating) {
      return;
    }

    setPowerToolUpdating(true);
    setError(null);

    try {
      if (!window.powerlib?.updatePowerTool) {
        throw new Error("Power Tool updater is not available.");
      }

      await window.powerlib.updatePowerTool();
    } catch (caught) {
      setPowerToolUpdating(false);
      setError(caught instanceof Error ? caught.message : "Could not start Power Tool update.");
    }
  }

  updateSubsystemCodeRef.current = updateSubsystemCode;
  updatePowerToolRef.current = updatePowerTool;

  useEffect(() => {
    const removeUpdateSubsystemCode = window.powerlib?.onMenuUpdateSubsystemCode?.(() => {
      void updateSubsystemCodeRef.current();
    });
    const removeUpdatePowerTool = window.powerlib?.onMenuUpdatePowerTool?.(() => {
      void updatePowerToolRef.current();
    });

    return () => {
      removeUpdateSubsystemCode?.();
      removeUpdatePowerTool?.();
    };
  }, []);

  useEffect(() => {
    if (activeView === "subsystems" && !subsystemDocument.loading && !subsystemDocument.path) {
      void loadSubsystems();
    }
  }, [activeView, subsystemDocument.loading, subsystemDocument.path]);

  function upsertTopic(snapshot: NtTopicSnapshot) {
    setTopics((current) => {
      const existing = current.filter((topic) => topic.name !== snapshot.name);
      return [...existing, snapshot];
    });
  }

  function setPreset(id: string) {
    setTargetId(id);
    const preset = targetPresets.find((item) => item.id === id);
    if (preset && preset.id !== "custom") {
      setHost(preset.host);
      setPort(preset.port);
    }
  }

  function watchPrefix(prefix: string) {
    const normalized = prefix.endsWith("/") ? prefix : `${prefix}/`;
    if (!watchedPrefixes.includes(normalized)) {
      setWatchedPrefixes((current) => [...current, normalized]);
    }

    if (status === "connected" || status === "connecting") {
      clientRef.current.watchPrefix(normalized, upsertTopic);
    }
  }

  function watchCharacterizationPrefix() {
    if (!subsystemForm?.name) {
      return;
    }

    watchPrefix(`/SmartDashboard/PowerLib/Characterization/${getCharacterizationName(subsystemForm.name)}/`);
  }

  function connect() {
    setError(null);
    setStatus("connecting");

    try {
      clientRef.current.connect(host, port, (connected) => {
        setStatus(connected ? "connected" : "disconnected");
      });

      watchedPrefixes.forEach((prefix) => clientRef.current.watchPrefix(prefix, upsertTopic));
      defaultTopics.forEach((topic) => {
        clientRef.current.subscribe(topic.name, topic.type, topic.value, upsertTopic);
      });
    } catch (caught) {
      setStatus("disconnected");
      setError(caught instanceof Error ? caught.message : "Could not connect to NetworkTables.");
    }
  }

  function disconnect() {
    clientRef.current.disconnect();
    setStatus("idle");
    setTopics([]);
  }

  function parseValue(): NtPrimitive {
    if (topicType === "boolean") {
      return topicValue.trim().toLowerCase() === "true";
    }

    if (topicType === "double" || topicType === "int") {
      const parsed = Number(topicValue);
      return Number.isFinite(parsed) ? parsed : 0;
    }

    return topicValue;
  }

  function publishTopic(event: FormEvent) {
    event.preventDefault();
    setError(null);

    try {
      const value = parseValue();
      clientRef.current.publish(topicName, topicType, value);
      upsertTopic({ name: topicName, type: topicType, value });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not publish topic.");
    }
  }

  function runCharacterizationCommand(command: CharacterizationCommand) {
    setError(null);

    try {
      clientRef.current.publish(`${command.baseTopic}/running`, "boolean", true);
      upsertTopic({ name: `${command.baseTopic}/running`, type: "boolean", value: true });
      showToast(`Started ${command.label}.`, "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not start characterization command.", "error");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider", top: 0, zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Container maxWidth={false}>
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <ElectricBoltIcon color="primary" sx={{ fontSize: 34 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline" }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Power Tool
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  powered by Team 9410
                </Typography>
              </Stack>
            </Box>
            <Chip
              label={status}
              color={status === "connected" ? "success" : status === "connecting" ? "warning" : "default"}
              variant={status === "idle" ? "outlined" : "filled"}
            />
          </Toolbar>
          <Tabs value={activeView} onChange={(_, value) => setActiveView(value)} sx={{ minHeight: 44 }}>
            <Tab
              icon={<ConstructionIcon />}
              iconPosition="start"
              label="Subsystems"
              value="subsystems"
              sx={{ minHeight: 44 }}
            />
            <Tab
              icon={<DashboardIcon />}
              iconPosition="start"
              label="NetworkTables"
              value="networktables"
              sx={{ minHeight: 44 }}
            />
          </Tabs>
        </Container>
      </AppBar>

      <Dialog open={subsystemUpdatingCode}>
        <DialogTitle>Updating Code</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 360, py: 1 }}>
            <CircularProgress size={28} />
            <Typography>Please wait, code is updating.</Typography>
          </Stack>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteSubsystemIndex !== null} onClose={() => setDeleteSubsystemIndex(null)}>
        <DialogTitle>Delete Subsystem?</DialogTitle>
        <DialogContent>
          <Typography>
            Delete {deleteSubsystemIndex !== null ? subsystemDocument.subsystems[deleteSubsystemIndex]?.name ?? "this subsystem" : "this subsystem"}?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteSubsystemIndex(null)}>Cancel</Button>
          <Button
            color="error"
            variant="contained"
            onClick={() => {
              if (deleteSubsystemIndex !== null) {
                void deleteSubsystem(deleteSubsystemIndex);
              }
            }}
            disabled={subsystemSaving}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={characterizationOpen} maxWidth="sm" fullWidth>
        <DialogTitle>
          Characterization{subsystemForm?.name ? `: ${subsystemForm.name}` : ""}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            {status !== "connected" && (
              <Alert severity="warning" variant="outlined">
                Connect to NetworkTables to run characterization commands.
              </Alert>
            )}
            {status === "connected" && characterizationCommands.length === 0 && (
              <Alert severity="info" variant="outlined">
                No characterization commands found yet. Make sure robot code is running and code was updated after
                creating this velocity subsystem.
              </Alert>
            )}
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ flexWrap: "wrap" }}>
              {characterizationCommands.map((command) => (
                <Button
                  key={command.baseTopic}
                  startIcon={<PlayArrowIcon />}
                  variant="contained"
                  onClick={() => runCharacterizationCommand(command)}
                  disabled={status !== "connected" || command.running}
                  sx={{ minWidth: 210 }}
                >
                  {command.running ? `${command.label} running` : command.label}
                </Button>
              ))}
            </Stack>
            <Typography variant="body2" color="text.secondary">
              This dialog stays open until you close it.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={() => setCharacterizationOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((current) => ({ ...current, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <Container maxWidth={false} sx={{ py: 2 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

          {activeView === "networktables" && (
          <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" } }}>
            <Stack spacing={2}>
              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <CableIcon color="primary" />
                      <Typography variant="h6">NetworkTables Target</Typography>
                    </Stack>

                    <FormControl fullWidth size="small">
                      <InputLabel id="target-preset-label">Target</InputLabel>
                      <Select
                        labelId="target-preset-label"
                        label="Target"
                        value={targetId}
                        onChange={(event) => setPreset(event.target.value)}
                      >
                        {targetPresets.map((preset) => (
                          <MenuItem key={preset.id} value={preset.id}>
                            {preset.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <TextField
                      label="Host"
                      size="small"
                      value={host}
                      onChange={(event) => {
                        setTargetId("custom");
                        setHost(event.target.value);
                      }}
                    />
                    <TextField
                      label="NT4 port"
                      size="small"
                      type="number"
                      value={port}
                      onChange={(event) => setPort(Number(event.target.value))}
                    />

                    <Stack direction="row" spacing={1}>
                      <Button variant="contained" fullWidth onClick={connect}>
                        Connect
                      </Button>
                      <Button variant="outlined" fullWidth onClick={disconnect}>
                        Disconnect
                      </Button>
                    </Stack>

                    <Alert severity="info" variant="outlined">
                      For WPILib simulation, use Local simulation or Loopback. Team IP and roboRIO mDNS are for a real
                      robot. The Driver Station is only valid if that laptop is running a NetworkTables server.
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Stack spacing={2}>
                    <Typography variant="h6">Explore Prefixes</Typography>
                    <FormControl fullWidth size="small">
                      <InputLabel id="prefix-preset-label">Common prefix</InputLabel>
                      <Select
                        labelId="prefix-preset-label"
                        label="Common prefix"
                        value={prefixInput}
                        onChange={(event) => setPrefixInput(event.target.value)}
                      >
                        {defaultPrefixes.map((prefix) => (
                          <MenuItem key={prefix} value={prefix}>
                            {prefix}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      label="Prefix"
                      size="small"
                      value={prefixInput}
                      onChange={(event) => setPrefixInput(event.target.value)}
                    />
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => watchPrefix(prefixInput)}
                    >
                      Watch Prefix
                    </Button>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                      {watchedPrefixes.map((prefix) => (
                        <Chip key={prefix} label={prefix} size="small" />
                      ))}
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>

            <Card variant="outlined">
              <CardContent sx={{ p: 0 }}>
                <Stack spacing={0}>
                  <Box sx={{ p: 2 }}>
                    <Stack
                      direction={{ xs: "column", md: "row" }}
                      spacing={2}
                      sx={{ alignItems: { md: "center" } }}
                    >
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h6">NetworkTables Explorer</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Watching {watchedPrefixes.length} prefix{watchedPrefixes.length === 1 ? "" : "es"} and{" "}
                          {sortedTopics.length} visible topic{sortedTopics.length === 1 ? "" : "s"}.
                        </Typography>
                      </Box>
                      <TextField
                        label="Filter topics"
                        size="small"
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      <Button startIcon={<RefreshIcon />} variant="outlined" onClick={connect}>
                        Reconnect
                      </Button>
                    </Stack>
                  </Box>

                  <Divider />

                  <Box component="form" onSubmit={publishTopic} sx={{ p: 2 }}>
                    <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
                      <TextField
                        label="Topic"
                        size="small"
                        value={topicName}
                        onChange={(event) => setTopicName(event.target.value)}
                        sx={{ flexGrow: 1 }}
                      />
                      <FormControl size="small" sx={{ minWidth: 130 }}>
                        <InputLabel id="publish-type-label">Type</InputLabel>
                        <Select
                          labelId="publish-type-label"
                          label="Type"
                          value={topicType}
                          onChange={(event) => setTopicType(event.target.value as NtTopicType)}
                        >
                          <MenuItem value="double">double</MenuItem>
                          <MenuItem value="int">int</MenuItem>
                          <MenuItem value="boolean">boolean</MenuItem>
                          <MenuItem value="string">string</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField
                        label="Value"
                        size="small"
                        value={topicValue}
                        onChange={(event) => setTopicValue(event.target.value)}
                        sx={{ minWidth: 180 }}
                      />
                      <Button type="submit" variant="contained" endIcon={<SendIcon />}>
                        Publish
                      </Button>
                    </Stack>
                  </Box>

                  <TableContainer component={Paper} elevation={0} sx={{ maxHeight: "calc(100vh - 320px)" }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Topic</TableCell>
                          <TableCell sx={{ width: 130 }}>Type</TableCell>
                          <TableCell sx={{ width: "32%" }}>Value</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sortedTopics.map((topic) => (
                          <TableRow key={topic.name} hover>
                            <TableCell sx={{ fontFamily: "monospace" }}>{topic.name}</TableCell>
                            <TableCell>
                              <Chip label={topic.type} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell sx={{ fontFamily: "monospace", wordBreak: "break-word" }}>
                              {stringifyValue(topic.value)}
                            </TableCell>
                          </TableRow>
                        ))}
                        {sortedTopics.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={3}>
                              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                                Connect and watch a prefix to discover NetworkTables data.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Stack>
              </CardContent>
            </Card>
          </Box>
          )}

          {activeView === "subsystems" && (
            <Box
              sx={{
                display: "grid",
                gap: 2,
                gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
                height: { xs: "auto", md: "calc(100vh - 150px)" },
                minHeight: { md: 520 },
                overflow: { xs: "visible", md: "hidden" }
              }}
            >
              <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden" }}>
                <CardContent sx={{ height: "100%", overflowY: "auto" }}>
                  <Stack spacing={2}>
                    <Button
                      fullWidth
                      startIcon={<AddIcon />}
                      variant="contained"
                      onClick={() => setSubsystemForm(createEmptySubsystemForm())}
                    >
                      Create Subsystem
                    </Button>

                    <Button
                      fullWidth
                      startIcon={subsystemDocument.loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                      variant="outlined"
                      onClick={() => void loadSubsystems()}
                      disabled={subsystemDocument.loading}
                    >
                      Refresh
                    </Button>

                    <Divider />

                    <Typography variant="subtitle2" color="text.secondary">
                      Subsystem Configs
                    </Typography>

                    {subsystemDocument.error && <Alert severity="error">{subsystemDocument.error}</Alert>}

                    <Stack spacing={1}>
                      {subsystemDocument.subsystems.map((subsystem, index) => {
                        const selected = subsystemForm?.mode === "edit" && subsystemForm.index === index;
                        return (
                          <Button
                            key={subsystem.id ?? `${subsystem.name}-${index}`}
                            variant={selected ? "contained" : "outlined"}
                            color={selected ? "primary" : "inherit"}
                            onClick={() => setSubsystemForm(subsystemToForm(subsystem, index))}
                            sx={{
                              justifyContent: "flex-start",
                              minHeight: 64,
                              textAlign: "left",
                              textTransform: "none"
                            }}
                          >
                            <Stack spacing={0.25} sx={{ minWidth: 0 }}>
                              <Typography sx={{ fontWeight: 700 }}>{subsystem.name ?? "-"}</Typography>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Chip
                                  label={subsystem.type ?? "-"}
                                  size="small"
                                  variant={selected ? "filled" : "outlined"}
                                  sx={
                                    selected
                                      ? {
                                          bgcolor: "rgba(24, 24, 27, 0.18)",
                                          color: "primary.contrastText",
                                          fontWeight: 900
                                        }
                                      : { fontWeight: 800 }
                                  }
                                />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: selected ? "primary.contrastText" : "text.secondary",
                                    fontFamily: "monospace",
                                    fontWeight: 800
                                  }}
                                  noWrap
                                >
                                  {getMotorIdsSummary(subsystem)}
                                </Typography>
                              </Stack>
                            </Stack>
                          </Button>
                        );
                      })}

                      {subsystemDocument.subsystems.length === 0 && (
                        <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                          No subsystem configs yet.
                        </Typography>
                      )}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>

              <Stack sx={{ minHeight: 0 }}>
                <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden", flexGrow: 1 }}>
                  <CardContent sx={{ height: "100%", overflowY: "auto" }}>
                    {subsystemForm ? (
                      <Stack spacing={2}>
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                              <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="h6">
                                  {subsystemForm.mode === "create" ? "Create Subsystem" : `Edit ${subsystemForm.name || "Subsystem"}`}
                                </Typography>
                              </Box>
                              {subsystemForm.type === "velocity" && (
                                <Button
                                  startIcon={<InsightsIcon />}
                                  variant="outlined"
                                  onClick={() => {
                                    setCharacterizationOpen(true);
                                    watchCharacterizationPrefix();
                                  }}
                                >
                                  Characterization
                                </Button>
                              )}
                            </Stack>

                            <Divider />

                            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                              <TextField
                                label="Subsystem name"
                                size="small"
                                value={subsystemForm.name}
                                onChange={(event) =>
                                  setSubsystemForm((current) =>
                                    current
                                      ? {
                                          ...current,
                                          name: event.target.value,
                                          id: current.mode === "create" ? toCamelCase(event.target.value) : current.id
                                        }
                                      : current
                                  )
                                }
                                sx={{ flexGrow: 1 }}
                              />
                              <TextField
                                label="Stable ID"
                                size="small"
                                value={subsystemForm.id}
                                onChange={(event) =>
                                  setSubsystemForm((current) => (current ? { ...current, id: event.target.value } : current))
                                }
                                sx={{ minWidth: 220 }}
                              />
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel id="subsystem-type-label">Type</InputLabel>
                                <Select
                                  labelId="subsystem-type-label"
                                  label="Type"
                                  value={subsystemForm.type}
                                  onChange={(event) =>
                                    setSubsystemForm((current) =>
                                      current ? { ...current, type: event.target.value as "velocity" | "position" } : current
                                    )
                                  }
                                >
                                  <MenuItem value="velocity">velocity</MenuItem>
                                  <MenuItem value="position">position</MenuItem>
                                </Select>
                              </FormControl>
                            </Stack>

                            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                              <TextField
                                label="Sensor-to-mechanism ratio"
                                size="small"
                                type="number"
                                value={subsystemForm.sensorToMechanism}
                                onChange={(event) => updateSubsystemFormField("sensorToMechanism", event.target.value)}
                              />
                              <TextField
                                label="Rotor-to-mechanism ratio"
                                size="small"
                                type="number"
                                value={subsystemForm.rotorToSensor}
                                onChange={(event) => updateSubsystemFormField("rotorToSensor", event.target.value)}
                              />
                              <FormControl size="small" sx={{ minWidth: 160 }}>
                                <InputLabel id="subsystem-neutral-mode-label">Neutral mode</InputLabel>
                                <Select
                                  labelId="subsystem-neutral-mode-label"
                                  label="Neutral mode"
                                  value={subsystemForm.neutralMode}
                                  onChange={(event) =>
                                    updateSubsystemFormField("neutralMode", event.target.value as "Brake" | "Coast")
                                  }
                                >
                                  <MenuItem value="Brake">Brake</MenuItem>
                                  <MenuItem value="Coast">Coast</MenuItem>
                                </Select>
                              </FormControl>
                            </Stack>

                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Typography variant="subtitle1" sx={{ flexGrow: 1, fontWeight: 700 }}>
                                  Motors
                                </Typography>
                                <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addSubsystemMotor}>
                                  Add Motor
                                </Button>
                              </Stack>

                              <Box
                                sx={{
                                  display: "grid",
                                  gap: 1.5,
                                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 320px))",
                                  justifyContent: "start"
                                }}
                              >
                                {subsystemForm.motors.map((motor, motorIndex) => (
                                  <Card key={motorIndex} variant="outlined">
                                    <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                      <Stack spacing={1.5}>
                                        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                          <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                                            {motorIndex === 0 ? "Leader" : `Follower ${motorIndex}`}
                                          </Typography>
                                          {motorIndex > 0 && (
                                            <Button
                                              color="error"
                                              size="small"
                                              startIcon={<DeleteIcon />}
                                              onClick={() => deleteSubsystemMotor(motorIndex)}
                                            >
                                              Delete
                                            </Button>
                                          )}
                                        </Stack>

                                        <Stack spacing={1.5}>
                                          <TextField
                                            label="CAN ID"
                                            size="small"
                                            type="number"
                                            value={motor.id}
                                            onChange={(event) => updateSubsystemMotor(motorIndex, { id: event.target.value })}
                                            fullWidth
                                          />
                                          <FormControlLabel
                                            control={
                                              <Checkbox
                                                checked={motor.reversed}
                                                onChange={(event) =>
                                                  updateSubsystemMotor(motorIndex, { reversed: event.target.checked })
                                                }
                                              />
                                            }
                                            label="isReversed"
                                          />
                                          <FormControl size="small" fullWidth>
                                            <InputLabel id={`motor-type-${motorIndex}`}>Motor type</InputLabel>
                                            <Select
                                              labelId={`motor-type-${motorIndex}`}
                                              label="Motor type"
                                              value={motor.motorType}
                                              onChange={(event) =>
                                                updateSubsystemMotor(motorIndex, { motorType: event.target.value })
                                              }
                                            >
                                              {motorTypes.map((motorType) => (
                                                <MenuItem key={motorType} value={motorType}>
                                                  {motorType}
                                                </MenuItem>
                                              ))}
                                            </Select>
                                          </FormControl>
                                        </Stack>
                                      </Stack>
                                    </CardContent>
                                  </Card>
                                ))}
                              </Box>
                            </Stack>

                            {subsystemForm.type === "position" && (
                              <Stack spacing={1}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                  CANcoder
                                </Typography>
                                <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                                  <TextField
                                    label="CANcoder CAN ID"
                                    size="small"
                                    type="number"
                                    value={subsystemForm.cancoderId}
                                    onChange={(event) => updateSubsystemFormField("cancoderId", event.target.value)}
                                  />
                                  <TextField
                                    label="CANcoder magnet offset"
                                    size="small"
                                    type="number"
                                    value={subsystemForm.cancoderMagnetOffset}
                                    onChange={(event) => updateSubsystemFormField("cancoderMagnetOffset", event.target.value)}
                                  />
                                  <TextField
                                    label="CANcoder discontinuity point"
                                    size="small"
                                    type="number"
                                    value={subsystemForm.cancoderDiscontinuityPoint}
                                    onChange={(event) =>
                                      updateSubsystemFormField("cancoderDiscontinuityPoint", event.target.value)
                                    }
                                  />
                                  <TextField
                                    label="Position units"
                                    size="small"
                                    value={subsystemForm.positionUnits}
                                    onChange={(event) => updateSubsystemFormField("positionUnits", event.target.value)}
                                  />
                                  <TextField
                                    label="Default position"
                                    size="small"
                                    type="number"
                                    value={subsystemForm.defaultPosition}
                                    onChange={(event) => updateSubsystemFormField("defaultPosition", event.target.value)}
                                  />
                                </Stack>
                              </Stack>
                            )}

                            <Box
                              sx={{
                                display: "grid",
                                gap: 1.5,
                                gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(180px, 320px))" },
                                justifyContent: "start"
                              }}
                            >
                              <Card variant="outlined">
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                      PID
                                    </Typography>
                                    <TextField fullWidth label="kP" size="small" type="number" value={subsystemForm.kP} onChange={(event) => updateSubsystemFormField("kP", event.target.value)} />
                                    <TextField fullWidth label="kI" size="small" type="number" value={subsystemForm.kI} onChange={(event) => updateSubsystemFormField("kI", event.target.value)} />
                                    <TextField fullWidth label="kD" size="small" type="number" value={subsystemForm.kD} onChange={(event) => updateSubsystemFormField("kD", event.target.value)} />
                                    <TextField fullWidth label="kG" size="small" type="number" value={subsystemForm.kG} onChange={(event) => updateSubsystemFormField("kG", event.target.value)} />
                                  </Stack>
                                </CardContent>
                              </Card>

                              <Card variant="outlined">
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                      Feedforward
                                    </Typography>
                                    <TextField fullWidth label="kS" size="small" type="number" value={subsystemForm.kS} onChange={(event) => updateSubsystemFormField("kS", event.target.value)} />
                                    <TextField fullWidth label="kV" size="small" type="number" value={subsystemForm.kV} onChange={(event) => updateSubsystemFormField("kV", event.target.value)} />
                                    <TextField fullWidth label="kA" size="small" type="number" value={subsystemForm.kA} onChange={(event) => updateSubsystemFormField("kA", event.target.value)} />
                                  </Stack>
                                </CardContent>
                              </Card>

                              <Card variant="outlined">
                                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                                  <Stack spacing={1.5}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                      Motion Magic
                                    </Typography>
                                    <TextField fullWidth label="Acceleration" size="small" type="number" value={subsystemForm.acceleration} onChange={(event) => updateSubsystemFormField("acceleration", event.target.value)} />
                                    <TextField fullWidth label="Cruise velocity" size="small" type="number" value={subsystemForm.cruiseVelocity} onChange={(event) => updateSubsystemFormField("cruiseVelocity", event.target.value)} />
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Box>

                          </Stack>
                        ) : (
                          <Stack spacing={2} sx={{ alignItems: "center", justifyContent: "center", minHeight: 420, textAlign: "center" }}>
                            <ConstructionIcon color="primary" sx={{ fontSize: 48 }} />
                            <Box>
                              <Typography variant="h6">Select a subsystem config</Typography>
                              <Typography color="text.secondary">
                                Choose a config from the sidebar or create a new subsystem.
                              </Typography>
                            </Box>
                          </Stack>
                        )}
                  </CardContent>
                </Card>

                {subsystemForm && (
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={{
                      alignItems: "center",
                      borderTop: 1,
                      borderColor: "divider",
                      px: 0,
                      py: 1.5
                    }}
                  >
                    <Button
                      startIcon={subsystemSaving ? <CircularProgress size={18} /> : <SaveIcon />}
                      variant="contained"
                      onClick={saveSubsystemForm}
                      disabled={subsystemSaving}
                      >
                        Save Subsystem
                      </Button>
                      <Button variant="outlined" onClick={() => setSubsystemForm(null)}>
                        Cancel
                      </Button>
                      <Box sx={{ flexGrow: 1 }} />
                      {subsystemForm.mode === "edit" && subsystemForm.index !== null && (
                        <Button
                          color="error"
                        startIcon={<DeleteIcon />}
                          onClick={() => setDeleteSubsystemIndex(subsystemForm.index ?? 0)}
                          disabled={subsystemSaving}
                        >
                          Delete
                        </Button>
                    )}
                  </Stack>
                )}
              </Stack>
            </Box>
          )}
        </Stack>
      </Container>
    </Box>
  );
}
