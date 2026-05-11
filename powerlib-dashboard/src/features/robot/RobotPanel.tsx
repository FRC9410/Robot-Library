import { useMemo } from "react";
import { Alert, Box, Card, CardContent, Chip, Divider, Stack, Typography } from "@mui/material";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
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
  subsystems: GeneratedSubsystem[];
  topics: NtTopicSnapshot[];
};

const dataPrefix = "/SmartDashboard/PowerLib/Data/";

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

function createTiles(subsystems: GeneratedSubsystem[], topics: NtTopicSnapshot[]) {
  const dataTopics = topics.filter((topic) => topic.name.startsWith(dataPrefix));

  return subsystems.map<RobotSubsystemTile>((subsystem, index) => {
    const subsystemTopicKey = getSubsystemTopicKey(subsystem, index);
    const metrics = dataTopics
      .map((topic) => {
        const [topicSubsystem, ...metricParts] = topic.name.slice(dataPrefix.length).split("/").filter(Boolean);
        if (topicSubsystem !== subsystemTopicKey || metricParts.length === 0) {
          return null;
        }

        const metricKey = metricParts.join(" ");
        return {
          label: formatMetricLabel(metricKey),
          value: stringifyValue(topic.value),
          type: String(topic.type)
        };
      })
      .filter((metric): metric is RobotMetric => metric !== null)
      .sort((left, right) => metricSortValue(left) - metricSortValue(right) || left.label.localeCompare(right.label));

    const connectedMetric = metrics.find((metric) => metric.label.toLowerCase() === "connected");
    const visibleMetrics = metrics.filter((metric) => metric.label.toLowerCase() !== "connected");

    return {
      id: subsystem.id || subsystem.name || `subsystem-${index}`,
      name: getSubsystemDisplayName(subsystem, index),
      type: subsystem.type || "subsystem",
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
  const tiles = useMemo(() => createTiles(subsystems, topics), [subsystems, topics]);

  return (
    <Stack spacing={2}>
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
