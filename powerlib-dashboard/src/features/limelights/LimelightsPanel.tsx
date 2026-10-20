import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { LimelightInfo } from "./limelightUtils";
import { normalizeWebUiUrl, readWebUiOverride, saveWebUiOverride } from "./limelightUtils";

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

        <LimelightConfiguration key={activeLimelight.tableName} limelight={activeLimelight} />
      </Card>
    </Stack>
  );
}

function LimelightConfiguration({ limelight }: { limelight: LimelightInfo }) {
  const [override, setOverride] = useState(() => readWebUiOverride(limelight.tableName) ?? "");
  const [draft, setDraft] = useState(override);
  const url = override || limelight.webUiUrl;
  const invalid = !!draft.trim() && !normalizeWebUiUrl(draft);
  function apply(value: string) {
    const next = normalizeWebUiUrl(value) ?? "";
    setOverride(next);
    setDraft(next);
    saveWebUiOverride(limelight.tableName, next || undefined);
  }
  return <CardContent>
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ alignItems: { md: "center" } }}>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }}>{limelight.tableName}</Typography>
          <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
            {url}
          </Typography>
        </Box>
        <Chip label={`${limelight.topicCount} topics`} variant="outlined" />
        <Button
          component="a"
          href={url}
          target="_blank"
          rel="noreferrer"
          startIcon={<OpenInNewIcon />}
          variant="outlined"
        >
          Open
        </Button>
      </Stack>

      <Stack component="form" direction={{ xs: "column", md: "row" }} spacing={1}
        onSubmit={event => { event.preventDefault(); if (!invalid) apply(draft); }}>
        <TextField label="Configuration URL" size="small" value={draft} error={invalid} fullWidth
          placeholder={limelight.webUiUrl} onChange={event => setDraft(event.target.value)}
          helperText={invalid ? "Enter an HTTP or HTTPS URL without credentials." : "Saved on this laptop per camera. Leave blank for the automatic address."} />
        <Button type="submit" variant="outlined" disabled={invalid} sx={{ alignSelf: "flex-start" }}>Apply</Button>
        <Button onClick={() => apply("")} sx={{ alignSelf: "flex-start" }}>Reset</Button>
      </Stack>
      <Alert severity="info" variant="outlined">
        If the frame stays blank, enter the camera's IP address, including http:// and port 5801, or use Open.
      </Alert>

      <Box
        component="iframe"
        title={`${limelight.tableName} Limelight web UI`}
        src={url}
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
  </CardContent>;
}
