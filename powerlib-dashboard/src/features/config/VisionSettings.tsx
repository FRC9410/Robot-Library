import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Divider, IconButton, Stack, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import { defaultLimelightSettings, type VisionConfig } from "../../../electron/visionConfig";
import { LimelightEditor } from "./LimelightEditor";
import { VisionCameraSettingsForm } from "./VisionCameraSettingsForm";

export function VisionSettings() {
  const [vision, setVision] = useState<VisionConfig>({ ...defaultLimelightSettings, limelights: [] });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    Promise.resolve().then(() => {
      if (!window.powerlib?.readVisionConfig) throw Error("PowerLib file bridge is not available.");
      return window.powerlib.readVisionConfig();
    }).then(result => { if (active) setVision(result.vision); })
      .catch(caught => { if (active) setError(caught instanceof Error ? caught.message : "Could not load Vision config."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  async function save(next: VisionConfig) {
    if (!window.powerlib?.saveVisionConfig) throw Error("PowerLib file bridge is not available.");
    setSaving(true);
    setSaved(false);
    try {
      const result = await window.powerlib.saveVisionConfig(next);
      setVision(result.vision);
      setEditing(null);
      setError("");
      setSaved(true);
    } finally { setSaving(false); }
  }
  async function remove(index: number) {
    try { await save({ ...vision, limelights: vision.limelights.filter((_, current) => current !== index) }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not delete Limelight."); }
  }
  function editor(index: number | "new") {
    return <LimelightEditor camera={index === "new" ? { name: "limelight-" } : vision.limelights[index]}
      others={vision.limelights.filter((_, current) => current !== index)} saving={saving} onCancel={() => setEditing(null)}
      onSave={camera => save({ ...vision, limelights: index === "new" ? [...vision.limelights, camera] : vision.limelights.map((existing, current) => current === index ? camera : existing) })} />;
  }
  return <Box className="config-content">
    <Box className="config-content-heading"><Box>
      <Typography variant="h5" component="h3">Vision</Typography>
    </Box></Box>
    <Box className="config-subsystem-list"><Stack spacing={2}>
      {loading ? <Stack direction="row" spacing={1.5} role="status"><CircularProgress size={20} /><Typography>Loading Vision config…</Typography></Stack>
        : <>
          {error && <Alert severity="error" action={<Button color="inherit" disabled={saving} onClick={() => setReload(value => value + 1)}>Reload</Button>}>{error}</Alert>}
          <Box component="section" aria-label="Vision configuration" className="config-expander" sx={{ p: 2 }}>
            <Stack spacing={3}>
              <Box component="section" aria-label="Limelights"><Stack spacing={2}>
                <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>Limelights</Typography>
                <Stack divider={<Divider />}>
                  {vision.limelights.map((camera, index) => <Box key={camera.name}>
                    <Stack direction="row" spacing={1} sx={{ py: 1, alignItems: "center" }}>
                      <Box sx={{ flex: 1, minWidth: 0 }}><Typography sx={{ fontWeight: 650, overflowWrap: "anywhere" }}>{camera.name}</Typography></Box>
                      <IconButton aria-label={`Edit ${camera.name}`} disabled={saving || editing !== null} onClick={() => { setEditing(index); setSaved(false); }}><EditOutlinedIcon /></IconButton>
                      <IconButton aria-label={`Delete ${camera.name}`} disabled={saving || editing !== null} onClick={() => void remove(index)}><DeleteIcon /></IconButton>
                    </Stack>
                    {editing === index && <Box sx={{ pb: 2 }}>{editor(index)}</Box>}
                  </Box>)}
                </Stack>
                {!vision.limelights.length && editing !== "new" && !error && <Typography color="text.secondary">No Limelights configured.</Typography>}
                {editing === "new" && editor("new")}
                {editing === null && <Box><Button variant="contained" startIcon={<AddIcon />} disabled={saving || !!error}
                  onClick={() => { setEditing("new"); setSaved(false); }}>Add Limelight</Button></Box>}
              </Stack></Box>
              <Divider />
              <VisionCameraSettingsForm vision={vision} disabled={saving || editing !== null || !!error} onSave={settings => save({ ...vision, ...settings })} />
            </Stack>
          </Box>
          {saved && <Alert severity="success">Vision settings saved to Java. Build and deploy to apply them to the robot.</Alert>}
        </>}
    </Stack></Box>
  </Box>;
}
