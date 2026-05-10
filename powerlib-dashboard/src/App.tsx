import { FormEvent, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Toolbar,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CableIcon from "@mui/icons-material/Cable";
import HubIcon from "@mui/icons-material/Hub";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import {
  NtPrimitive,
  NtTopicSnapshot,
  NtTopicType,
  NtValue,
  PowerLibNt4Client
} from "./networktables/nt4Client";

type ConnectionState = "idle" | "connecting" | "connected" | "disconnected";

type TargetPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
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

function stringifyValue(value: NtValue) {
  if (value instanceof ArrayBuffer) {
    return `ArrayBuffer(${value.byteLength})`;
  }

  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }

  return String(value);
}

export function App() {
  const clientRef = useRef(new PowerLibNt4Client());
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

  const sortedTopics = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return [...topics]
      .filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch))
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [topics, search]);

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
        <Toolbar sx={{ gap: 2 }}>
          <HubIcon color="primary" />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="overline" color="text.secondary" sx={{ fontWeight: 800 }}>
              Team 9410
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              PowerLib Dashboard
            </Typography>
          </Box>
          <Chip
            label={status}
            color={status === "connected" ? "success" : status === "connecting" ? "warning" : "default"}
            variant={status === "idle" ? "outlined" : "filled"}
          />
        </Toolbar>
      </AppBar>

      <Container maxWidth={false} sx={{ py: 2 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}

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
        </Stack>
      </Container>
    </Box>
  );
}
