import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import CableIcon from "@mui/icons-material/Cable";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { stringifyValue } from "../subsystems/subsystemUtils";
import { useNetworkTables } from "./NetworkTablesContext";

type TargetPreset = {
  id: string;
  label: string;
  host: string;
  port: number;
};

type TopicTreeNode = {
  name: string;
  path: string;
  children: TopicTreeNode[];
  topic?: NtTopicSnapshot;
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

function createTree(topics: NtTopicSnapshot[], search: string) {
  const normalizedSearch = search.trim().toLowerCase();
  const root: TopicTreeNode = { name: "/", path: "/", children: [] };

  [...topics]
    .filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch))
    .sort((left, right) => left.name.localeCompare(right.name))
    .forEach((topic) => {
      const segments = topic.name.split("/").filter(Boolean);
      let current = root;

      segments.forEach((segment, index) => {
        const path = `/${segments.slice(0, index + 1).join("/")}`;
        let child = current.children.find((item) => item.name === segment);
        if (!child) {
          child = { name: segment, path, children: [] };
          current.children.push(child);
        }

        current = child;
      });

      current.topic = topic;
    });

  return root;
}

function collectDefaultExpanded(node: TopicTreeNode, expanded: Set<string>) {
  if (node.children.length > 0) {
    expanded.add(node.path);
  }

  node.children.forEach((child) => collectDefaultExpanded(child, expanded));
}

type TopicTreeProps = {
  node: TopicTreeNode;
  depth?: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
};

function TopicTree({ node, depth = 0, expandedPaths, onToggle }: TopicTreeProps) {
  const hasChildren = node.children.length > 0;
  const expanded = expandedPaths.has(node.path);

  return (
    <Box>
      {node.path !== "/" && (
        <Box
          sx={{
            alignItems: "center",
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "grid",
            gap: 1,
            gridTemplateColumns: "32px minmax(180px, 1fr) 120px minmax(180px, 0.8fr)",
            minHeight: 42,
            pl: `${depth * 18}px`,
            pr: 1
          }}
        >
          <Box>
            {hasChildren && (
              <IconButton size="small" onClick={() => onToggle(node.path)} aria-label={expanded ? "Collapse" : "Expand"}>
                {expanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
              </IconButton>
            )}
          </Box>
          <Typography sx={{ fontFamily: node.topic ? "monospace" : "inherit", fontWeight: hasChildren ? 700 : 500 }}>
            {node.name}
          </Typography>
          <Box>{node.topic && <Chip label={node.topic.type} size="small" variant="outlined" />}</Box>
          <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
            {node.topic ? stringifyValue(node.topic.value) : ""}
          </Typography>
        </Box>
      )}

      {hasChildren && (
        <Collapse in={node.path === "/" || expanded} timeout="auto" unmountOnExit>
          {node.children.map((child) => (
            <TopicTree key={child.path} node={child} depth={depth + 1} expandedPaths={expandedPaths} onToggle={onToggle} />
          ))}
        </Collapse>
      )}
    </Box>
  );
}

export function NetworkTablesPanel() {
  const { clientRef, status, setStatus, topics, setTopics, setError, upsertTopic } = useNetworkTables();
  const [targetId, setTargetId] = useState("sim-localhost");
  const [host, setHost] = useState("localhost");
  const [port, setPort] = useState(5810);
  const [search, setSearch] = useState("");
  const [topicName, setTopicName] = useState("/SmartDashboard/PowerLib/TargetRPM");
  const [topicType, setTopicType] = useState<NtTopicType>("double");
  const [topicValue, setTopicValue] = useState("0");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));

  const topicTree = useMemo(() => {
    return createTree(topics, search);
  }, [topics, search]);

  useEffect(() => {
    if (!search.trim()) {
      return;
    }

    const expanded = new Set<string>();
    collectDefaultExpanded(topicTree, expanded);
    setExpandedPaths(expanded);
  }, [search, topicTree]);

  const visibleTopicCount = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return topics.filter((topic) => !normalizedSearch || topic.name.toLowerCase().includes(normalizedSearch)).length;
  }, [topics, search]);

  function setPreset(id: string) {
    setTargetId(id);
    const preset = targetPresets.find((item) => item.id === id);
    if (preset && preset.id !== "custom") {
      setHost(preset.host);
      setPort(preset.port);
    }
  }

  function connect() {
    setError(null);
    setStatus("connecting");
    setTopics([]);
    setExpandedPaths(new Set(["/"]));

    try {
      clientRef.current.connect(host, port, (connected) => {
        setStatus(connected ? "connected" : "disconnected");
      });

      clientRef.current.watchPrefix("/", upsertTopic);
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
    setExpandedPaths(new Set(["/"]));
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

  function togglePath(path: string) {
    setExpandedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" } }}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <CableIcon color="primary" />
              <Typography variant="h6">NetworkTables Target</Typography>
            </Stack>

            <FormControl fullWidth size="small">
              <InputLabel id="target-preset-label">Target</InputLabel>
              <Select labelId="target-preset-label" label="Target" value={targetId} onChange={(event) => setPreset(event.target.value)}>
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
            <TextField label="NT4 port" size="small" type="number" value={port} onChange={(event) => setPort(Number(event.target.value))} />

            <Stack direction="row" spacing={1}>
              <Button variant="contained" fullWidth onClick={connect}>
                Connect
              </Button>
              <Button variant="outlined" fullWidth onClick={disconnect}>
                Disconnect
              </Button>
            </Stack>

            <Alert severity="info" variant="outlined">
              Power Tool subscribes to the root NetworkTables prefix and renders discovered topics as a tree.
            </Alert>
          </Stack>
        </CardContent>
      </Card>

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack spacing={0}>
            <Box sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">NetworkTables Tree</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Root subscription `/` has {visibleTopicCount} visible topic{visibleTopicCount === 1 ? "" : "s"}.
                  </Typography>
                </Box>
                <TextField label="Filter topics" size="small" value={search} onChange={(event) => setSearch(event.target.value)} />
                <Button startIcon={<RefreshIcon />} variant="outlined" onClick={connect}>
                  Reconnect
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box component="form" onSubmit={publishTopic} sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", lg: "row" }} spacing={1.5}>
                <TextField label="Topic" size="small" value={topicName} onChange={(event) => setTopicName(event.target.value)} sx={{ flexGrow: 1 }} />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                  <InputLabel id="publish-type-label">Type</InputLabel>
                  <Select labelId="publish-type-label" label="Type" value={topicType} onChange={(event) => setTopicType(event.target.value as NtTopicType)}>
                    <MenuItem value="double">double</MenuItem>
                    <MenuItem value="int">int</MenuItem>
                    <MenuItem value="boolean">boolean</MenuItem>
                    <MenuItem value="string">string</MenuItem>
                  </Select>
                </FormControl>
                <TextField label="Value" size="small" value={topicValue} onChange={(event) => setTopicValue(event.target.value)} sx={{ minWidth: 180 }} />
                <Button type="submit" variant="contained" endIcon={<SendIcon />}>
                  Publish
                </Button>
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ maxHeight: "calc(100vh - 320px)", overflow: "auto" }}>
              <Box
                sx={{
                  alignItems: "center",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  color: "text.secondary",
                  display: "grid",
                  fontSize: 12,
                  fontWeight: 700,
                  gap: 1,
                  gridTemplateColumns: "32px minmax(180px, 1fr) 120px minmax(180px, 0.8fr)",
                  minHeight: 36,
                  px: 1,
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bgcolor: "background.paper"
                }}
              >
                <Box />
                <Box>Topic</Box>
                <Box>Type</Box>
                <Box>Value</Box>
              </Box>

              {visibleTopicCount > 0 ? (
                <TopicTree node={topicTree} expandedPaths={expandedPaths} onToggle={togglePath} />
              ) : (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
                  Connect to discover NetworkTables data from `/`.
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
