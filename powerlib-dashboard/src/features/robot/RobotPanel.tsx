import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import TuneIcon from "@mui/icons-material/Tune";
import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { SaveTunedValuesDialog } from "../networktables/SaveTunedValuesDialog";
import { useNetworkTables } from "../networktables/NetworkTablesContext";
import { getWritableTopicType, parseDraftValue, topicValueToDraft } from "../networktables/tuningUtils";
import type { GeneratedSubsystem } from "../subsystems/types";
import { stringifyValue } from "../subsystems/subsystemUtils";

type TuningOwnerKind = "subsystem" | "command";

type RobotMetric = {
  label: string;
  value: string;
  type: string;
};

type RobotSubsystemTile = {
  id: string;
  name: string;
  type: string;
  connected?: boolean;
  metrics: RobotMetric[];
};

type ParsedTuningTopic = {
  kind: TuningOwnerKind;
  ownerName: string;
  variableKey: string;
};

type SelectedTuningVariable = {
  name: string;
  parsed: ParsedTuningTopic | null;
  topic: NtTopicSnapshot | null;
};

type RobotPanelProps = {
  subsystems: GeneratedSubsystem[];
  topics: NtTopicSnapshot[];
};

const subsystemPrefix = "/PowerLib/Subsystems/";
const commandPrefix = "/PowerLib/Commands/";
const legacyDataPrefix = "/PowerLib/Data/";

function toPascalCase(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function formatMetricLabel(rawMetric: string) {
  const spaced = rawMetric
    .replace(/\//g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/Rotations/g, " rotations")
    .replace(/Volts/g, " volts")
    .trim();

  return spaced || "Value";
}

function formatVariableSegment(segment: string) {
  if (/^k[A-Z]$/.test(segment)) {
    return segment;
  }

  if (/^[A-Z0-9_]+$/.test(segment)) {
    return segment.replace(/_/g, " ");
  }

  return segment.replace(/([a-z0-9])([A-Z])/g, "$1 $2");
}

function formatVariableKey(variableKey: string) {
  return variableKey.split("/").map(formatVariableSegment).join(" ");
}

function formatNumber(value: number) {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
}

function formatRobotMetricValue(value: NtTopicSnapshot["value"]) {
  if (typeof value === "number") {
    return formatNumber(value);
  }

  if (Array.isArray(value) && value.every((item) => typeof item === "number")) {
    return `[${value.map((item) => formatNumber(item)).join(", ")}]`;
  }

  return stringifyValue(value);
}

function parseTuningTopicName(name: string): ParsedTuningTopic | null {
  const candidates: Array<{ kind: TuningOwnerKind; prefix: string }> = [
    { kind: "subsystem", prefix: subsystemPrefix },
    { kind: "command", prefix: commandPrefix }
  ];

  for (const candidate of candidates) {
    if (!name.startsWith(candidate.prefix)) {
      continue;
    }

    const [ownerName, section, ...variableParts] = name.slice(candidate.prefix.length).split("/").filter(Boolean);
    if (!ownerName || section !== "Variables" || variableParts.length === 0) {
      return null;
    }

    return {
      kind: candidate.kind,
      ownerName,
      variableKey: variableParts.join("/")
    };
  }

  return null;
}

function normalizeSelectedTopicNames(topicNames: unknown) {
  if (!Array.isArray(topicNames)) {
    return [];
  }

  return Array.from(
    new Set(
      topicNames
        .filter((topicName): topicName is string => typeof topicName === "string" && topicName.trim().length > 0)
        .map((topicName) => topicName.trim())
    )
  ).sort((left, right) => left.localeCompare(right));
}

function getTuningVariableLabel(variable: SelectedTuningVariable) {
  return variable.parsed ? formatVariableKey(variable.parsed.variableKey) : variable.name;
}

function getTuningOwnerLabel(variable: SelectedTuningVariable) {
  if (!variable.parsed) {
    return "Tunable";
  }

  return `${variable.parsed.kind === "subsystem" ? "Subsystem" : "Command"}: ${variable.parsed.ownerName}`;
}

function getSubsystemDisplayName(subsystem: GeneratedSubsystem, index: number) {
  return subsystem.name || subsystem.id || `Subsystem ${index + 1}`;
}

function getSubsystemTopicKey(subsystem: GeneratedSubsystem, index: number) {
  return toPascalCase(getSubsystemDisplayName(subsystem, index));
}

function metricSortValue(metric: RobotMetric) {
  const order = ["Connected", "Velocity", "Position", "Setpoint", "Applied volts"];
  const index = order.findIndex((label) => metric.label.toLowerCase().startsWith(label.toLowerCase()));
  return index === -1 ? order.length : index;
}

function getDataTopicParts(topic: NtTopicSnapshot) {
  if (topic.name.startsWith(subsystemPrefix)) {
    const [subsystemName, section, ...metricParts] = topic.name.slice(subsystemPrefix.length).split("/").filter(Boolean);
    if (!subsystemName || section !== "Data" || metricParts.length === 0) {
      return null;
    }

    return {
      subsystemName,
      metricKey: metricParts.join(" ")
    };
  }

  if (topic.name.startsWith(legacyDataPrefix)) {
    const [subsystemName, ...metricParts] = topic.name.slice(legacyDataPrefix.length).split("/").filter(Boolean);
    if (!subsystemName || metricParts.length === 0) {
      return null;
    }

    return {
      subsystemName,
      metricKey: metricParts.join(" ")
    };
  }

  return null;
}

function createTiles(subsystems: GeneratedSubsystem[], topics: NtTopicSnapshot[]) {
  const dataTopics = topics
    .map((topic) => ({ topic, parts: getDataTopicParts(topic) }))
    .filter((item): item is { topic: NtTopicSnapshot; parts: { subsystemName: string; metricKey: string } } => item.parts !== null);
  const configuredTiles = subsystems.map((subsystem, index) => ({
    id: subsystem.id || subsystem.name || `subsystem-${index}`,
    name: getSubsystemDisplayName(subsystem, index),
    topicKey: getSubsystemTopicKey(subsystem, index),
    type: subsystem.type || "subsystem"
  }));
  const configuredTopicKeys = new Set(configuredTiles.map((tile) => tile.topicKey));
  const dataOnlyTiles = Array.from(
    new Set(
      dataTopics
        .map(({ parts }) => parts.subsystemName)
        .filter((topicSubsystem): topicSubsystem is string => Boolean(topicSubsystem))
        .filter((topicSubsystem) => !configuredTopicKeys.has(topicSubsystem))
    )
  )
    .sort((left, right) => left.localeCompare(right))
    .map((topicSubsystem) => ({
      id: topicSubsystem,
      name: topicSubsystem,
      topicKey: topicSubsystem,
      type: "data"
    }));

  return [...configuredTiles, ...dataOnlyTiles].map<RobotSubsystemTile>((tile) => {
    const metrics = dataTopics
      .map(({ topic, parts }) => {
        if (parts.subsystemName !== tile.topicKey) {
          return null;
        }

        return {
          label: formatMetricLabel(parts.metricKey),
          value: formatRobotMetricValue(topic.value),
          type: String(topic.type)
        };
      })
      .filter((metric): metric is RobotMetric => metric !== null)
      .sort((left, right) => metricSortValue(left) - metricSortValue(right) || left.label.localeCompare(right.label));

    const connectedMetric = metrics.find((metric) => metric.label.toLowerCase() === "connected");
    const visibleMetrics = metrics.filter((metric) => metric.label.toLowerCase() !== "connected");

    return {
      id: tile.id,
      name: tile.name,
      type: tile.type,
      connected:
        connectedMetric?.value.toLowerCase() === "true"
          ? true
          : connectedMetric?.value.toLowerCase() === "false"
            ? false
            : undefined,
      metrics: visibleMetrics
    };
  });
}

export function RobotPanel({ subsystems, topics }: RobotPanelProps) {
  const { clientRef, status, upsertTopic } = useNetworkTables();
  const [tuningDrawerOpen, setTuningDrawerOpen] = useState(false);
  const [saveValuesOpen, setSaveValuesOpen] = useState(false);
  const [selectedTuningTopicNames, setSelectedTuningTopicNames] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [applying, setApplying] = useState(false);
  const [selectionLoading, setSelectionLoading] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const lastTopicDraftsRef = useRef<Record<string, string>>({});
  const tiles = useMemo(() => createTiles(subsystems, topics), [subsystems, topics]);
  const selectedTuningVariables = useMemo<SelectedTuningVariable[]>(() => {
    const topicMap = new Map(topics.map((topic) => [topic.name, topic]));

    return selectedTuningTopicNames
      .map((name) => ({
        name,
        parsed: parseTuningTopicName(name),
        topic: topicMap.get(name) ?? null
      }))
      .sort((left, right) => {
        const leftOwner = left.parsed?.ownerName ?? left.name;
        const rightOwner = right.parsed?.ownerName ?? right.name;
        return (
          (left.parsed?.kind ?? "").localeCompare(right.parsed?.kind ?? "") ||
          leftOwner.localeCompare(rightOwner) ||
          getTuningVariableLabel(left).localeCompare(getTuningVariableLabel(right))
        );
      });
  }, [selectedTuningTopicNames, topics]);
  const pendingTuningVariables = useMemo(() => {
    return selectedTuningVariables.filter((variable) => {
      if (!variable.topic) {
        return false;
      }

      const baseline = topicValueToDraft(variable.topic.value);
      return (drafts[variable.name] ?? baseline) !== baseline;
    });
  }, [drafts, selectedTuningVariables]);

  useEffect(() => {
    let active = true;

    async function loadSelectedTunables() {
      if (!window.powerlib?.readTuningSelection) {
        return;
      }

      setSelectionLoading(true);
      try {
        const result = await window.powerlib.readTuningSelection();
        if (!active) {
          return;
        }

        setSelectedTuningTopicNames(normalizeSelectedTopicNames(result.selectedTopics));
        setTuningDrawerOpen(result.monitorDrawerOpen === true);
        setSelectionError(result.error ?? null);
      } catch (caught) {
        if (!active) {
          return;
        }

        setSelectionError(caught instanceof Error ? caught.message : "Could not read selected tuning variables.");
      } finally {
        if (active) {
          setSelectionLoading(false);
        }
      }
    }

    void loadSelectedTunables();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const nextTopicDrafts = selectedTuningVariables.reduce<Record<string, string>>((next, variable) => {
      if (variable.topic) {
        next[variable.name] = topicValueToDraft(variable.topic.value);
      }
      return next;
    }, {});

    setDrafts((current) => {
      const next: Record<string, string> = {};
      selectedTuningVariables.forEach((variable) => {
        const currentDraft = current[variable.name];
        const previousTopicDraft = lastTopicDraftsRef.current[variable.name];
        const nextTopicDraft = nextTopicDrafts[variable.name] ?? "";
        const hasLocalEdit =
          currentDraft !== undefined &&
          previousTopicDraft !== undefined &&
          currentDraft !== previousTopicDraft;

        next[variable.name] = hasLocalEdit ? currentDraft : nextTopicDraft;
      });
      return next;
    });

    setRowErrors((current) => {
      const next: Record<string, string | null> = {};
      selectedTuningVariables.forEach((variable) => {
        next[variable.name] = current[variable.name] ?? null;
      });
      return next;
    });

    lastTopicDraftsRef.current = nextTopicDrafts;
  }, [selectedTuningVariables]);

  async function refreshSelectedTunables() {
    if (!window.powerlib?.readTuningSelection) {
      setSelectionError("Selected tuning variables are only available in the Power Tool desktop app.");
      return;
    }

    setSelectionLoading(true);
    try {
      const result = await window.powerlib.readTuningSelection();
      setSelectedTuningTopicNames(normalizeSelectedTopicNames(result.selectedTopics));
      setSelectionError(result.error ?? null);
    } catch (caught) {
      setSelectionError(caught instanceof Error ? caught.message : "Could not read selected tuning variables.");
    } finally {
      setSelectionLoading(false);
    }
  }

  async function setSavedTuningDrawerOpen(open: boolean) {
    setTuningDrawerOpen(open);

    if (!window.powerlib?.saveTuningMonitorDrawerOpen) {
      setSelectionError("The tuning drawer state can only be saved from the Power Tool desktop app.");
      return;
    }

    try {
      const result = await window.powerlib.saveTuningMonitorDrawerOpen(open);
      setSelectedTuningTopicNames(normalizeSelectedTopicNames(result.selectedTopics));
      setTuningDrawerOpen(result.monitorDrawerOpen);
      setSelectionError(null);
    } catch (caught) {
      setSelectionError(caught instanceof Error ? caught.message : "Could not save the tuning drawer state.");
    }
  }

  function updateDraft(topicName: string, draft: string) {
    setDrafts((current) => ({ ...current, [topicName]: draft }));
    setRowErrors((current) => ({ ...current, [topicName]: null }));
  }

  async function applyAllPendingTunables() {
    if (status !== "connected" || applying || pendingTuningVariables.length === 0) {
      return;
    }

    const nextErrors: Record<string, string | null> = {};
    const changes: Array<{ topic: NtTopicSnapshot; type: NtTopicType; value: NtPrimitive }> = [];

    pendingTuningVariables.forEach((variable) => {
      if (!variable.topic) {
        return;
      }

      const type = getWritableTopicType(variable.topic);
      if (!type) {
        return;
      }

      try {
        changes.push({
          topic: variable.topic,
          type,
          value: parseDraftValue(type, drafts[variable.name] ?? topicValueToDraft(variable.topic.value))
        });
        nextErrors[variable.name] = null;
      } catch (caught) {
        nextErrors[variable.name] = caught instanceof Error ? caught.message : String(caught);
      }
    });

    const invalidCount = Object.values(nextErrors).filter(Boolean).length;
    setRowErrors((current) => ({ ...current, ...nextErrors }));
    if (invalidCount > 0) {
      setSelectionError(`Fix ${invalidCount} invalid value${invalidCount === 1 ? "" : "s"} before applying.`);
      return;
    }

    setApplying(true);
    try {
      const results = await Promise.allSettled(
        changes.map(async ({ topic, type, value }) => {
          await clientRef.current.publish(topic.name, type, value);
          upsertTopic({
            ...topic,
            type,
            value,
            lastChangedTime: Date.now()
          });
        })
      );

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        const firstFailure = failures[0];
        const reason = firstFailure.status === "rejected" ? firstFailure.reason : null;
        const message = reason instanceof Error ? reason.message : "Could not apply one or more tunables.";
        setSelectionError(`Applied ${changes.length - failures.length} of ${changes.length}; ${message}`);
        return;
      }

      setSelectionError(null);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} sx={{ alignItems: { sm: "center" } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6">Subsystem Monitoring</Typography>
          <Typography color="text.secondary" variant="body2">
            Live subsystem data from NetworkTables.
          </Typography>
        </Box>
        <Button
          startIcon={<TuneIcon />}
          variant={tuningDrawerOpen ? "contained" : "outlined"}
          onClick={() => {
            const nextOpen = !tuningDrawerOpen;
            void setSavedTuningDrawerOpen(nextOpen);
            if (nextOpen) {
              void refreshSelectedTunables();
            }
          }}
        >
          {tuningDrawerOpen ? "Hide Tunables" : "Show Tunables"}
          <Chip label={selectedTuningVariables.length} size="small" sx={{ ml: 1 }} />
        </Button>
      </Stack>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", lg: tuningDrawerOpen ? "minmax(0, 1fr) 420px" : "1fr" },
          minWidth: 0
        }}
      >
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {tiles.length === 0 && (
            <Alert severity="info" variant="outlined">
              No generated subsystem document was found for robot tiles.
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gap: 1.5,
              justifyContent: "start",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(auto-fill, minmax(280px, 320px))"
              }
            }}
          >
            {tiles.map((tile) => (
              <Card key={tile.id} variant="outlined" sx={{ minHeight: 160 }}>
                <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
                  <Stack spacing={1.25}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                          {tile.name}
                        </Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 0.75 }}>
                          <Chip label={tile.type} size="small" />
                          {tile.connected !== undefined && (
                            <Chip
                              label={tile.connected ? "connected" : "disconnected"}
                              color={tile.connected ? "success" : "error"}
                              size="small"
                              variant={tile.connected ? "filled" : "outlined"}
                            />
                          )}
                        </Stack>
                      </Box>
                    </Stack>

                    <Divider />

                    {tile.metrics.length > 0 ? (
                      <Box sx={{ display: "grid", gap: 0.75 }}>
                        {tile.metrics.map((metric) => (
                          <Box
                            key={`${tile.id}-${metric.label}`}
                            sx={{
                              alignItems: "baseline",
                              display: "grid",
                              gap: 0.75,
                              gridTemplateColumns: "minmax(0, 1fr) minmax(48px, max-content)"
                            }}
                          >
                            <Typography variant="body2" color="text.secondary">
                              {metric.label}
                            </Typography>
                            <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere" }}>
                              {metric.value}
                            </Typography>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
                        Waiting for NetworkTables data.
                      </Typography>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            ))}
          </Box>
        </Stack>

        {tuningDrawerOpen && (
          <Card
            variant="outlined"
            sx={{
              display: "flex",
              flexDirection: "column",
              height: { xs: "auto", lg: "calc(100vh - 150px)" },
              minHeight: { xs: 420, lg: 0 },
              minWidth: 0,
              overflow: "hidden",
              position: { lg: "sticky" },
              top: { lg: 16 }
            }}
          >
            <CardContent
              sx={{
                display: "flex",
                flex: "1 1 auto",
                flexDirection: "column",
                minHeight: 0,
                p: 2,
                "&:last-child": { pb: 2 }
              }}
            >
              <Stack direction="row" spacing={1} sx={{ alignItems: "center", mb: 1 }}>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="h6">Selected Tunables</Typography>
                  <Typography color="text.secondary" variant="body2">
                    Watchlist from the Tuning tab.
                  </Typography>
                </Box>
                <IconButton
                  aria-label="Refresh selected tunables"
                  disabled={selectionLoading}
                  onClick={() => void refreshSelectedTunables()}
                >
                  <RefreshIcon />
                </IconButton>
                <IconButton aria-label="Close selected tunables" onClick={() => void setSavedTuningDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Stack>

              {selectionLoading && <LinearProgress sx={{ mb: 1 }} />}
              {selectionError && (
                <Alert severity="error" sx={{ mb: 1 }} onClose={() => setSelectionError(null)}>
                  {selectionError}
                </Alert>
              )}

              <Box sx={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", pr: 0.5 }}>
                {selectedTuningVariables.length > 0 ? (
                  <Stack spacing={1}>
                    {selectedTuningVariables.map((variable) => {
                      const type = variable.topic ? getWritableTopicType(variable.topic) : null;

                      return (
                        <Card key={variable.name} variant="outlined">
                          <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
                            <Stack spacing={1}>
                              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                  <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                                    {getTuningVariableLabel(variable)}
                                  </Typography>
                                  <Typography color="text.secondary" variant="caption">
                                    {getTuningOwnerLabel(variable)}
                                  </Typography>
                                </Box>
                                <Chip
                                  color={variable.topic ? "success" : "warning"}
                                  label={variable.topic ? String(variable.topic.type) : "offline"}
                                  size="small"
                                  variant={variable.topic ? "outlined" : "filled"}
                                />
                              </Stack>
                              <TextField
                                disabled={!variable.topic || !type || status !== "connected" || applying}
                                error={Boolean(rowErrors[variable.name])}
                                fullWidth
                                helperText={
                                  rowErrors[variable.name] ??
                                  (variable.topic ? `Live: ${formatRobotMetricValue(variable.topic.value)}` : "not published")
                                }
                                size="small"
                                value={drafts[variable.name] ?? (variable.topic ? topicValueToDraft(variable.topic.value) : "")}
                                onChange={(event) => updateDraft(variable.name, event.target.value)}
                              />
                            </Stack>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </Stack>
                ) : (
                  !selectionLoading && (
                    <Alert severity="info" variant="outlined">
                      No tuning variables are selected yet. Pick variables on the Tuning tab to pin them here.
                    </Alert>
                  )
                )}
              </Box>

              <Stack spacing={1} sx={{ borderTop: "1px solid", borderColor: "divider", mt: 1.5, pt: 1.5 }}>
                <Button
                  disabled={status !== "connected" || applying || pendingTuningVariables.length === 0}
                  fullWidth
                  onClick={() => void applyAllPendingTunables()}
                  variant="contained"
                >
                  {applying ? "Applying" : `Apply All${pendingTuningVariables.length > 0 ? ` (${pendingTuningVariables.length})` : ""}`}
                </Button>
                <Button
                  disabled={
                    topics.length === 0 || !window.powerlib?.readSubsystems || !window.powerlib?.readBindings
                  }
                  fullWidth
                  onClick={() => setSaveValuesOpen(true)}
                  variant="outlined"
                >
                  Save Values
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>

      <SaveTunedValuesDialog open={saveValuesOpen} topics={topics} onClose={() => setSaveValuesOpen(false)} />
    </Stack>
  );
}
