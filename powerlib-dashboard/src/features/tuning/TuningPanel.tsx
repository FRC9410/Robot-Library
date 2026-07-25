import { useEffect, useMemo, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { SaveTunedValuesDialog } from "../networktables/SaveTunedValuesDialog";
import { useNetworkTables } from "../networktables/NetworkTablesContext";
import {
  getWritableTopicType,
  isTunableTopic,
  parseDraftValue,
  topicValueToDraft,
  tuningModeTopicName
} from "../networktables/tuningUtils";

type TunableVariableRowProps = {
  disabled: boolean;
  topic: NtTopicSnapshot;
  onApply: (topic: NtTopicSnapshot, type: NtTopicType, value: NtPrimitive) => Promise<void>;
};

function TunableVariableRow({ disabled, topic, onApply }: TunableVariableRowProps) {
  const type = getWritableTopicType(topic);
  const [draft, setDraft] = useState(topicValueToDraft(topic.value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(topicValueToDraft(topic.value));
    setError(null);
  }, [topic.name, topic.value]);

  if (!type) {
    return null;
  }
  const writableType = type;

  async function applyValue() {
    if (disabled) {
      return;
    }

    try {
      const value = parseDraftValue(writableType, draft);
      await onApply(topic, writableType, value);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 96px minmax(160px, 240px) 90px" }
      }}
    >
      <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere", pt: 1 }}>{topic.name}</Typography>
      <Box sx={{ pt: 0.75 }}>
        <Chip label={writableType} size="small" variant="outlined" />
      </Box>
      <TextField
        error={Boolean(error)}
        helperText={error ?? " "}
        size="small"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            applyValue();
          }
        }}
      />
      <Button disabled={disabled} onClick={applyValue} size="small" variant="contained">
        Apply
      </Button>
    </Box>
  );
}

export function TuningPanel() {
  const { clientRef, status, topics, upsertTopic } = useNetworkTables();
  const [saveValuesOpen, setSaveValuesOpen] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);

  const tunableTopics = useMemo(() => {
    return topics.filter(isTunableTopic).sort((left, right) => left.name.localeCompare(right.name));
  }, [topics]);
  const tuningModeTopic = topics.find((topic) => topic.name === tuningModeTopicName);
  const tuningModeEnabled = tuningModeTopic?.value === true;

  async function applyTunableTopic(topic: NtTopicSnapshot, type: NtTopicType, value: NtPrimitive) {
    try {
      await clientRef.current.publish(topic.name, type, value);
      upsertTopic({
        ...topic,
        type,
        value,
        lastChangedTime: Date.now()
      });
      setPanelError(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      setPanelError(message);
      throw new Error(message);
    }
  }

  return (
    <Stack spacing={2}>
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={1.5}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ alignItems: { md: "center" } }}>
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="h6">Tuning</Typography>
                <Typography variant="body2" color="text.secondary">
                  Apply stages command and subsystem values in NetworkTables. Save Values writes selected changes back
                  to JSON so Update Code can regenerate them later.
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Button
                  disabled={tunableTopics.length === 0 || !window.powerlib?.readSubsystems || !window.powerlib?.readBindings}
                  onClick={() => setSaveValuesOpen(true)}
                  size="small"
                  variant="outlined"
                >
                  Save Values
                </Button>
                <Chip
                  color={tuningModeEnabled ? "warning" : "default"}
                  label={tuningModeEnabled ? "tuning armed" : "tuning safe"}
                  size="small"
                  variant={tuningModeEnabled ? "filled" : "outlined"}
                />
              </Stack>
            </Stack>

            <Alert severity={tuningModeEnabled ? "warning" : "info"} variant="outlined">
              {tuningModeEnabled
                ? "Tuning mode is on: applied values can change subsystem gains and generated command targets live."
                : "Tuning mode is off: applied values are staged in NetworkTables, but robot code uses generated constants/defaults."}
            </Alert>
            {panelError && (
              <Alert severity="error" onClose={() => setPanelError(null)}>
                {panelError}
              </Alert>
            )}

            {tunableTopics.length > 0 ? (
              <Stack spacing={1}>
                {tunableTopics.map((topic) => (
                  <TunableVariableRow
                    key={topic.name}
                    disabled={status !== "connected"}
                    topic={topic}
                    onApply={(changedTopic, type, value) => applyTunableTopic(changedTopic, type, value)}
                  />
                ))}
              </Stack>
            ) : (
              <Alert severity="info" variant="outlined">
                No live tunable variables are published yet. Generated subsystem PID values and generated command values
                will appear here while robot code is running.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <SaveTunedValuesDialog open={saveValuesOpen} topics={topics} onClose={() => setSaveValuesOpen(false)} />
    </Stack>
  );
}
