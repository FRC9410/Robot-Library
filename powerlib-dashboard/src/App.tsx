import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  FormControlLabel,
  Snackbar,
  Stack,
  Switch,
  Tab,
  Tabs,
  Toolbar,
  Typography
} from "@mui/material";
import CableIcon from "@mui/icons-material/Cable";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import VideocamIcon from "@mui/icons-material/Videocam";
import { ConfigDialog } from "./features/config/ConfigDialog";
import type {
  GeneratedSubsystem,
  SubsystemDocumentState
} from "./features/subsystems/types";
import { summarizeUpdateOutput } from "./features/subsystems/subsystemUtils";
import { UpdateCodeDialog } from "./features/subsystems/components/UpdateCodeDialog";
import { NetworkTablesPanel } from "./features/networktables/NetworkTablesPanel";
import { NetworkTablesProvider, useNetworkTables, useTopics } from "./features/networktables/NetworkTablesContext";
import { ConnectionSettingsDialog } from "./features/networktables/ConnectionSettingsDialog";
import { tuningModeRequestTopicName, tuningModeTopicName } from "./features/networktables/tuningUtils";
import { DashboardPanel } from "../dashboard";
import { LimelightsPanel } from "./features/limelights/LimelightsPanel";
import { detectLimelights } from "./features/limelights/limelightUtils";
import type { AppView } from "./types/app";
import { TuningModeSync } from "./networktables/TuningModeSync";
import { tuningUpdateIntervalMs } from "./networktables/telemetryTiming";

type ToastState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

const networkTableWatchPrefixes = ["/PowerLib/Data", "/PowerLib/Subsystems/Drive/Data/",
  "/PowerLib/Subsystems/Swerve/Data/", "/PowerLib/Drive/",
  "/SmartDashboard/", "/Robot/", "/CameraPublisher/", "/limelight"];
const autoConnectPausedKey = "powerlib.autoConnectPaused";

function readAutoConnectPaused() {
  try {
    return window.localStorage.getItem(autoConnectPausedKey) === "true";
  } catch {
    return false;
  }
}

export function App() {
  return (
    <NetworkTablesProvider>
      <AppContent />
    </NetworkTablesProvider>
  );
}

function AppContent() {
  const {
    clientRef,
    status,
    setStatus,
    connectionSettings,
    setConnectionSettings,
    telemetryError,
    setTopics,
    upsertTopic,
    pruneTopics
  } = useNetworkTables();
  const topics = useTopics("app");
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [subsystemDocument, setSubsystemDocument] = useState<SubsystemDocumentState>({
    loading: false,
    exists: false,
    path: "",
    subsystems: [],
    error: null
  });
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info"
  });
  const [subsystemUpdatingCode, setSubsystemUpdatingCode] = useState(false);
  const [installSectionUpdating, setInstallSectionUpdating] = useState<string | null>(null);
  const [powerToolUpdating, setPowerToolUpdating] = useState(false);
  const [connectionSettingsOpen, setConnectionSettingsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [desiredTuningMode, setDesiredTuningMode] = useState<boolean | null>(null);
  const tuningSyncRef = useRef<TuningModeSync | null>(null);
  if (tuningSyncRef.current === null) {
    tuningSyncRef.current = new TuningModeSync(
      enabled => clientRef.current.publish(tuningModeRequestTopicName, "boolean", enabled),
      message => showToast(`Could not synchronize tuning: ${message}`, "error")
    );
  }
  const latestTopicsRef = useRef(topics);
  latestTopicsRef.current = topics;
  const updateSubsystemCodeRef = useRef<() => Promise<void>>(async () => {});
  const updateInstallSectionRef = useRef<(section: string) => Promise<void>>(async () => {});
  const updatePowerToolRef = useRef<() => Promise<void>>(async () => {});
  const autoConnectPausedRef = useRef<boolean | null>(null);
  if (autoConnectPausedRef.current === null) autoConnectPausedRef.current = readAutoConnectPaused();
  const connectionStatusRef = useRef(status);
  const automaticConnectRef = useRef<() => void>(() => {});
  connectionStatusRef.current = status;
  const tuningModeTopic = topics.find((topic) => topic.name === tuningModeTopicName);
  const tuningModeRequestTopic = topics.find((topic) => topic.name === tuningModeRequestTopicName);
  const networkTuningMode =
    tuningModeRequestTopic?.value === true || (!tuningModeRequestTopic && tuningModeTopic?.value === true);
  const tuningModeEnabled = desiredTuningMode ?? networkTuningMode;
  const tuningModePending = status === "connected" && tuningModeTopic?.value !== tuningModeEnabled;
  const limelights = useMemo(() => detectLimelights(topics), [topics]);

  function showToast(message: string, severity: ToastState["severity"] = "info") {
    setToast({
      open: true,
      message,
      severity
    });
  }

  async function loadSubsystems() {
    setSubsystemDocument((current) => ({ ...current, loading: true, error: null }));

    try {
      if (!window.powerlib?.readSubsystems) {
        throw new Error("PowerLib file bridge is not available.");
      }

      const result = await window.powerlib.readSubsystems();
      setSubsystemDocument({
        loading: false,
        exists: result.exists,
        path: result.path,
        subsystems: result.subsystems as GeneratedSubsystem[],
        error: result.error ?? null
      });
    } catch (caught) {
      setSubsystemDocument((current) => ({
        ...current,
        loading: false,
        error: caught instanceof Error ? caught.message : "Could not load generated subsystems."
      }));
    }
  }

  async function saveSubsystems(subsystems: GeneratedSubsystem[]) {
    if (!window.powerlib?.saveSubsystems) {
      throw new Error("PowerLib file bridge is not available.");
    }

    const result = await window.powerlib.saveSubsystems(subsystems);
    setSubsystemDocument({
      loading: false,
      exists: result.exists,
      path: result.path,
      subsystems: result.subsystems as GeneratedSubsystem[],
      error: null
    });
  }

  async function updateSubsystemCode() {
    if (subsystemUpdatingCode) {
      return;
    }

    setSubsystemUpdatingCode(true);
    setSubsystemDocument((current) => ({ ...current, error: null }));

    try {
      if (!window.powerlib?.updateSubsystemCode) {
        throw new Error("PowerLib update bridge is not available.");
      }

      const result = await window.powerlib.updateSubsystemCode();
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      showToast(output ? summarizeUpdateOutput(output) : "Updated generated subsystem code.", "success");
      await loadSubsystems();
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not update generated subsystem code.", "error");
    } finally {
      setSubsystemUpdatingCode(false);
    }
  }

  async function updatePowerTool() {
    if (powerToolUpdating) {
      return;
    }

    setPowerToolUpdating(true);

    try {
      if (!window.powerlib?.updatePowerTool) {
        throw new Error("Power Tool updater is not available.");
      }

      await window.powerlib.updatePowerTool();
      showToast("Started Power Tool update. The app will restart when it finishes.", "info");
    } catch (caught) {
      setPowerToolUpdating(false);
      showToast(caught instanceof Error ? caught.message : "Could not start Power Tool update.", "error");
    }
  }

  const installSectionLabels: Record<string, string> = {
    lib: "PowerLib library files",
    vendordeps: "vendor dependencies"
  };

  const installSectionSuccessMessages: Record<string, string> = {
    lib: "Updated PowerLib library files.",
    vendordeps: "Updated vendor dependencies."
  };

  const installSectionFailureMessages: Record<string, string> = {
    lib: "Could not update PowerLib library files.",
    vendordeps: "Could not update vendor dependencies."
  };

  async function updateInstallSection(section: string) {
    if (installSectionUpdating) {
      return;
    }

    const label = installSectionLabels[section] ?? section;
    setInstallSectionUpdating(label);

    try {
      if (!window.powerlib?.updateInstallSection) {
        throw new Error("PowerLib installer bridge is not available.");
      }

      await window.powerlib.updateInstallSection(section);
      showToast(installSectionSuccessMessages[section] ?? `Updated ${label}.`, "success");
      if (section === "lib") {
        await loadSubsystems();
      }
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : installSectionFailureMessages[section] ?? `Could not update ${label}.`, "error");
    } finally {
      setInstallSectionUpdating(null);
    }
  }

  function setAutoConnectPaused(paused: boolean) {
    autoConnectPausedRef.current = paused;
    try {
      window.localStorage.setItem(autoConnectPausedKey, String(paused));
    } catch {
      // Keep the current session's preference when browser storage is unavailable.
    }
  }

  function attemptNetworkTablesConnection(reportErrors: boolean) {
    tuningSyncRef.current!.connectionChanged(false);
    connectionStatusRef.current = "connecting";
    setStatus("connecting");
    setTopics([]);

    try {
      clientRef.current.connect(connectionSettings.host, connectionSettings.port, (connected) => {
        tuningSyncRef.current!.connectionChanged(connected);
        const nextStatus = connected ? "connected" : "disconnected";
        connectionStatusRef.current = nextStatus;
        setStatus(nextStatus);
      });
      networkTableWatchPrefixes.forEach((prefix) => {
        clientRef.current.watchPrefix(prefix, upsertTopic);
      });
      clientRef.current.watchPrefix("/PowerLib/", upsertTopic, tuningUpdateIntervalMs);
      clientRef.current.watchCameraAnnouncements(upsertTopic);
    } catch (caught) {
      tuningSyncRef.current!.connectionChanged(false);
      clientRef.current.disconnect();
      connectionStatusRef.current = "disconnected";
      setStatus("disconnected");
      if (reportErrors) {
        showToast(caught instanceof Error ? caught.message : "Could not connect to NetworkTables.", "error");
      }
    }
  }

  function connectNetworkTables() {
    setAutoConnectPaused(false);
    attemptNetworkTablesConnection(true);
  }

  useEffect(() => {
    if (status !== "connected" || activeView !== "networktables") return;
    const stop = clientRef.current.watchPrefix("/", upsertTopic);
    return () => {
      stop();
      pruneTopics(snapshot => clientRef.current.isWatchedValue(snapshot.name));
    };
  }, [status, activeView, clientRef, upsertTopic, pruneTopics]);

  function disconnectNetworkTables() {
    setAutoConnectPaused(true);
    clientRef.current.disconnect();
    tuningSyncRef.current!.connectionChanged(false);
    connectionStatusRef.current = "idle";
    setStatus("idle");
    setTopics([]);
  }

  automaticConnectRef.current = () => {
    if (!autoConnectPausedRef.current && connectionStatusRef.current !== "connected") {
      attemptNetworkTablesConnection(false);
    }
  };

  useEffect(() => {
    tuningSyncRef.current!.reset();
    setDesiredTuningMode(null);
    automaticConnectRef.current();
    return () => {
      clientRef.current.disconnect();
      tuningSyncRef.current!.connectionChanged(false);
      connectionStatusRef.current = "idle";
    };
  }, [clientRef, connectionSettings.host, connectionSettings.port]);

  function setTuningModeEnabled(enabled: boolean) {
    tuningSyncRef.current!.request(enabled);
    setDesiredTuningMode(enabled);
  }

  updateSubsystemCodeRef.current = updateSubsystemCode;
  updateInstallSectionRef.current = updateInstallSection;
  updatePowerToolRef.current = updatePowerTool;

  useEffect(() => {
    const removeConnectionSettings = window.powerlib?.onMenuConnectionSettings?.(() => {
      setConnectionSettingsOpen(true);
    });
    const removeUpdateSubsystemCode = window.powerlib?.onMenuUpdateSubsystemCode?.(() => {
      void updateSubsystemCodeRef.current();
    });
    const removeUpdateInstallSection = window.powerlib?.onMenuUpdateInstallSection?.((_event, section) => {
      void updateInstallSectionRef.current(section);
    });
    const removeUpdatePowerTool = window.powerlib?.onMenuUpdatePowerTool?.(() => {
      void updatePowerToolRef.current();
    });

    return () => {
      removeConnectionSettings?.();
      removeUpdateSubsystemCode?.();
      removeUpdateInstallSection?.();
      removeUpdatePowerTool?.();
    };
  }, []);

  useEffect(() => {
    if (activeView === "limelights" && limelights.length === 0) {
      setActiveView("dashboard");
    }
  }, [activeView, limelights.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const values = latestTopicsRef.current;
      const requested = values.find(topic => topic.name === tuningModeRequestTopicName)?.value;
      const enabled = values.find(topic => topic.name === tuningModeTopicName)?.value;
      const sync = tuningSyncRef.current!;
      void sync.sync(performance.now(), requested, enabled);
      setDesiredTuningMode(sync.desired);
    }, tuningUpdateIntervalMs);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", top: 0, zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Container maxWidth={false}>
          <Toolbar disableGutters sx={{ gap: 2, flexWrap: "wrap" }}>
            <ElectricBoltIcon color="primary" sx={{ fontSize: 34 }} />
            <Box sx={{ flexGrow: 1 }}>
              <Stack direction="row" spacing={1.25} sx={{ alignItems: "baseline" }}>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  Power Tool
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                  powered by Team 9410
                </Typography>
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexWrap: "wrap" }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={tuningModeEnabled}
                    disabled={status !== "connected"}
                    onChange={(event) => void setTuningModeEnabled(event.target.checked)}
                  />
                }
                label={tuningModePending ? "Tuning (syncing)" : "Tuning"}
              />
              {status === "connected" || !autoConnectPausedRef.current ? (
                <Button variant="outlined" size="small" onClick={disconnectNetworkTables}>
                  Disconnect
                </Button>
              ) : (
                <Button
                  disabled={status === "connecting"}
                  startIcon={<CableIcon />}
                  variant="contained"
                  size="small"
                  onClick={connectNetworkTables}
                >
                  {status === "connecting" ? "Connecting" : "Connect"}
                </Button>
              )}
              <Chip
                color={status === "connected" ? "success" : status === "connecting" ? "warning" : "error"}
                label={`${connectionSettings.host}:${connectionSettings.port}`}
                variant="outlined"
              />
            </Stack>
          </Toolbar>
          <Tabs value={activeView} onChange={(_, value) => setActiveView(value)} sx={{ minHeight: 44 }}>
            <Tab icon={<DashboardIcon />} iconPosition="start" label="Dashboard" value="dashboard" sx={{ minHeight: 44 }} />
            {limelights.length > 0 && (
              <Tab
                icon={<VideocamIcon />}
                iconPosition="start"
                label="Limelights"
                value="limelights"
                sx={{ minHeight: 44 }}
              />
            )}
            <Tab
              icon={<DashboardIcon />}
              iconPosition="start"
              label="NetworkTables"
              value="networktables"
              sx={{ minHeight: 44 }}
            />
          </Tabs>
        </Container>
      </AppBar>

      <UpdateCodeDialog
        open={subsystemUpdatingCode || Boolean(installSectionUpdating)}
        title={installSectionUpdating ? "Updating PowerLib" : "Updating Code"}
        message={
          installSectionUpdating
            ? `Please wait, updating ${installSectionUpdating}.`
            : "Please wait, code is updating."
        }
      />

      <ConnectionSettingsDialog
        open={connectionSettingsOpen}
        settings={connectionSettings}
        onClose={() => setConnectionSettingsOpen(false)}
        onSave={(settings) => {
          setConnectionSettings(settings);
          showToast("Saved NetworkTables connection settings.", "success");
        }}
      />

      {configOpen && <ConfigDialog document={subsystemDocument} onRefresh={() => void loadSubsystems()}
        onClose={() => setConfigOpen(false)} onSave={async subsystems => {
          await saveSubsystems(subsystems);
          showToast("Subsystem configuration saved. Use File > Update Code when you are ready to regenerate Java files.", "success");
        }} />}

      <Snackbar
        open={toast.open}
        autoHideDuration={6000}
        onClose={() => setToast((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((current) => ({ ...current, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>

      <Container maxWidth={false} sx={activeView === "dashboard" ? { p: "0 !important" } : { py: 2 }}>
        {telemetryError && <Alert severity="warning" sx={{ m: 1 }}>{telemetryError}</Alert>}
        <Stack spacing={2}>
          {activeView === "dashboard" && <DashboardPanel subsystems={subsystemDocument.subsystems}
            tuningRequested={tuningModeEnabled}
            onOpenConfig={() => { setConfigOpen(true); void loadSubsystems(); }} />}
          {activeView === "networktables" && (
            <NetworkTablesPanel />
          )}

          {activeView === "limelights" && (
            <LimelightsPanel limelights={limelights} />
          )}
        </Stack>
      </Container>
    </Box>
  );
}
