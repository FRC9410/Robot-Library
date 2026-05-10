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
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
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
import EditIcon from "@mui/icons-material/Edit";
import HubIcon from "@mui/icons-material/Hub";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import TerminalIcon from "@mui/icons-material/Terminal";
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
  neutralMode?: string;
  reversed?: boolean;
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
  leaderId: string;
  leaderNeutralMode: "Brake" | "Coast";
  leaderReversed: boolean;
  sensorToMechanism: string;
  rotorToSensor: string;
  acceleration: string;
  cancoderId: string;
  cancoderMagnetOffset: string;
  cancoderDiscontinuityPoint: string;
  positionUnits: string;
  defaultPosition: string;
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

function createEmptySubsystemForm(): SubsystemFormState {
  return {
    mode: "create",
    index: null,
    id: "",
    name: "",
    type: "velocity",
    leaderId: "",
    leaderNeutralMode: "Brake",
    leaderReversed: false,
    sensorToMechanism: "1.0",
    rotorToSensor: "1.0",
    acceleration: "0.0",
    cancoderId: "",
    cancoderMagnetOffset: "0.0",
    cancoderDiscontinuityPoint: "0.5",
    positionUnits: "rotations",
    defaultPosition: ""
  };
}

function subsystemToForm(subsystem: GeneratedSubsystem, index: number): SubsystemFormState {
  const leader = subsystem.motors?.find((motor) => motor.role === "leader") ?? subsystem.motors?.[0];
  return {
    mode: "edit",
    index,
    id: subsystem.id ?? toCamelCase(subsystem.name ?? ""),
    name: subsystem.name ?? "",
    type: subsystem.type === "position" ? "position" : "velocity",
    leaderId: toNumberText(leader?.id, ""),
    leaderNeutralMode: leader?.neutralMode === "Coast" ? "Coast" : "Brake",
    leaderReversed: Boolean(leader?.reversed),
    sensorToMechanism: toNumberText(subsystem.ratios?.sensorToMechanism, "1.0"),
    rotorToSensor: toNumberText(subsystem.ratios?.rotorToSensor, "1.0"),
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
  const existingFollowers = existing?.motors?.filter((motor) => motor.role !== "leader") ?? [];
  const subsystem: GeneratedSubsystem = {
    ...existing,
    id,
    name: form.name.trim(),
    type: form.type,
    motors: [
      {
        role: "leader",
        id: textToNumber(form.leaderId, 0),
        neutralMode: form.leaderNeutralMode,
        reversed: form.leaderReversed
      },
      ...existingFollowers
    ],
    pid: existing?.pid ?? {
      kP: 0.0,
      kI: 0.0,
      kD: 0.0,
      kG: 0.0,
      kS: null,
      kV: null,
      kA: null
    },
    ratios: {
      sensorToMechanism: textToNumber(form.sensorToMechanism, 1),
      rotorToSensor: textToNumber(form.rotorToSensor, 1)
    },
    motionMagic: {
      ...existing?.motionMagic,
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
      cruiseVelocity: existing?.motionMagic?.cruiseVelocity ?? 0.0
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

export function App() {
  const clientRef = useRef(new PowerLibNt4Client());
  const [activeView, setActiveView] = useState<AppView>("networktables");
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
  const [subsystemActionMessage, setSubsystemActionMessage] = useState<string | null>(null);
  const [subsystemSaving, setSubsystemSaving] = useState(false);
  const [subsystemUpdatingCode, setSubsystemUpdatingCode] = useState(false);

  const sortedTopics = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...topics]
      .filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [topics, search]);

  async function loadSubsystems(clearMessage = true) {
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
      if (clearMessage) {
        setSubsystemActionMessage(null);
      }
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
      setSubsystemDocument((current) => ({ ...current, error: "Subsystem name is required." }));
      return;
    }

    if (!subsystem.motors?.[0]?.id) {
      setSubsystemDocument((current) => ({ ...current, error: "Leader CAN ID is required." }));
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
      setSubsystemActionMessage(`Saved ${subsystem.name}. Use Update Code when you are ready to regenerate Java files.`);
      setSubsystemForm(null);
    } catch (caught) {
      setSubsystemDocument((current) => ({
        ...current,
        error: caught instanceof Error ? caught.message : "Could not save subsystem JSON."
      }));
    } finally {
      setSubsystemSaving(false);
    }
  }

  async function deleteSubsystem(index: number) {
    const subsystem = subsystemDocument.subsystems[index];
    setSubsystemSaving(true);
    try {
      await saveSubsystems(subsystemDocument.subsystems.filter((_, currentIndex) => currentIndex !== index));
      setSubsystemActionMessage(`Removed ${subsystem?.name ?? "subsystem"}. Use Update Code to reconcile generated Java files.`);
      if (subsystemForm?.index === index) {
        setSubsystemForm(null);
      }
    } catch (caught) {
      setSubsystemDocument((current) => ({
        ...current,
        error: caught instanceof Error ? caught.message : "Could not delete subsystem."
      }));
    } finally {
      setSubsystemSaving(false);
    }
  }

  async function updateSubsystemCode() {
    setSubsystemUpdatingCode(true);
    setSubsystemActionMessage(null);
    setSubsystemDocument((current) => ({ ...current, error: null }));

    try {
      if (!window.powerlib?.updateSubsystemCode) {
        throw new Error("PowerLib update bridge is not available.");
      }

      const result = await window.powerlib.updateSubsystemCode();
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      setSubsystemActionMessage(output || "Updated generated subsystem code.");
      await loadSubsystems(false);
    } catch (caught) {
      setSubsystemDocument((current) => ({
        ...current,
        error: caught instanceof Error ? caught.message : "Could not update generated subsystem code."
      }));
    } finally {
      setSubsystemUpdatingCode(false);
    }
  }

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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "grey.100" }}>
      <AppBar position="static" color="inherit" elevation={0} sx={{ borderBottom: 1, borderColor: "divider" }}>
        <Container maxWidth={false}>
          <Toolbar disableGutters sx={{ gap: 2 }}>
            <HubIcon color="primary" />
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
                Team 9410
              </Typography>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                Power Tool
              </Typography>
            </Box>
            <Chip
              label={status}
              color={status === "connected" ? "success" : status === "connecting" ? "warning" : "default"}
              variant={status === "idle" ? "outlined" : "filled"}
            />
          </Toolbar>
          <Tabs value={activeView} onChange={(_, value) => setActiveView(value)} sx={{ minHeight: 44 }}>
            <Tab
              icon={<DashboardIcon />}
              iconPosition="start"
              label="NetworkTables"
              value="networktables"
              sx={{ minHeight: 44 }}
            />
            <Tab
              icon={<ConstructionIcon />}
              iconPosition="start"
              label="Generated Subsystems"
              value="subsystems"
              sx={{ minHeight: 44 }}
            />
          </Tabs>
        </Container>
      </AppBar>

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
            <Card variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    sx={{ alignItems: { md: "center" } }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6">Generated Subsystems</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {subsystemDocument.exists
                          ? subsystemDocument.path
                          : `Looking for ${subsystemDocument.path || "powerlib-subsystems.json"}`}
                      </Typography>
                    </Box>
                    <Button
                      startIcon={subsystemDocument.loading ? <CircularProgress size={18} /> : <RefreshIcon />}
                      variant="outlined"
                      onClick={() => void loadSubsystems()}
                      disabled={subsystemDocument.loading}
                    >
                      Refresh
                    </Button>
                    <Button
                      startIcon={<AddIcon />}
                      variant="contained"
                      onClick={() => setSubsystemForm(createEmptySubsystemForm())}
                    >
                      Create Subsystem
                    </Button>
                    <Button
                      startIcon={subsystemUpdatingCode ? <CircularProgress size={18} /> : <TerminalIcon />}
                      variant="outlined"
                      onClick={updateSubsystemCode}
                      disabled={subsystemUpdatingCode}
                    >
                      Update Code
                    </Button>
                  </Stack>

                  {subsystemDocument.error && <Alert severity="error">{subsystemDocument.error}</Alert>}
                  {subsystemActionMessage && (
                    <Alert severity="success" variant="outlined" sx={{ whiteSpace: "pre-wrap" }}>
                      {subsystemActionMessage}
                    </Alert>
                  )}

                  {!subsystemDocument.error && !subsystemDocument.exists && !subsystemDocument.loading && (
                    <Alert severity="info" variant="outlined">
                      No generated subsystem document was found. Run the PowerLib subsystem generator in this robot
                      project to create `powerlib-subsystems.json`.
                    </Alert>
                  )}

                  {subsystemDocument.exists && (
                    <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1 }}>
                      <Chip label={`${subsystemDocument.subsystems.length} subsystem${subsystemDocument.subsystems.length === 1 ? "" : "s"}`} color="primary" />
                      {[...new Set(subsystemDocument.subsystems.map((subsystem) => subsystem.type).filter(Boolean))].map((type) => (
                        <Chip key={type} label={type} variant="outlined" />
                      ))}
                    </Stack>
                  )}

                  {subsystemForm && (
                    <Card variant="outlined" sx={{ bgcolor: "grey.50" }}>
                      <CardContent>
                        <Stack spacing={2}>
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
                              label="Leader CAN ID"
                              size="small"
                              type="number"
                              value={subsystemForm.leaderId}
                              onChange={(event) =>
                                setSubsystemForm((current) => (current ? { ...current, leaderId: event.target.value } : current))
                              }
                            />
                            <FormControl size="small" sx={{ minWidth: 160 }}>
                              <InputLabel id="neutral-mode-label">Neutral mode</InputLabel>
                              <Select
                                labelId="neutral-mode-label"
                                label="Neutral mode"
                                value={subsystemForm.leaderNeutralMode}
                                onChange={(event) =>
                                  setSubsystemForm((current) =>
                                    current ? { ...current, leaderNeutralMode: event.target.value as "Brake" | "Coast" } : current
                                  )
                                }
                              >
                                <MenuItem value="Brake">Brake</MenuItem>
                                <MenuItem value="Coast">Coast</MenuItem>
                              </Select>
                            </FormControl>
                            <FormControlLabel
                              control={
                                <Checkbox
                                  checked={subsystemForm.leaderReversed}
                                  onChange={(event) =>
                                    setSubsystemForm((current) =>
                                      current ? { ...current, leaderReversed: event.target.checked } : current
                                    )
                                  }
                                />
                              }
                              label="Leader reversed"
                            />
                            <TextField
                              label="Acceleration"
                              size="small"
                              type="number"
                              value={subsystemForm.acceleration}
                              onChange={(event) =>
                                setSubsystemForm((current) => (current ? { ...current, acceleration: event.target.value } : current))
                              }
                            />
                          </Stack>

                          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                            <TextField
                              label="Sensor-to-mechanism ratio"
                              size="small"
                              type="number"
                              value={subsystemForm.sensorToMechanism}
                              onChange={(event) =>
                                setSubsystemForm((current) =>
                                  current ? { ...current, sensorToMechanism: event.target.value } : current
                                )
                              }
                            />
                            <TextField
                              label="Rotor-to-sensor ratio"
                              size="small"
                              type="number"
                              value={subsystemForm.rotorToSensor}
                              onChange={(event) =>
                                setSubsystemForm((current) => (current ? { ...current, rotorToSensor: event.target.value } : current))
                              }
                            />
                            {subsystemForm.type === "position" && (
                              <>
                                <TextField
                                  label="CANcoder CAN ID"
                                  size="small"
                                  type="number"
                                  value={subsystemForm.cancoderId}
                                  onChange={(event) =>
                                    setSubsystemForm((current) =>
                                      current ? { ...current, cancoderId: event.target.value } : current
                                    )
                                  }
                                />
                                <TextField
                                  label="Position units"
                                  size="small"
                                  value={subsystemForm.positionUnits}
                                  onChange={(event) =>
                                    setSubsystemForm((current) =>
                                      current ? { ...current, positionUnits: event.target.value } : current
                                    )
                                  }
                                />
                              </>
                            )}
                          </Stack>

                          {subsystemForm.type === "position" && (
                            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                              <TextField
                                label="CANcoder magnet offset"
                                size="small"
                                type="number"
                                value={subsystemForm.cancoderMagnetOffset}
                                onChange={(event) =>
                                  setSubsystemForm((current) =>
                                    current ? { ...current, cancoderMagnetOffset: event.target.value } : current
                                  )
                                }
                              />
                              <TextField
                                label="CANcoder discontinuity point"
                                size="small"
                                type="number"
                                value={subsystemForm.cancoderDiscontinuityPoint}
                                onChange={(event) =>
                                  setSubsystemForm((current) =>
                                    current ? { ...current, cancoderDiscontinuityPoint: event.target.value } : current
                                  )
                                }
                              />
                              <TextField
                                label="Default position"
                                size="small"
                                type="number"
                                value={subsystemForm.defaultPosition}
                                onChange={(event) =>
                                  setSubsystemForm((current) =>
                                    current ? { ...current, defaultPosition: event.target.value } : current
                                  )
                                }
                              />
                            </Stack>
                          )}

                          <Stack direction="row" spacing={1}>
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
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  )}

                  <TableContainer component={Paper} elevation={0} sx={{ border: 1, borderColor: "divider" }}>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell sx={{ width: 120 }}>Type</TableCell>
                          <TableCell sx={{ width: 220 }}>Motors</TableCell>
                          <TableCell sx={{ width: 260 }}>PID</TableCell>
                          <TableCell sx={{ width: 180 }}>Ratios</TableCell>
                          <TableCell sx={{ width: 180 }}>Extra</TableCell>
                          <TableCell sx={{ width: 150 }}>Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {subsystemDocument.subsystems.map((subsystem, index) => (
                          <TableRow key={subsystem.id ?? `${subsystem.name}-${index}`} hover>
                            <TableCell>
                              <Stack spacing={0.25}>
                                <Typography sx={{ fontWeight: 700 }}>{subsystem.name ?? "-"}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace" }}>
                                  {subsystem.id ?? "-"}
                                </Typography>
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <Chip label={subsystem.type ?? "-"} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>{getMotorSummary(subsystem)}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>{getPidSummary(subsystem)}</TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>
                              sensor {stringifyOptional(subsystem.ratios?.sensorToMechanism)}
                              <br />
                              rotor {stringifyOptional(subsystem.ratios?.rotorToSensor)}
                            </TableCell>
                            <TableCell sx={{ fontFamily: "monospace" }}>
                              {subsystem.type === "position"
                                ? `CANcoder ${stringifyOptional(subsystem.cancoder?.id)}`
                                : `accel ${stringifyOptional(subsystem.motionMagic?.acceleration)}`}
                            </TableCell>
                            <TableCell>
                              <Stack direction="row" spacing={1}>
                                <Button
                                  size="small"
                                  startIcon={<EditIcon />}
                                  onClick={() => setSubsystemForm(subsystemToForm(subsystem, index))}
                                >
                                  Edit
                                </Button>
                                <Button
                                  size="small"
                                  color="error"
                                  startIcon={<DeleteIcon />}
                                  onClick={() => void deleteSubsystem(index)}
                                  disabled={subsystemSaving}
                                >
                                  Delete
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                        {subsystemDocument.exists && subsystemDocument.subsystems.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                                The subsystem JSON exists, but it does not contain any generated subsystems yet.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        )}
                        {!subsystemDocument.exists && (
                          <TableRow>
                            <TableCell colSpan={7}>
                              <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                                No generated subsystems to display.
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
          )}
        </Stack>
      </Container>
    </Box>
  );
}
