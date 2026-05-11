import { useMemo } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Divider,
  Stack,
  Typography
} from "@mui/material";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { ConnectionState } from "../../types/app";
import type { GeneratedSubsystem } from "../subsystems/types";
import { stringifyValue } from "../subsystems/subsystemUtils";

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

type RobotPanelProps = {
  status: ConnectionState;
  host: string;
  port: number;
  subsystems: GeneratedSubsystem[];
  topics: NtTopicSnapshot[];
};

const dataPrefix = "/SmartDashboard/PowerLib/Data/";

function normalizeKey(value: string) {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function toPascalCase(value: string) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join("");
}

function formatMetricLabel(rawMetric: string) {
  const spaced = rawMetric
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/Rotations/g, " rotations")
    .replace(/Volts/g, " volts")
    .trim();

  return spaced || "Value";
}

function getSubsystemCandidates(subsystem: GeneratedSubsystem) {
  return [subsystem.name, subsystem.id, subsystem.name ? toPascalCase(subsystem.name) : undefined]
    .filter((value): value is string => Boolean(value))
    .map((value) => ({ raw: value, normalized: normalizeKey(value) }))
    .filter((candidate, index, candidates) => candidates.findIndex((item) => item.normalized === candidate.normalized) === index);
}

function metricSortValue(metric: RobotMetric) {
  const order = ["Connected", "Velocity", "Position", "Setpoint", "Applied volts"];
  const index = order.findIndex((label) => metric.label.toLowerCase().startsWith(label.toLowerCase()));
  return index === -1 ? order.length : index;
}

function createTiles(subsystems: GeneratedSubsystem[], topics: NtTopicSnapshot[]) {
  const dataTopics = topics.filter((topic) => topic.name.startsWith(dataPrefix));

  return subsystems.map<RobotSubsystemTile>((subsystem, index) => {
    const candidates = getSubsystemCandidates(subsystem);
    const metrics = dataTopics
      .map((topic) => {
        const key = topic.name.slice(dataPrefix.length);
        const normalizedKey = normalizeKey(key);
        const match = candidates.find((candidate) => normalizedKey.startsWith(candidate.normalized));
        if (!match) {
          return null;
        }

        const metricKey = key.startsWith(match.raw) ? key.slice(match.raw.length) : key;
        return {
          label: formatMetricLabel(metricKey),
          value: stringifyValue(topic.value),
          type: String(topic.type)
        };
      })
      .filter((metric): metric is RobotMetric => metric !== null)
      .sort((left, right) => metricSortValue(left) - metricSortValue(right) || left.label.localeCompare(right.label));

    const connectedMetric = metrics.find((metric) => metric.label.toLowerCase() === "connected");

    return {
      id: subsystem.id || subsystem.name || `subsystem-${index}`,
      name: subsystem.name || subsystem.id || `Subsystem ${index + 1}`,
      type: subsystem.type || "subsystem",
      connected:
        connectedMetric?.value.toLowerCase() === "true"
          ? true
          : connectedMetric?.value.toLowerCase() === "false"
            ? false
            : undefined,
      metrics
    };
  });
}

export function RobotPanel({ status, host, port, subsystems, topics }: RobotPanelProps) {
  const tiles = useMemo(() => createTiles(subsystems, topics), [subsystems, topics]);

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h6">Robot</Typography>
              <Typography variant="body2" color="text.secondary">
                {host}:{port} · {tiles.length} configured subsystem{tiles.length === 1 ? "" : "s"}
              </Typography>
            </Box>
            <Chip
              label={status}
              color={status === "connected" ? "success" : status === "connecting" ? "warning" : "default"}
              variant={status === "idle" ? "outlined" : "filled"}
            />
          </Stack>
        </CardContent>
      </Card>

      {tiles.length === 0 && (
        <Alert severity="info" variant="outlined">
          No generated subsystem document was found for robot tiles.
        </Alert>
      )}

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: {
            xs: "1fr",
            md: "repeat(2, minmax(0, 1fr))",
            xl: "repeat(3, minmax(0, 1fr))"
          }
        }}
      >
        {tiles.map((tile) => (
          <Card key={tile.id} variant="outlined" sx={{ minHeight: 220 }}>
            <CardContent>
              <Stack spacing={1.5}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6">{tile.name}</Typography>
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
                  <Box sx={{ display: "grid", gap: 1 }}>
                    {tile.metrics.map((metric) => (
                      <Box
                        key={`${tile.id}-${metric.label}`}
                        sx={{
                          alignItems: "baseline",
                          display: "grid",
                          gap: 1,
                          gridTemplateColumns: "minmax(120px, 0.8fr) minmax(0, 1fr)"
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
  );
}
