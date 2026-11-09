import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, Typography } from "@mui/material";
import type { IntegrationView } from "../../../electron/integrations/catalog";

export type IntegrationServerRowProps = {
  server: IntegrationView["servers"][number];
  disabled: boolean;
  onEnable: (enabled: boolean) => void;
  onCopy: (url: string) => void;
};

export function IntegrationServerRow({ server, disabled, onEnable, onCopy }: IntegrationServerRowProps) {
  const status = { stopped: server.enabled ? "Starts next launch" : "Off", starting: "Starting…", running: "Running", error: "Could not start" }[server.state];
  return <Box>
    <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between", flexWrap: "wrap" }}>
      <FormControlLabel control={<Checkbox checked={server.enabled} disabled={disabled} onChange={(_, checked) => onEnable(checked)} />}
        label={server.name} />
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="caption" color={server.state === "running" ? "success.main" : "text.secondary"}>{status}</Typography>
        {server.url && <Button size="small" onClick={() => onCopy(server.url!)}>Copy MCP URL</Button>}
      </Stack>
    </Stack>
    <Typography variant="body2" color="text.secondary">{server.description}</Typography>
    {server.error && <Alert severity="error" sx={{ mt: 1, overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{server.error}</Alert>}
  </Box>;
}
