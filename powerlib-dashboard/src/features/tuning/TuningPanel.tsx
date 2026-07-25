import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Chip, Stack, TextField, Typography } from "@mui/material";
import type { NtPrimitive, NtTopicSnapshot, NtTopicType } from "../../networktables/nt4Client";
import { SaveTunedValuesDialog } from "../networktables/SaveTunedValuesDialog";
import { useNetworkTables } from "../networktables/NetworkTablesContext";
import {
  getWritableTopicType,
  isTunableTopic,
  parseDraftValue,
  tuningModeRequestTopicName,
  topicValueToDraft,
  tuningModeTopicName
} from "../networktables/tuningUtils";

type TunableVariableRowProps = {
  disabled: boolean;
  draft: string;
  error: string | null;
  topic: NtTopicSnapshot;
  onDraftChange: (topicName: string, draft: string) => void;
  onRequestApply: () => void;
};

function TunableVariableRow({
  disabled,
  draft,
  error,
  topic,
  onDraftChange,
  onRequestApply
}: TunableVariableRowProps) {
  const type = getWritableTopicType(topic);

  if (!type) {
    return null;
  }
  const writableType = type;

  return (
    <Box
      sx={{
        alignItems: "start",
        display: "grid",
        gap: 1,
        gridTemplateColumns: { xs: "1fr", md: "minmax(260px, 1fr) 96px minmax(160px, 240px)" }
      }}
    >
      <Typography sx={{ fontFamily: "monospace", overflowWrap: "anywhere", pt: 1 }}>{topic.name}</Typography>
      <Box sx={{ pt: 0.75 }}>
        <Chip label={writableType} size="small" variant="outlined" />
      </Box>
      <TextField
        disabled={disabled}
        error={Boolean(error)}
        helperText={error ?? " "}
        size="small"
        value={draft}
        onChange={(event) => onDraftChange(topic.name, event.target.value)}
        onKeyDown={(event) => {
          if (!disabled && event.key === "Enter") {
            onRequestApply();
          }
        }}
      />
    </Box>
  );
}

export function TuningPanel() {
  const { clientRef, status, topics, upsertTopic } = useNetworkTables();
  const [saveValuesOpen, setSaveValuesOpen] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [applying, setApplying] = useState(false);
  const lastTopicDraftsRef = useRef<Record<string, string>>({});

  const tunableTopics = useMemo(() => {
    return topics.filter(isTunableTopic).sort((left, right) => left.name.localeCompare(right.name));
  }, [topics]);
  const tuningModeTopic = topics.find((topic) => topic.name === tuningModeTopicName);
  const tuningModeRequestTopic = topics.find((topic) => topic.name === tuningModeRequestTopicName);
  const tuningModeEnabled = tuningModeTopic?.value === true;
  const tuningModeRequested = tuningModeRequestTopic?.value === true;

  useEffect(() => {
    const nextTopicDrafts = Object.fromEntries(
      tunableTopics.map((topic) => [topic.name, topicValueToDraft(topic.value)])
    );

    setDrafts((current) => {
      const next: Record<string, string> = {};
      tunableTopics.forEach((topic) => {
        const currentDraft = current[topic.name];
        const previousTopicDraft = lastTopicDraftsRef.current[topic.name];
        const hasLocalEdit =
          currentDraft !== undefined &&
          previousTopicDraft !== undefined &&
          currentDraft !== previousTopicDraft;

        next[topic.name] = hasLocalEdit ? currentDraft : nextTopicDrafts[topic.name];
      });
      return next;
    });

    setRowErrors((current) => {
      const next: Record<string, string | null> = {};
      tunableTopics.forEach((topic) => {
        next[topic.name] = current[topic.name] ?? null;
      });
      return next;
    });

    lastTopicDraftsRef.current = nextTopicDrafts;
  }, [tunableTopics]);

  const pendingTopics = useMemo(() => {
    return tunableTopics.filter((topic) => {
      const baseline = topicValueToDraft(topic.value);
      return (drafts[topic.name] ?? baseline) !== baseline;
    });
  }, [drafts, tunableTopics]);

  function updateDraft(topicName: string, draft: string) {
    setDrafts((current) => ({ ...current, [topicName]: draft }));
    setRowErrors((current) => ({ ...current, [topicName]: null }));
  }

  async function applyPendingChanges() {
    if (status !== "connected" || applying || pendingTopics.length === 0) {
      return;
    }

    const nextErrors: Record<string, string | null> = {};
    const changes: Array<{ topic: NtTopicSnapshot; type: NtTopicType; value: NtPrimitive }> = [];

    pendingTopics.forEach((topic) => {
      const type = getWritableTopicType(topic);
      if (!type) {
        return;
      }

      try {
        changes.push({
          topic,
          type,
          value: parseDraftValue(type, drafts[topic.name] ?? topicValueToDraft(topic.value))
        });
        nextErrors[topic.name] = null;
      } catch (caught) {
        nextErrors[topic.name] = caught instanceof Error ? caught.message : String(caught);
      }
    });

    const invalidCount = Object.values(nextErrors).filter(Boolean).length;
    setRowErrors((current) => ({ ...current, ...nextErrors }));
    if (invalidCount > 0) {
      setPanelError(`Fix ${invalidCount} invalid value${invalidCount === 1 ? "" : "s"} before applying.`);
      return;
    }

    setApplying(true);
    try {
      const results = await Promise.allSettled(
        changes.map(async ({ topic, type, value }) => {
          await clientRef.current.publish(topic.name, type, value);
          upsertTopic({
            ...topic,
            type,
            value,
            lastChangedTime: Date.now()
          });
        })
      );

      const failures = results.filter((result) => result.status === "rejected");
      if (failures.length > 0) {
        const firstFailure = failures[0];
        const reason = firstFailure.status === "rejected" ? firstFailure.reason : null;
        const message = reason instanceof Error ? reason.message : "Could not apply one or more tunables.";
        setPanelError(`Applied ${changes.length - failures.length} of ${changes.length}; ${message}`);
        return;
      }

      setPanelError(null);
    } finally {
      setApplying(false);
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
                <Chip label={`${pendingTopics.length} pending`} size="small" variant="outlined" />
                <Button
                  disabled={status !== "connected" || applying || pendingTopics.length === 0}
                  onClick={() => void applyPendingChanges()}
                  size="small"
                  variant="contained"
                >
                  {applying ? "Applying" : "Apply Changes"}
                </Button>
                <Button
                  disabled={tunableTopics.length === 0 || !window.powerlib?.readSubsystems || !window.powerlib?.readBindings}
                  onClick={() => setSaveValuesOpen(true)}
                  size="small"
                  variant="outlined"
                >
                  Save Values
                </Button>
              </Stack>
            </Stack>

            <Alert severity={tuningModeEnabled ? "warning" : "info"} variant="outlined">
              {tuningModeEnabled
                ? "Tuning mode is on: applied values can change subsystem gains and generated command targets live."
                : "Tuning mode is off: applied values are staged in NetworkTables, but robot code uses generated constants/defaults."}
              {tuningModeRequestTopic && tuningModeRequested !== tuningModeEnabled
                ? ` Requested mode is ${tuningModeRequested ? "on" : "off"}; waiting for robot acknowledgement.`
                : ""}
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
                    disabled={status !== "connected" || applying}
                    draft={drafts[topic.name] ?? topicValueToDraft(topic.value)}
                    error={rowErrors[topic.name] ?? null}
                    topic={topic}
                    onDraftChange={updateDraft}
                    onRequestApply={() => void applyPendingChanges()}
                  />
                ))}
              </Stack>
            ) : (
              <Alert severity="info" variant="outlined">
                No live tunable variables are published yet. Generated subsystem control values and generated command
                values will appear here while robot code is running.
              </Alert>
            )}
          </Stack>
        </CardContent>
      </Card>

      <SaveTunedValuesDialog open={saveValuesOpen} topics={topics} onClose={() => setSaveValuesOpen(false)} />
    </Stack>
  );
}
