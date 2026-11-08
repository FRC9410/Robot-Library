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
  Toolbar
} from "@mui/material";
import CableIcon from "@mui/icons-material/Cable";
import DashboardIcon from "@mui/icons-material/Dashboard";
import TimelineIcon from "@mui/icons-material/Timeline";
import RouteIcon from "@mui/icons-material/Route";
import { WindowTitleBar } from "./components/WindowTitleBar";
import VideocamIcon from "@mui/icons-material/Videocam";
import { ConfigDialog } from "./features/config/ConfigDialog";
import { LegacyMigrationGate } from "./features/config/LegacyMigrationGate";
import { useSourceInventoryRefresh } from "./features/config/useSourceInventoryRefresh";
import type {
  GeneratedSubsystem,
  SubsystemDocumentState
} from "./features/subsystems/types";
import { summarizeUpdateOutput } from "./features/subsystems/subsystemUtils";
import { UpdateCodeDialog } from "./features/subsystems/components/UpdateCodeDialog";
import { NetworkTablesDrawer } from "./features/networktables/NetworkTablesDrawer";
import { NetworkTablesProvider, useNetworkTables, useTopics } from "./features/networktables/NetworkTablesContext";
import { ConnectionSettingsDialog } from "./features/networktables/ConnectionSettingsDialog";
import { tuningModeRequestTopicName, tuningModeTopicName } from "./features/networktables/tuningUtils";
import { DashboardPanel } from "../dashboard";
import { LimelightsPanel } from "./features/limelights/LimelightsPanel";
import { LogsPanel } from "./features/logs/LogsPanel";
import { AutosPanel } from "./features/autos/AutosPanel";
import { useAutoEditor } from "./features/autos/useAutoEditor";
import { useDashboardSettings } from "./features/dashboard/useDashboardSettings";
import { useFieldLayout } from "./features/field/useFieldLayout";
import { getFieldLayoutId, loadUploadedField, setFieldLayoutId } from "./features/field/fieldLayouts";
import { detectLimelights } from "./features/limelights/limelightUtils";
import type { AppView } from "./types/app";
import { TuningModeSync } from "./networktables/TuningModeSync";
import { tuningUpdateIntervalMs } from "./networktables/telemetryTiming";
import type { RobotAction } from "../electron/robotActions";

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
  const dashboardSettings = useDashboardSettings();
  const fieldLayout = useFieldLayout();
  const autoEditor = useAutoEditor(fieldLayout ?? dashboardSettings);
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
  const [robotAction, setRobotAction] = useState<RobotAction | null>(null);
  const robotActionBusy = useRef(false);
  const [connectionSettingsOpen, setConnectionSettingsOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [networkTablesOpen, setNetworkTablesOpen] = useState(false);
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
  const robotActionRef = useRef<(action: RobotAction) => Promise<void>>(async () => {});
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
        revision: result.revision,
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

    const result = await window.powerlib.saveSubsystems(subsystems, undefined, subsystemDocument.revision);
    setSubsystemDocument({
      loading: false,
      exists: result.exists,
      path: result.path,
      subsystems: result.subsystems as GeneratedSubsystem[],
      revision: result.revision,
      error: null
    });
  }

  useSourceInventoryRefresh(loadSubsystems);

  async function runRobotAction(action: RobotAction) {
    if (robotActionBusy.current) return;
    robotActionBusy.current = true; setRobotAction(action);
    try {
      if (!window.powerlib?.runRobotAction) throw Error("Robot build bridge is not available.");
      const result = await window.powerlib.runRobotAction(action);
      const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
      showToast(result.started ? "Simulation launched." : action === "deploy" ? "Robot built and deployed."
        : output ? summarizeUpdateOutput(output) : "Robot build completed.", "success");
      await loadSubsystems();
    } catch (caught) { showToast(caught instanceof Error ? caught.message : "Robot action failed.", "error"); }
    finally { robotActionBusy.current = false; setRobotAction(null); }
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
    if (status !== "connected" || !networkTablesOpen) return;
    const stop = clientRef.current.watchPrefix("/", upsertTopic);
    return () => {
      stop();
      pruneTopics(snapshot => clientRef.current.isWatchedValue(snapshot.name));
    };
  }, [status, networkTablesOpen, clientRef, upsertTopic, pruneTopics]);

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

  robotActionRef.current = runRobotAction;

  useEffect(() => {
    const removeConnectionSettings = window.powerlib?.onMenuConnectionSettings?.(() => {
      setConnectionSettingsOpen(true);
    });
    const removeSettings = window.powerlib?.onMenuSettings?.(() => { setConfigOpen(true); void loadSubsystems(); });
    const removeRobotAction = window.powerlib?.onMenuRobotAction?.(action => { void robotActionRef.current(action); });
    const removeActionError = window.powerlib?.onRobotActionError?.(message => showToast(message, "error"));
    const removeToggleNetworkTables = window.powerlib?.onMenuToggleNetworkTables?.(() => {
      setNetworkTablesOpen(current => !current);
    });
    const removeFieldLayout = window.powerlib?.onMenuFieldLayout?.((_event, id) => setFieldLayoutId(id));
    window.powerlib?.setFieldLayoutMenu?.(getFieldLayoutId());
    void loadUploadedField().catch(caught => showToast(caught instanceof Error ? caught.message : "Could not load the uploaded field.", "error"));

    return () => {
      removeConnectionSettings?.();
      removeSettings?.(); removeRobotAction?.(); removeActionError?.();
      removeToggleNetworkTables?.();
      removeFieldLayout?.();
    };
  }, []);

  useEffect(() => {
    void loadSubsystems();
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

  const fillsWindow = activeView === "logs" || activeView === "limelights" || activeView === "autos";

  return (
    <Box sx={{ minHeight: fillsWindow ? 0 : "100vh", height: fillsWindow ? "100dvh" : undefined,
      overflow: fillsWindow ? "hidden" : undefined, display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      <WindowTitleBar />
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ flexShrink: 0, borderBottom: 1, borderColor: "divider", top: 40, zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Container maxWidth={false}>
          <Toolbar disableGutters sx={{ gap: 2, minHeight: { xs: 52, sm: 52 } }}>
            <Tabs value={activeView} onChange={(_, value) => setActiveView(value)} variant="scrollable" scrollButtons="auto"
              sx={{ minHeight: 52, flex: 1, minWidth: 0 }}>
              <Tab icon={<DashboardIcon />} iconPosition="start" label="Dashboard" value="dashboard" sx={{ minHeight: 52 }} />
              {limelights.length > 0 && (
                <Tab icon={<VideocamIcon />} iconPosition="start" label="Limelights" value="limelights" sx={{ minHeight: 52 }} />
              )}
              <Tab icon={<TimelineIcon />} iconPosition="start" label="Logs" value="logs" sx={{ minHeight: 52 }} />
              <Tab icon={<RouteIcon />} iconPosition="start" label="Autos" value="autos" sx={{ minHeight: 52 }} />
            </Tabs>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", flexShrink: 0, whiteSpace: "nowrap" }}>
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
        </Container>
      </AppBar>

      <UpdateCodeDialog open={robotAction !== null}
        title={robotAction === "deploy" ? "Building and Deploying Robot" : robotAction === "build" ? "Building Robot" : "Building and Launching Simulation"}
        message={robotAction === "build" ? "Please wait, robot code is building." : robotAction === "deploy" ? "Building and deploying robot code…" : "Building robot code and preparing simulation…"} />

      <ConnectionSettingsDialog
        open={connectionSettingsOpen}
        settings={connectionSettings}
        onClose={() => setConnectionSettingsOpen(false)}
        onSave={(settings) => {
          setConnectionSettings(settings);
          showToast("Saved NetworkTables connection settings.", "success");
        }}
      />

      {configOpen && <ConfigDialog autoEditor={autoEditor} document={subsystemDocument} onRefresh={() => void loadSubsystems()}
        onClose={() => setConfigOpen(false)} onSave={async subsystems => {
          await saveSubsystems(subsystems);
          showToast("Subsystem saved to Java. Build and deploy to apply it to the robot.", "success");
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

      <Container maxWidth={false} disableGutters={activeView === "limelights"} sx={activeView === "dashboard" ? { p: "0 !important" }
        : activeView === "autos" ? { p: 1.5, px: { xs: 1.5, sm: 1.5 }, flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
        : fillsWindow
          ? { pt: activeView === "logs" ? 1.5 : 0.5, pb: activeView === "logs" ? 0 : 0.5,
              flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }
          : { py: 2 }}>
        {telemetryError && <Alert severity="warning" sx={{ m: 1 }}>{telemetryError}</Alert>}
        <Stack spacing={2} useFlexGap={activeView === "limelights"} sx={fillsWindow ? { flex: 1, minHeight: 0 } : undefined}>
          {activeView === "dashboard" && <DashboardPanel subsystems={subsystemDocument.subsystems}
            tuningRequested={tuningModeEnabled} /> }
          <Box sx={{ display: activeView === "autos" ? "flex" : "none", flex: 1, minHeight: 0 }}><AutosPanel editor={autoEditor} /></Box>

          {/* Stays mounted so an open log survives switching tabs. */}
          <Box sx={{ display: activeView === "logs" ? "flex" : "none", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <LogsPanel active={activeView === "logs"} subsystems={subsystemDocument.subsystems} />
          </Box>

          {activeView === "limelights" && (
            <LimelightsPanel limelights={limelights} />
          )}
        </Stack>
      </Container>
      <LegacyMigrationGate onComplete={() => void loadSubsystems()} />
      <NetworkTablesDrawer open={networkTablesOpen} onClose={() => setNetworkTablesOpen(false)} />
    </Box>
  );
}
