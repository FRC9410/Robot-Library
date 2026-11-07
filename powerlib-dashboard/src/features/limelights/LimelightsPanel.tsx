import { useEffect, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { LimelightInfo } from "./limelightUtils";
import { readWebUiOverride } from "./limelightUtils";

type LimelightsPanelProps = {
  limelights: LimelightInfo[];
};

export function LimelightsPanel({ limelights }: LimelightsPanelProps) {
  const [activeTableName, setActiveTableName] = useState(limelights[0]?.tableName ?? "");
  const activeLimelight =
    limelights.find((limelight) => limelight.tableName === activeTableName) ?? limelights[0] ?? null;

  useEffect(() => {
    if (!activeLimelight && limelights[0]) {
      setActiveTableName(limelights[0].tableName);
      return;
    }

    if (activeLimelight) {
      setActiveTableName(activeLimelight.tableName);
    }
  }, [activeLimelight, limelights]);

  if (limelights.length === 0 || !activeLimelight) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="h6">Limelights</Typography>
            <Typography color="text.secondary">
              No Limelight NetworkTables topics are currently visible.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  const url = readWebUiOverride(activeLimelight.tableName) ?? activeLimelight.webUiUrl;

  return (
    <Stack sx={{ flex: 1, minHeight: 0 }}>
      <Stack direction="row" sx={{ flexShrink: 0, alignItems: "center", py: 0.5 }}>
        <Tabs
          value={activeLimelight.tableName}
          onChange={(_, value) => setActiveTableName(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ flex: 1, minWidth: 0, minHeight: 44 }}
        >
          {limelights.map((limelight) => (
            <Tab
              key={limelight.tableName}
              label={limelight.tableName}
              value={limelight.tableName}
              sx={{ minHeight: 44, py: 0, justifyContent: "center" }}
            />
          ))}
        </Tabs>

        <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0, px: 1 }}>
          <Chip label={`${activeLimelight.topicCount} topics`} size="small" variant="outlined" />
          <Button
            component="a"
            href={url}
            target="_blank"
            rel="noreferrer"
            startIcon={<OpenInNewIcon />}
            size="small"
            variant="outlined"
          >
            Open
          </Button>
        </Stack>
      </Stack>

      <Card variant="outlined" sx={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <CardContent sx={{ flex: 1, minHeight: 0, display: "flex", px: 0, py: 0.5, "&:last-child": { pb: 0.5 } }}>
          <Box
            key={activeLimelight.tableName}
            component="iframe"
            title={`${activeLimelight.tableName} Limelight web UI`}
            src={url}
            sx={{
              width: "100%",
              border: 1,
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "background.default"
            }}
          />
        </CardContent>
      </Card>
    </Stack>
  );
}
