import { useId, useState } from "react";
import { Box, Button, Checkbox, Collapse, Divider, Stack, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { IntegrationView, InputValues } from "../../../electron/integrations/catalog";
import { IntegrationInputFields } from "./IntegrationInputFields";
import { IntegrationServerRow } from "./IntegrationServerRow";

export type IntegrationCardProps = {
  integration: IntegrationView;
  busy: boolean;
  onInstall: () => void;
  onUninstall: () => void;
  onEnable: (server: string, enabled: boolean) => void;
  onEnableAll: (enabled: boolean) => void;
  onSave: (values: InputValues) => Promise<boolean>;
  onCopy: (url: string) => void;
};

export function IntegrationCard({ integration, busy, onInstall, onUninstall, onEnable, onEnableAll, onSave, onCopy }: IntegrationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const enabledCount = integration.servers.filter(server => server.enabled).length;
  const allEnabled = enabledCount > 0 && enabledCount === integration.servers.length;
  return <Box component="section" className="config-expander">
    <Box className="config-expander-header" sx={{ pl: 1, gap: 0 }}>
      <Checkbox checked={allEnabled} disabled={busy || !integration.installed || !integration.servers.length}
        slotProps={{ input: { "aria-label": `Select all in ${integration.name}`, "aria-describedby": `${id}-selection` } }}
        onChange={(_, checked) => onEnableAll(checked)} />
      <Box component="button" type="button" className="config-expander-toggle" id={`${id}-heading`}
        aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded(current => !current)}>
        <ExpandMoreIcon sx={{ flexShrink: 0, transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms" }} />
        <Typography component="span" variant="subtitle1" noWrap>{integration.name}</Typography>
      </Box>
      <Stack direction="row" spacing={1.5} sx={{ flexShrink: 0, alignItems: "center" }}>
        <Typography id={`${id}-selection`} variant="caption" color="text.secondary">{enabledCount}/{integration.servers.length} selected</Typography>
        <Button size="small" variant={integration.installed ? "outlined" : "contained"} color={integration.installed ? "error" : "primary"}
          disabled={busy || integration.installing} onClick={integration.installed ? onUninstall : onInstall}>
          {integration.installing ? "Installing…" : integration.installed ? "Uninstall" : "Install"}
        </Button>
      </Stack>
    </Box>
    <Collapse in={expanded}>
      <Stack id={id} role="region" aria-labelledby={`${id}-heading`} className="config-expander-details" spacing={2}>
        <Typography variant="body2" color="text.secondary">{integration.description}</Typography>
        <Typography variant="caption" color="text.secondary">
          Git is required to install. Running the servers requires {integration.requirements.commands.join(", ")} and Python {integration.requirements.python}.
        </Typography>
        <Divider />
        {integration.servers.map(server => <IntegrationServerRow key={server.id} server={server} disabled={busy || !integration.installed}
          onEnable={enabled => onEnable(server.id, enabled)} onCopy={onCopy} />)}
        {integration.installed && <><Divider /><IntegrationInputFields integration={integration} disabled={busy} onSave={onSave} /></>}
      </Stack>
    </Collapse>
  </Box>;
}
