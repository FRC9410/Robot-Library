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
import ConstructionIcon from "@mui/icons-material/Construction";
import DashboardIcon from "@mui/icons-material/Dashboard";
import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import GamepadIcon from "@mui/icons-material/Gamepad";
import SmartToyIcon from "@mui/icons-material/SmartToy";
import TuneIcon from "@mui/icons-material/Tune";
import type {
  CharacterizationCommand,
  GeneratedSubsystem,
  SubsystemDocumentState,
  SubsystemFormMotor,
  SubsystemFormState
} from "./features/subsystems/types";
import {
  createEmptyMotor,
  createEmptySubsystemForm,
  formToSubsystem,
  getCharacterizationName,
  subsystemToForm,
  summarizeUpdateOutput
} from "./features/subsystems/subsystemUtils";
import { CharacterizationDialog } from "./features/subsystems/components/CharacterizationDialog";
import { DeleteSubsystemDialog } from "./features/subsystems/components/DeleteSubsystemDialog";
import { SubsystemsPanel } from "./features/subsystems/components/SubsystemsPanel";
import { UpdateCodeDialog } from "./features/subsystems/components/UpdateCodeDialog";
import { NetworkTablesPanel } from "./features/networktables/NetworkTablesPanel";
import { NetworkTablesProvider, useNetworkTables } from "./features/networktables/NetworkTablesContext";
import { ConnectionSettingsDialog } from "./features/networktables/ConnectionSettingsDialog";
import { tuningModeRequestTopicName, tuningModeTopicName } from "./features/networktables/tuningUtils";
import { RobotPanel } from "./features/robot/RobotPanel";
import { BindingsPanel } from "./features/bindings/BindingsPanel";
import { TuningPanel } from "./features/tuning/TuningPanel";
import type { AppView } from "./types/app";

type ToastState = {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
};

const networkTableWatchPrefixes = [
  "/PowerLib/",
  "/SmartDashboard/",
  "/Shuffleboard/",
  "/FMSInfo/",
  "/LiveWindow/"
];

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
    topics,
    setTopics,
    upsertTopic
  } = useNetworkTables();
  const [activeView, setActiveView] = useState<AppView>("robot");
  const [subsystemDocument, setSubsystemDocument] = useState<SubsystemDocumentState>({
    loading: false,
    exists: false,
    path: "",
    subsystems: [],
    error: null
  });
  const [subsystemForm, setSubsystemForm] = useState<SubsystemFormState | null>(null);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info"
  });
  const [subsystemSaving, setSubsystemSaving] = useState(false);
  const [subsystemUpdatingCode, setSubsystemUpdatingCode] = useState(false);
  const [installSectionUpdating, setInstallSectionUpdating] = useState<string | null>(null);
  const [powerToolUpdating, setPowerToolUpdating] = useState(false);
  const [deleteSubsystemIndex, setDeleteSubsystemIndex] = useState<number | null>(null);
  const [characterizationOpen, setCharacterizationOpen] = useState(false);
  const [connectionSettingsOpen, setConnectionSettingsOpen] = useState(false);
  const [optimisticTuningMode, setOptimisticTuningMode] = useState<boolean | null>(null);
  const updateSubsystemCodeRef = useRef<() => Promise<void>>(async () => {});
  const updateInstallSectionRef = useRef<(section: string) => Promise<void>>(async () => {});
  const updatePowerToolRef = useRef<() => Promise<void>>(async () => {});
  const tuningModeTopic = topics.find((topic) => topic.name === tuningModeTopicName);
  const tuningModeRequestTopic = topics.find((topic) => topic.name === tuningModeRequestTopicName);
  const networkTuningMode =
    tuningModeRequestTopic?.value === true || (!tuningModeRequestTopic && tuningModeTopic?.value === true);
  const tuningModeEnabled = optimisticTuningMode ?? networkTuningMode;

  const characterizationCommands = useMemo<CharacterizationCommand[]>(() => {
    if (!subsystemForm?.name) {
      return [];
    }

    const characterizationName = getCharacterizationName(subsystemForm.name);
    const prefix = `/PowerLib/Characterization/${characterizationName}/`;
    return topics
      .filter((topic) => topic.name.startsWith(prefix) && topic.name.endsWith("/.type") && topic.value === "PowerLibCommand")
      .map((topic) => {
        const baseTopic = topic.name.slice(0, -"/.type".length);
        const label = baseTopic.slice(prefix.length);
        const runningTopic = topics.find((candidate) => candidate.name === `${baseTopic}/running`);

        return {
          label,
          baseTopic,
          running: runningTopic?.value === true
        };
      })
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [subsystemForm?.name, topics]);

  function showToast(message: string, severity: ToastState["severity"] = "info") {
    setToast({
      open: true,
      message,
      severity
    });
  }

  function updateSubsystemFormField<K extends keyof SubsystemFormState>(field: K, value: SubsystemFormState[K]) {
    setSubsystemForm((current) => (current ? { ...current, [field]: value } : current));
  }

  function updateSubsystemMotor(index: number, patch: Partial<SubsystemFormMotor>) {
    setSubsystemForm((current) => {
      if (!current) {
        return current;
      }

      const motors = current.motors.map((motor, motorIndex) => {
        if (motorIndex !== index) {
          return motor;
        }

        return {
          ...motor,
          ...patch,
          role: motorIndex === 0 ? "leader" : patch.role ?? motor.role
        };
      });

      return { ...current, motors };
    });
  }

  function addSubsystemMotor() {
    setSubsystemForm((current) =>
      current ? { ...current, motors: [...current.motors, createEmptyMotor("follower")] } : current
    );
  }

  function deleteSubsystemMotor(index: number) {
    if (index === 0) {
      return;
    }

    setSubsystemForm((current) =>
      current ? { ...current, motors: current.motors.filter((_, motorIndex) => motorIndex !== index) } : current
    );
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

  async function saveSubsystemForm() {
    if (!subsystemForm) {
      return;
    }

    const existing =
      subsystemForm.mode === "edit" && subsystemForm.index !== null
        ? subsystemDocument.subsystems[subsystemForm.index]
        : undefined;
    const subsystem = formToSubsystem(subsystemForm, existing);
    if (!subsystem.name || !subsystem.id) {
      showToast("Subsystem name is required.", "error");
      return;
    }

    if (subsystem.motors?.some((motor) => !motor.id)) {
      showToast("Every motor needs a CAN ID.", "error");
      return;
    }

    setSubsystemSaving(true);
    try {
      const nextSubsystems = [...subsystemDocument.subsystems];
      if (subsystemForm.mode === "edit" && subsystemForm.index !== null) {
        nextSubsystems[subsystemForm.index] = subsystem;
      } else {
        nextSubsystems.push(subsystem);
      }

      await saveSubsystems(nextSubsystems);
      showToast(`Saved ${subsystem.name}. Use File > Update Code when you are ready to regenerate Java files.`, "success");
      setSubsystemForm(null);
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not save subsystem JSON.", "error");
    } finally {
      setSubsystemSaving(false);
    }
  }

  async function deleteSubsystem(index: number) {
    const subsystem = subsystemDocument.subsystems[index];
    setSubsystemSaving(true);
    try {
      await saveSubsystems(subsystemDocument.subsystems.filter((_, currentIndex) => currentIndex !== index));
      showToast(`Removed ${subsystem?.name ?? "subsystem"}. Use File > Update Code to reconcile generated Java files.`, "success");
      setDeleteSubsystemIndex(null);
      if (subsystemForm?.index === index) {
        setSubsystemForm(null);
      }
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not delete subsystem.", "error");
    } finally {
      setSubsystemSaving(false);
    }
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
    templates: "robot templates",
    vendordeps: "vendor dependencies"
  };

  const installSectionSuccessMessages: Record<string, string> = {
    lib: "Updated PowerLib library files.",
    templates: "Updated robot templates. Existing files were preserved when templates already existed.",
    vendordeps: "Updated vendor dependencies."
  };

  const installSectionFailureMessages: Record<string, string> = {
    lib: "Could not update PowerLib library files.",
    templates: "Could not update robot templates.",
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
      if (section === "templates" || section === "lib") {
        await loadSubsystems();
      }
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : installSectionFailureMessages[section] ?? `Could not update ${label}.`, "error");
    } finally {
      setInstallSectionUpdating(null);
    }
  }

  function connectNetworkTables() {
    setStatus("connecting");
    setTopics([]);

    try {
      clientRef.current.connect(connectionSettings.host, connectionSettings.port, (connected) => {
        setStatus(connected ? "connected" : "disconnected");
      });
      networkTableWatchPrefixes.forEach((prefix) => {
        clientRef.current.watchPrefix(prefix, upsertTopic);
      });
    } catch (caught) {
      setStatus("disconnected");
      showToast(caught instanceof Error ? caught.message : "Could not connect to NetworkTables.", "error");
    }
  }

  function disconnectNetworkTables() {
    clientRef.current.disconnect();
    setStatus("idle");
    setTopics([]);
  }

  async function setTuningModeEnabled(enabled: boolean) {
    const previousTuningMode = networkTuningMode;
    setOptimisticTuningMode(enabled);
    upsertTopic({
      name: tuningModeRequestTopicName,
      type: "boolean",
      value: enabled,
      lastChangedTime: Date.now()
    });

    try {
      await clientRef.current.publish(tuningModeRequestTopicName, "boolean", enabled);
    } catch (caught) {
      setOptimisticTuningMode(null);
      upsertTopic({
        name: tuningModeRequestTopicName,
        type: "boolean",
        value: previousTuningMode,
        lastChangedTime: Date.now()
      });
      showToast(caught instanceof Error ? caught.message : "Could not update tuning mode.", "error");
    }
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
    if (
      (activeView === "robot" || activeView === "subsystems" || activeView === "bindings") &&
      !subsystemDocument.loading &&
      !subsystemDocument.path
    ) {
      void loadSubsystems();
    }
  }, [activeView, subsystemDocument.loading, subsystemDocument.path]);

  useEffect(() => {
    if (optimisticTuningMode === null) {
      return;
    }

    if (tuningModeRequestTopic?.value === optimisticTuningMode || tuningModeTopic?.value === optimisticTuningMode) {
      setOptimisticTuningMode(null);
    }
  }, [optimisticTuningMode, tuningModeRequestTopic?.value, tuningModeTopic?.value]);

  function watchCharacterizationPrefix() {
    if (!subsystemForm?.name) {
      return;
    }

    const prefix = `/PowerLib/Characterization/${getCharacterizationName(subsystemForm.name)}/`;
    if (status === "connected" || status === "connecting") {
      clientRef.current.watchPrefix(prefix, upsertTopic);
    }
  }

  async function runCharacterizationCommand(command: CharacterizationCommand) {
    try {
      await clientRef.current.publish(`${command.baseTopic}/request`, "boolean", true);
      upsertTopic({ name: `${command.baseTopic}/request`, type: "boolean", value: true });
      showToast(`Started ${command.label}.`, "success");
    } catch (caught) {
      showToast(caught instanceof Error ? caught.message : "Could not start characterization command.", "error");
    }
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="sticky"
        color="inherit"
        elevation={0}
        sx={{ borderBottom: 1, borderColor: "divider", top: 0, zIndex: (theme) => theme.zIndex.drawer + 1 }}
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
                label="Tuning"
              />
              {status === "connected" ? (
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
            <Tab
              icon={<SmartToyIcon />}
              iconPosition="start"
              label="Robot"
              value="robot"
              sx={{ minHeight: 44 }}
            />
            <Tab
              icon={<TuneIcon />}
              iconPosition="start"
              label="Tuning"
              value="tuning"
              sx={{ minHeight: 44 }}
            />
            <Tab
              icon={<ConstructionIcon />}
              iconPosition="start"
              label="Subsystems"
              value="subsystems"
              sx={{ minHeight: 44 }}
            />
            <Tab
              icon={<GamepadIcon />}
              iconPosition="start"
              label="Bindings"
              value="bindings"
              sx={{ minHeight: 44 }}
            />
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

      <DeleteSubsystemDialog
        open={deleteSubsystemIndex !== null}
        name={deleteSubsystemIndex !== null ? subsystemDocument.subsystems[deleteSubsystemIndex]?.name : undefined}
        saving={subsystemSaving}
        onCancel={() => setDeleteSubsystemIndex(null)}
        onConfirm={() => {
          if (deleteSubsystemIndex !== null) {
            void deleteSubsystem(deleteSubsystemIndex);
          }
        }}
      />

      <CharacterizationDialog
        open={characterizationOpen}
        subsystemName={subsystemForm?.name}
        status={status}
        commands={characterizationCommands}
        onRunCommand={runCharacterizationCommand}
        onClose={() => setCharacterizationOpen(false)}
      />

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

      <Container maxWidth={false} sx={{ py: 2 }}>
        <Stack spacing={2}>
          {activeView === "robot" && (
            <RobotPanel
              subsystems={subsystemDocument.subsystems}
              topics={topics}
            />
          )}

          {activeView === "networktables" && (
            <NetworkTablesPanel />
          )}

          {activeView === "tuning" && (
            <TuningPanel />
          )}

          {activeView === "subsystems" && (
            <SubsystemsPanel
                document={subsystemDocument}
                form={subsystemForm}
              saving={subsystemSaving}
              setForm={setSubsystemForm}
              updateField={updateSubsystemFormField}
              updateMotor={updateSubsystemMotor}
              addMotor={addSubsystemMotor}
              deleteMotor={deleteSubsystemMotor}
                onCreate={() => setSubsystemForm(createEmptySubsystemForm())}
                onRefresh={() => void loadSubsystems()}
                onSelect={(subsystem, index) => setSubsystemForm(subsystemToForm(subsystem, index))}
                onSave={saveSubsystemForm}
                onCancel={() => setSubsystemForm(null)}
                onDelete={() => setDeleteSubsystemIndex(subsystemForm?.index ?? 0)}
                onOpenCharacterization={() => {
                  setCharacterizationOpen(true);
                  watchCharacterizationPrefix();
                }}
              />
          )}

          {activeView === "bindings" && (
            <BindingsPanel subsystems={subsystemDocument.subsystems} onToast={showToast} />
          )}
        </Stack>
      </Container>
    </Box>
  );
}
