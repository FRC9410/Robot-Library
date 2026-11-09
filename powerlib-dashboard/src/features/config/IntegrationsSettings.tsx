import { useEffect, useState } from "react";
import { Alert, Box, Stack, Typography } from "@mui/material";
import type { IntegrationView } from "../../../electron/integrations/catalog";
import { IntegrationCard } from "./IntegrationCard";

export function IntegrationsSettings() {
  const api = window.powerlib;
  const [integrations, setIntegrations] = useState<IntegrationView[]>();
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!api?.listIntegrations) return;
    let closed = false;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const result = await api!.listIntegrations();
        if (!closed) { setIntegrations(result); setLoadError(""); }
      } catch (caught) {
        if (!closed) setLoadError((caught as Error).message);
      } finally {
        if (!closed) timer = setTimeout(() => void refresh(), 1000);
      }
    }
    void refresh();
    return () => { closed = true; clearTimeout(timer); };
  }, [api]);

  async function run(action: () => Promise<void>, success = "") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setIntegrations(await api!.listIntegrations());
      setNotice(success);
      return true;
    } catch (caught) {
      setError((caught as Error).message);
      return false;
    } finally { setBusy(false); }
  }

  return <Box component="section" className="config-content" aria-label="Integrations settings">
    <Box className="config-content-heading"><Typography variant="h5" component="h3">Integrations</Typography></Box>
    <Box className="config-field-settings"><Stack spacing={2} sx={{ maxWidth: 860 }}>
      {!api?.listIntegrations && <Alert severity="info">Integrations are available in the Power Tool desktop app.</Alert>}
      {loadError && <Alert severity="error">{loadError}</Alert>}
      {error && <Alert severity="error" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>{error}</Alert>}
      {notice && <Alert severity="success">{notice}</Alert>}
      {api?.listIntegrations && !integrations && !loadError && <Typography>Loading integrations…</Typography>}
      {integrations?.length === 0 && <Typography>No integrations in this catalog.</Typography>}
      {integrations?.map(integration => <IntegrationCard key={integration.id} integration={integration} busy={busy}
        onInstall={() => void run(() => api!.installIntegration(integration.id))}
        onUninstall={() => void run(() => api!.uninstallIntegration(integration.id))}
        onEnable={(server, enabled) => void run(() => api!.enableIntegrationServer(integration.id, server, enabled))}
        onEnableAll={enabled => void run(() => api!.enableAllIntegrationServers(integration.id, enabled))}
        onSave={values => run(() => api!.saveIntegrationInputs(integration.id, values), "Settings saved for the next launch.")}
        onCopy={url => void run(() => navigator.clipboard.writeText(url), "MCP URL copied.")} />)}
    </Stack></Box>
  </Box>;
}
