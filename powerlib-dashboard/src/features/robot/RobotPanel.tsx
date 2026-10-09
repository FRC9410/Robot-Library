import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Card, CardActionArea, CardContent, Chip, Divider, IconButton,
  LinearProgress, Stack, Typography
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import TuneIcon from "@mui/icons-material/Tune";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import type { ConstantsFile } from "../constants/types";
import type { GeneratedSubsystem } from "../subsystems/types";
import { useTopics } from "../networktables/NetworkTablesContext";
import { createRobotCards } from "./robotModel";
import { RobotTuningDrawer } from "./RobotTuningDrawer";

type Props = { subsystems: GeneratedSubsystem[]; topics: NtTopicSnapshot[]; tuningRequested: boolean };

export function RobotPanel({ subsystems, topics, tuningRequested }: Props) {
  const tunables = useTopics("tuning");
  const [files, setFiles] = useState<ConstantsFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const cards = useMemo(() => createRobotCards(subsystems, topics, tunables, files), [subsystems, topics, tunables, files]);
  const active = cards.find(card => card.key === activeKey);
  const closeTunables = useCallback(() => setActiveKey(null), []);
  const saveConstants = useCallback((saved: ConstantsFile) => {
    setFiles(current => current.map(file => file.id === saved.id ? saved : file));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (window.powerlib?.readConstants) {
      setLoading(true);
      window.powerlib.readConstants().then(loaded => {
        if (!cancelled) { setFiles(loaded); setError(null); }
      }).catch(caught => {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Could not load constants groups.");
      }).finally(() => { if (!cancelled) setLoading(false); });
    }
    return () => { cancelled = true; };
  }, [subsystems]);

  async function refreshConstants() {
    if (!window.powerlib?.readConstants || loading) return;
    setLoading(true);
    try { setFiles(await window.powerlib.readConstants()); setError(null); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load constants groups."); }
    finally { setLoading(false); }
  }

  return <Box sx={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}>
    <Box sx={{ flex: 1, minWidth: 0, overflowY: "auto", py: 2, pr: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", mb: 2 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">Robot</Typography>
          <Typography variant="body2" color="text.secondary">Click a card to tune its values or change saved constants.</Typography>
        </Box>
        {window.powerlib?.readConstants && <IconButton aria-label="Refresh constants groups" disabled={loading} onClick={() => void refreshConstants()}><RefreshIcon /></IconButton>}
      </Stack>
      {loading && <LinearProgress sx={{ mb: 2 }} />}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {cards.length === 0 && <Alert severity="info">Subsystem and constants cards appear from the project configuration or live robot data.</Alert>}
      <Box sx={{ display: "grid", gap: 1.5, gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 280px), 1fr))" }}>
        {cards.map(card => <Card key={card.key} variant="outlined" sx={{ borderColor: activeKey === card.key ? "primary.main" : "divider" }}>
          <CardActionArea aria-label={`Open ${card.name} tunables`} aria-expanded={activeKey === card.key}
            onClick={() => setActiveKey(card.key)} sx={{ height: "100%" }}>
            <CardContent sx={{ p: 2, minHeight: 160 }}>
              <Stack spacing={1.25}>
                <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{card.name}</Typography><TuneIcon sx={{ color: "text.secondary" }} />
                </Stack>
                <Stack direction="row" spacing={1}><Chip label={card.type} size="small" /><Chip label={`${card.tunableCount} tunable${card.tunableCount === 1 ? "" : "s"}`} size="small" variant="outlined" /></Stack>
                <Divider />
                {card.metrics.length ? card.metrics.map(metric => <Stack key={metric.label} direction="row" spacing={1} sx={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <Typography variant="body2" color="text.secondary">{metric.label}</Typography>
                  <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere", textAlign: "right" }}>{metric.value}</Typography>
                </Stack>) : <Typography variant="body2" color="text.secondary">
                  {card.type === "constants" || card.type === "command" ? "Open to view this group's values." : "Waiting for NetworkTables data."}
                </Typography>}
              </Stack>
            </CardContent>
          </CardActionArea>
        </Card>)}
      </Box>
    </Box>
    {active && <RobotTuningDrawer groupKey={active.key} name={active.name} file={active.constantsFile}
      tuningRequested={tuningRequested} onClose={closeTunables} onSaved={saveConstants} />}
  </Box>;
}
