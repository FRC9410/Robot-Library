import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Tab, Tabs, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { LimelightInfo } from "./limelightUtils";

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

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h6">Limelights</Typography>
          <Typography color="text.secondary">
            Detected from Limelight NetworkTables topics.
          </Typography>
        </Box>
        <Chip label={`${limelights.length} detected`} color="primary" variant="outlined" />
      </Stack>

      <Card variant="outlined" sx={{ overflow: "hidden" }}>
        <Tabs
          value={activeLimelight.tableName}
          onChange={(_, value) => setActiveTableName(value)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: "divider", minHeight: 44 }}
        >
          {limelights.map((limelight) => (
            <Tab
              key={limelight.tableName}
              label={limelight.tableName}
              value={limelight.tableName}
              sx={{ minHeight: 44 }}
            />
          ))}
        </Tabs>

        <CardContent>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
              <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800 }}>{activeLimelight.tableName}</Typography>
                <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                  {activeLimelight.webUiUrl}
                </Typography>
              </Box>
              <Chip label={`${activeLimelight.topicCount} topics`} variant="outlined" />
              <Button
                component="a"
                href={activeLimelight.webUiUrl}
                target="_blank"
                rel="noreferrer"
                startIcon={<OpenInNewIcon />}
                variant="outlined"
              >
                Open
              </Button>
            </Stack>

            <Alert severity="info" variant="outlined">
              If the frame stays blank, verify your computer can resolve {activeLimelight.tableName}.local and that
              the Limelight web UI is reachable on port 5801.
            </Alert>

            <Box
              component="iframe"
              title={`${activeLimelight.tableName} Limelight web UI`}
              src={activeLimelight.webUiUrl}
              sx={{
                width: "100%",
                height: { xs: "65vh", md: "calc(100vh - 285px)" },
                minHeight: 520,
                border: 1,
                borderColor: "divider",
                borderRadius: 2,
                bgcolor: "background.default"
              }}
            />
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
