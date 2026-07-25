import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  TextField,
  Typography
} from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { stringifyValue } from "../subsystems/subsystemUtils";
import { SaveTunedValuesDialog } from "./SaveTunedValuesDialog";
import { useNetworkTables } from "./NetworkTablesContext";

type TopicTreeNode = {
  name: string;
  path: string;
  children: TopicTreeNode[];
  topic?: NtTopicSnapshot;
};

const tunablePathMarker = "/Variables/";
const tuningModeTopicName = "/PowerLib/Tuning/Enabled";

function getWritableTopicType(topic: NtTopicSnapshot): NtTopicType | null {
  switch (topic.type) {
    case "boolean":
    case "double":
    case "int":
    case "string":
      return topic.type;
    default:
      return null;
  }
}

function isTunableTopic(topic: NtTopicSnapshot) {
  return topic.name.includes(tunablePathMarker) && getWritableTopicType(topic) !== null;
}

function topicValueToDraft(value: NtTopicSnapshot["value"]) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  return typeof value === "string" || typeof value === "number" ? String(value) : stringifyValue(value);
}

function parseDraftValue(type: NtTopicType, draft: string): NtPrimitive {
  if (type === "string") {
    return draft;
  }

  if (type === "boolean") {
    const normalized = draft.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }

    throw new Error("Use true/false, yes/no, on/off, or 1/0 for booleans.");
  }

  const parsed = Number(draft);
  if (!Number.isFinite(parsed)) {
    throw new Error(`"${draft}" is not a valid ${type} value.`);
  }
  if (type === "int" && !Number.isInteger(parsed)) {
    throw new Error(`"${draft}" is not a valid integer value.`);
  }

  return parsed;
}

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

type TunableVariableRowProps = {
  disabled: boolean;
  topic: NtTopicSnapshot;
  onApply: (topic: NtTopicSnapshot, type: NtTopicType, value: NtPrimitive) => void;
};

function TunableVariableRow({ disabled, topic, onApply }: TunableVariableRowProps) {
  const type = getWritableTopicType(topic);
  const [draft, setDraft] = useState(topicValueToDraft(topic.value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(topicValueToDraft(topic.value));
    setError(null);
  }, [topic.name, topic.value]);

  if (!type) {
    return null;
  }
  const writableType = type;

  function applyValue() {
    if (disabled) {
      return;
    }

    try {
      const value = parseDraftValue(writableType, draft);
      onApply(topic, writableType, value);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 96px minmax(160px, 240px) 90px" }
      }}
    >
      <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere", pt: 1 }}>{topic.name}</Typography>
      <Box sx={{ pt: 0.75 }}>
        <Chip label={writableType} size="small" variant="outlined" />
      </Box>
      <TextField
        error={Boolean(error)}
        helperText={error ?? " "}
        size="small"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            applyValue();
          }
        }}
      />
      <Button disabled={disabled} onClick={applyValue} size="small" variant="contained">
        Apply
      </Button>
    </Box>
  );
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
  const { clientRef, connectionSettings, status, topics, setError, upsertTopic } = useNetworkTables();
  const [search, setSearch] = useState("");
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(["/"]));
  const [saveValuesOpen, setSaveValuesOpen] = useState(false);

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

  const tunableTopics = useMemo(() => {
    return topics.filter(isTunableTopic).sort((left, right) => left.name.localeCompare(right.name));
  }, [topics]);
  const tuningModeTopic = topics.find((topic) => topic.name === tuningModeTopicName);
  const tuningModeEnabled = tuningModeTopic?.value === true;

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

  function applyTunableTopic(topic: NtTopicSnapshot, type: NtTopicType, value: NtPrimitive) {
    try {
      clientRef.current.publish(topic.name, type, value);
      upsertTopic({
        ...topic,
        type,
        value,
        lastChangedTime: Date.now()
      });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function setTuningModeEnabled(enabled: boolean) {
    try {
      clientRef.current.publish(tuningModeTopicName, "boolean", enabled);
      upsertTopic({
        name: tuningModeTopicName,
        type: "boolean",
        value: enabled,
        lastChangedTime: Date.now()
      });
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">Live Tunables</Typography>
                <Typography variant="body2" color="text.secondary">
                  Apply writes primitive command and subsystem variables to NetworkTables. Robot code only uses them
                  while tuning mode is enabled.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button
                  disabled={tunableTopics.length === 0 || !window.powerlib?.readSubsystems || !window.powerlib?.readBindings}
                  onClick={() => setSaveValuesOpen(true)}
                  size="small"
                  variant="outlined"
                >
                  Save Values
                </Button>
                <Chip
                  color={tuningModeEnabled ? "warning" : "default"}
                  label={tuningModeEnabled ? "armed" : "safe"}
                  size="small"
                  variant={tuningModeEnabled ? "filled" : "outlined"}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={tuningModeEnabled}
                      disabled={status !== "connected"}
                      onChange={(event) => setTuningModeEnabled(event.target.checked)}
                    />
                  }
                  label={tuningModeEnabled ? "Tuning on" : "Tuning off"}
                />
              </Stack>
            </Stack>

            <Alert severity={tuningModeEnabled ? "warning" : "info"} variant="outlined">
              {tuningModeEnabled
                ? "Tuning mode is on: applied values can change subsystem gains and generated command targets live."
                : "Tuning mode is off: applied values are staged in NetworkTables, but robot code uses generated constants/defaults."}
            </Alert>

            {tunableTopics.length > 0 ? (
              <Stack spacing={1}>
                {tunableTopics.map((topic) => (
                  <TunableVariableRow
                    key={topic.name}
                    disabled={status !== "connected"}
                    topic={topic}
                    onApply={applyTunableTopic}
                  />
                ))}
              </Stack>
            ) : (
              <Alert severity="info" variant="outlined">
                No live tunable variables are published yet. Generated subsystem PID values and generated command values
                will appear here while robot code is running.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <SaveTunedValuesDialog open={saveValuesOpen} topics={topics} onClose={() => setSaveValuesOpen(false)} />

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          <Stack spacing={0}>
            <Box sx={{ p: 2 }}>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h6">NetworkTables Tree</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {connectionSettings.host}:{connectionSettings.port} · watched prefixes have {visibleTopicCount} visible topic
                    {visibleTopicCount === 1 ? "" : "s"}.
                  </Typography>
                </Box>
                <TextField label="Filter topics" size="small" value={search} onChange={(event) => setSearch(event.target.value)} />
              </Stack>
            </Box>

            <Divider />

            <Box sx={{ maxHeight: "calc(100vh - 250px)", overflow: "auto" }}>
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
                <Stack spacing={2} sx={{ alignItems: "center", py: 4 }}>
                  <Alert severity="info" variant="outlined">
                    Power Tool renders discovered NetworkTables topics from the watched prefixes as a tree.
                  </Alert>
                  <Typography color="text.secondary">Connect to discover NetworkTables data.</Typography>
                </Stack>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
