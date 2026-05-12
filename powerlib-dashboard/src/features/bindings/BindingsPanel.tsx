import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import SaveIcon from "@mui/icons-material/Save";
import type { GeneratedSubsystem } from "../subsystems/types";
import type {
  BindingCommand,
  BindingCommandKind,
  BindingConstantOption,
  BindingDocumentState,
  BindingFormState,
  GeneratedBinding
} from "./types";
import {
  bindingToForm,
  controllerOptions,
  createEmptyBindingCommand,
  createEmptyBindingGroup,
  createEmptyBindingForm,
  createEmptyWaitCommand,
  eventOptions,
  formToBinding,
  getMethodsForSubsystem,
  inputOptions,
  methodNeedsValue
} from "./bindingUtils";

type BindingsPanelProps = {
  subsystems: GeneratedSubsystem[];
  onToast: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
};

export function BindingsPanel({ subsystems, onToast }: BindingsPanelProps) {
  const [document, setDocument] = useState<BindingDocumentState>({
    loading: false,
    exists: false,
    path: "",
    bindings: [],
    error: null
  });
  const [form, setForm] = useState<BindingFormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [constantOptions, setConstantOptions] = useState<BindingConstantOption[]>([]);
  const [deleteBindingOpen, setDeleteBindingOpen] = useState(false);
  const [selectedCommandPath, setSelectedCommandPath] = useState<number[] | null>(null);

  async function loadBindings() {
    setDocument((current) => ({ ...current, loading: true, error: null }));
    try {
      if (!window.powerlib?.readBindings) {
        throw new Error("PowerLib binding bridge is not available.");
      }
      const result = await window.powerlib.readBindings();
      setDocument({
        loading: false,
        exists: result.exists,
        path: result.path,
        bindings: result.bindings as GeneratedBinding[],
        error: result.error ?? null
      });
    } catch (caught) {
      setDocument((current) => ({
        ...current,
        loading: false,
        error: caught instanceof Error ? caught.message : "Could not load powerlib-bindings.json."
      }));
    }
  }

  async function loadConstants() {
    try {
      if (!window.powerlib?.readBindingConstants) {
        return;
      }
      const result = await window.powerlib.readBindingConstants();
      setConstantOptions(result.constants as BindingConstantOption[]);
    } catch {
      setConstantOptions([]);
    }
  }

  async function saveBindings(bindings: GeneratedBinding[]) {
    if (!window.powerlib?.saveBindings) {
      throw new Error("PowerLib binding bridge is not available.");
    }
    const result = await window.powerlib.saveBindings(bindings);
    setDocument({
      loading: false,
      exists: result.exists,
      path: result.path,
      bindings: result.bindings as GeneratedBinding[],
      error: null
    });
  }

  async function saveForm() {
    if (!form) {
      return;
    }
    const binding = formToBinding(form);
    if (!binding.name || !binding.id) {
      onToast("Binding name is required.", "error");
      return;
    }
    if (hasInvalidCommands(binding.commands ?? [])) {
      onToast("Every binding command needs a subsystem and method.", "error");
      return;
    }
    if (hasInvalidCommandValues(binding.commands ?? [])) {
      onToast("Commands with values need a constant name and value.", "error");
      return;
    }

    setSaving(true);
    try {
      const next = [...document.bindings];
      if (form.mode === "edit" && form.index !== null) {
        next[form.index] = binding;
      } else {
        next.push(binding);
      }
      await saveBindings(next);
      setForm(null);
      setSelectedCommandPath(null);
      onToast(`Saved ${binding.name}. Use File > Update Code to regenerate Java files.`, "success");
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : "Could not save binding JSON.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function deleteBinding() {
    if (!form || form.index === null) {
      return;
    }
    setSaving(true);
    try {
      await saveBindings(document.bindings.filter((_, index) => index !== form.index));
      onToast(`Removed ${form.name || "binding"}. Use File > Update Code to reconcile generated Java files.`, "success");
      setDeleteBindingOpen(false);
      setForm(null);
      setSelectedCommandPath(null);
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : "Could not delete binding.", "error");
    } finally {
      setSaving(false);
    }
  }

  function hasInvalidCommands(commands: BindingCommand[]): boolean {
    return commands.some((command) => {
      if (command.kind === "sequence" || command.kind === "parallelRace") {
        return !command.children?.length || hasInvalidCommands(command.children);
      }
      if (command.kind === "wait") {
        return !command.subsystemId;
      }
      return !command.subsystemId || !command.method;
    });
  }

  function hasInvalidCommandValues(commands: BindingCommand[]): boolean {
    return commands.some((command) => {
      if (command.kind === "sequence" || command.kind === "parallelRace") {
        return hasInvalidCommandValues(command.children ?? []);
      }
      if (command.kind === "wait") {
        return !command.constantName || command.value === undefined;
      }
      return methodNeedsValue(subsystems, command) && (!command.constantName || command.value === undefined);
    });
  }

  function updateCommands(updater: (commands: BindingCommand[]) => BindingCommand[]) {
    setForm((current) => {
      if (!current) {
        return current;
      }
      return { ...current, commands: updater(current.commands) };
    });
  }

  function updateCommandAtPath(path: number[], patch: Partial<BindingCommand>) {
    updateCommands((commands) => updateNodeAtPath(commands, path, (command) => ({ ...command, ...patch })));
  }

  function updateNodeAtPath(commands: BindingCommand[], path: number[], updater: (command: BindingCommand) => BindingCommand): BindingCommand[] {
    const [index, ...rest] = path;
    return commands.map((command, commandIndex) => {
      if (commandIndex !== index) {
        return command;
      }
      if (rest.length === 0) {
        return updater(command);
      }
      return {
        ...command,
        children: updateNodeAtPath(command.children ?? [], rest, updater)
      };
    });
  }

  function insertCommandAtPath(path: number[], command: BindingCommand) {
    if (path.length === 0) {
      updateCommands((commands) => {
        setSelectedCommandPath([commands.length]);
        return [...commands, command];
      });
      return;
    }
    updateCommandAtPath(path, {});
    updateCommands((commands) =>
      updateNodeAtPath(commands, path, (node) => {
        const childIndex = node.children?.length ?? 0;
        setSelectedCommandPath([...path, childIndex]);
        return { ...node, children: [...(node.children ?? []), command] };
      })
    );
  }

  function deleteCommandAtPath(path: number[]) {
    if (path.length === 1) {
      updateCommands((commands) => {
        const next = commands.filter((_, index) => index !== path[0]);
        setSelectedCommandPath(next.length > 0 ? [Math.min(path[0], next.length - 1)] : null);
        return next;
      });
      return;
    }
    const parentPath = path.slice(0, -1);
    const childIndex = path[path.length - 1];
    updateCommands((commands) =>
      updateNodeAtPath(commands, parentPath, (node) => ({
        ...node,
        children: (node.children ?? []).filter((_, index) => index !== childIndex)
      }))
    );
    setSelectedCommandPath(parentPath);
  }

  function convertCommandKindAtPath(path: number[], kind: BindingCommandKind) {
    updateCommands((commands) =>
      updateNodeAtPath(commands, path, (command) => {
        const currentKind =
          command.kind === "sequence" || command.kind === "parallelRace" || command.kind === "wait"
            ? command.kind
            : "function";
        if (currentKind === kind) {
          return command;
        }
        if (kind === "function") {
          const firstFunction = findFirstFunction(command.children ?? []);
          return firstFunction ?? createEmptyBindingCommand(subsystems);
        }
        if (kind === "wait") {
          return createEmptyWaitCommand(subsystems);
        }
        return {
          kind,
          subsystemId: "",
          method: "",
          children: currentKind === "function" ? [command] : command.children?.length ? command.children : [createEmptyBindingCommand(subsystems)]
        };
      })
    );
  }

  function findFirstFunction(commands: BindingCommand[]): BindingCommand | null {
    for (const command of commands) {
      if (command.kind !== "sequence" && command.kind !== "parallelRace" && command.kind !== "wait") {
        return command;
      }
      const nested = findFirstFunction(command.children ?? []);
      if (nested) {
        return nested;
      }
    }
    return null;
  }

  function createCommandByKind(kind: BindingCommandKind) {
    if (kind === "sequence" || kind === "parallelRace") {
      return createEmptyBindingGroup(kind, subsystems);
    }
    if (kind === "wait") {
      return createEmptyWaitCommand(subsystems);
    }
    return createEmptyBindingCommand(subsystems);
  }

  function AddCommandMenuButton({ targetPath }: { targetPath: number[] | null }) {
    return (
      <FormControl size="small" sx={{ alignSelf: "flex-start", minWidth: 230 }}>
        <Select
          displayEmpty
          value=""
          renderValue={() => (
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", color: "primary.main", fontWeight: 800 }}>
              <AddIcon fontSize="small" />
              <span>Add Function/Command</span>
            </Stack>
          )}
          onChange={(event) => insertCommandAtPath(targetPath ?? [], createCommandByKind(event.target.value as BindingCommandKind))}
        >
          <MenuItem value="function">Function</MenuItem>
          <MenuItem value="sequence">Sequential</MenuItem>
          <MenuItem value="parallelRace">Parallel Race</MenuItem>
          <MenuItem value="wait">Wait</MenuItem>
        </Select>
      </FormControl>
    );
  }

  function getCommandLabel(command: BindingCommand) {
    if (command.kind === "sequence") {
      return "Sequential";
    }
    if (command.kind === "parallelRace") {
      return "Parallel Race";
    }
    if (command.kind === "wait") {
      return `Wait ${command.constantName || "seconds"}`;
    }
    const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
    const valueText = methodNeedsValue(subsystems, command) ? ` ${command.constantName || "value"}` : "";
    return `${subsystem?.name ?? "Subsystem"}.${command.method || "method"}${valueText}`;
  }

  function getFunctionCommandParts(command: BindingCommand) {
    const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
    return {
      target: subsystem?.name ?? "Subsystem",
      method: command.method || "method",
      value: methodNeedsValue(subsystems, command) ? command.constantName || "value" : ""
    };
  }

  function renderTreeNodeLabel(command: BindingCommand, isGroup: boolean) {
    if (isGroup) {
      return (
        <Typography variant="body2" sx={{ fontWeight: 800 }}>
          {getCommandLabel(command)}
        </Typography>
      );
    }

    if (command.kind === "wait") {
      return (
        <Stack direction="row" spacing={0.75} sx={{ alignItems: "center", minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 800, whiteSpace: "nowrap" }}>
            Wait
          </Typography>
          <Chip
            size="small"
            label={command.constantName || "seconds"}
            variant="outlined"
            sx={{
              height: 20,
              maxWidth: 150,
              "& .MuiChip-label": { px: 0.75, overflow: "hidden", textOverflow: "ellipsis" }
            }}
          />
        </Stack>
      );
    }

    const parts = getFunctionCommandParts(command);
    return (
      <Stack direction="row" spacing={0.5} sx={{ alignItems: "center", minWidth: 0 }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 800, maxWidth: 120 }}>
          {parts.target}
        </Typography>
        <Typography variant="body2" noWrap color="text.secondary" sx={{ fontWeight: 700, maxWidth: 150 }}>
          - {parts.method}
        </Typography>
        {parts.value && (
          <Chip
            size="small"
            label={parts.value}
            variant="outlined"
            sx={{
              height: 20,
              maxWidth: 150,
              "& .MuiChip-label": { px: 0.75, overflow: "hidden", textOverflow: "ellipsis" }
            }}
          />
        )}
      </Stack>
    );
  }

  function pathsEqual(left: number[] | null, right: number[]) {
    return Boolean(left && left.length === right.length && left.every((value, index) => value === right[index]));
  }

  function getCommandAtPath(commands: BindingCommand[], path: number[] | null): BindingCommand | null {
    if (!path || path.length === 0) {
      return null;
    }

    let current: BindingCommand | undefined;
    let children = commands;
    for (const index of path) {
      current = children[index];
      if (!current) {
        return null;
      }
      children = current.children ?? [];
    }
    return current ?? null;
  }

  function renderCommandTree(commands: BindingCommand[], depth = 0) {
    return commands.map((command, index) => {
      const path = [...argumentsPath(depth), index];
      const isGroup = command.kind === "sequence" || command.kind === "parallelRace";
      const isWait = command.kind === "wait";
      return (
        <Box key={`${depth}-${index}`} sx={{ pl: 2, position: "relative" }}>
          <Stack
            component="button"
            direction="row"
            spacing={1}
            onClick={() => setSelectedCommandPath(path)}
            sx={{
              alignItems: "center",
              bgcolor: pathsEqual(selectedCommandPath, path) ? "action.selected" : "transparent",
              border: 0,
              borderLeft: 1,
              borderRadius: 1,
              borderColor: "divider",
              color: "text.primary",
              cursor: "pointer",
              font: "inherit",
              pl: 1.5,
              py: 0.75,
              pr: 1,
              textAlign: "left",
              width: "100%"
            }}
          >
            <Chip
              size="small"
              label={isGroup ? (command.kind === "parallelRace" ? "race" : "seq") : isWait ? "wait" : "fn"}
              color={isGroup || isWait ? "primary" : "default"}
              variant={isGroup || isWait ? "filled" : "outlined"}
            />
            {renderTreeNodeLabel(command, isGroup)}
          </Stack>
          {isGroup && renderCommandTreeAtPath(command.children ?? [], path, depth + 1)}
        </Box>
      );
    });
  }

  function argumentsPath(_depth: number) {
    return [] as number[];
  }

  function renderCommandTreeAtPath(commands: BindingCommand[], parentPath: number[], depth = 0) {
    return commands.map((command, index) => {
      const path = [...parentPath, index];
      const isGroup = command.kind === "sequence" || command.kind === "parallelRace";
      const isWait = command.kind === "wait";
      return (
        <Box key={path.join(".")} sx={{ pl: 2, position: "relative" }}>
          <Stack
            component="button"
            direction="row"
            spacing={1}
            onClick={() => setSelectedCommandPath(path)}
            sx={{
              alignItems: "center",
              bgcolor: pathsEqual(selectedCommandPath, path) ? "action.selected" : "transparent",
              border: 0,
              borderLeft: 1,
              borderRadius: 1,
              borderColor: "divider",
              color: "text.primary",
              cursor: "pointer",
              font: "inherit",
              pl: 1.5,
              py: 0.75,
              pr: 1,
              textAlign: "left",
              width: "100%"
            }}
          >
            <Chip
              size="small"
              label={isGroup ? (command.kind === "parallelRace" ? "race" : "seq") : isWait ? "wait" : "fn"}
              color={isGroup || isWait ? "primary" : "default"}
              variant={isGroup || isWait ? "filled" : "outlined"}
            />
            {renderTreeNodeLabel(command, isGroup)}
          </Stack>
          {isGroup && renderCommandTreeAtPath(command.children ?? [], path, depth + 1)}
        </Box>
      );
    });
  }

  function CommandKindSelect({ command, path }: { command: BindingCommand; path: number[] }) {
    const kind =
      command.kind === "sequence" || command.kind === "parallelRace" || command.kind === "wait"
        ? command.kind
        : "function";
    return (
      <FormControl size="small" sx={{ minWidth: 170 }}>
        <InputLabel>Command type</InputLabel>
        <Select
          label="Command type"
          value={kind}
          onChange={(event) => convertCommandKindAtPath(path, event.target.value as BindingCommandKind)}
        >
          <MenuItem value="function">Function</MenuItem>
          <MenuItem value="wait">Wait</MenuItem>
          <MenuItem value="sequence">Sequential</MenuItem>
          <MenuItem value="parallelRace">Parallel Race</MenuItem>
        </Select>
      </FormControl>
    );
  }

  function renderCommandEditor(command: BindingCommand, path: number[], canDelete: boolean) {
    const isGroup = command.kind === "sequence" || command.kind === "parallelRace";
    if (isGroup) {
      return (
        <Card key={path.join(".")} variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center" }}>
                <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>
                  {command.kind === "parallelRace" ? "Parallel Race" : "Sequential"}
                </Typography>
                <CommandKindSelect command={command} path={path} />
                {canDelete && (
                  <Button color="error" startIcon={<DeleteIcon />} onClick={() => deleteCommandAtPath(path)}>
                    Delete
                  </Button>
                )}
              </Stack>
              <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
                <Button startIcon={<AddIcon />} variant="outlined" onClick={() => insertCommandAtPath(path, createEmptyBindingCommand(subsystems))}>
                  Add Function
                </Button>
                <Button variant="outlined" onClick={() => insertCommandAtPath(path, createEmptyBindingGroup("sequence", subsystems))}>
                  New Sequential
                </Button>
                <Button variant="outlined" onClick={() => insertCommandAtPath(path, createEmptyBindingGroup("parallelRace", subsystems))}>
                  New Parallel Race
                </Button>
                <Button variant="outlined" onClick={() => insertCommandAtPath(path, createEmptyWaitCommand(subsystems))}>
                  New Wait
                </Button>
              </Stack>
              <Stack spacing={2} sx={{ pl: { xs: 0, md: 2 }, borderLeft: { md: 1 }, borderColor: "divider" }}>
                {(command.children ?? []).map((child, index) =>
                  renderCommandEditor(child, [...path, index], (command.children ?? []).length > 1)
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      );
    }

    if (command.kind === "wait") {
      return (
        <Card key={path.join(".")} variant="outlined">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center" }}>
                <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>Wait</Typography>
                <CommandKindSelect command={command} path={path} />
                {canDelete && (
                  <Button color="error" startIcon={<DeleteIcon />} onClick={() => deleteCommandAtPath(path)}>
                    Delete
                  </Button>
                )}
              </Stack>
              {renderConstantFields(command, path, "Seconds", true)}
            </Stack>
          </CardContent>
        </Card>
      );
    }

    const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
    const methods = getMethodsForSubsystem(subsystem);
    const needsValue = methodNeedsValue(subsystems, command);
    return (
      <Card key={path.join(".")} variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" sx={{ alignItems: "center" }}>
              <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>Function</Typography>
              <CommandKindSelect command={command} path={path} />
              {canDelete && (
                <Button color="error" startIcon={<DeleteIcon />} onClick={() => deleteCommandAtPath(path)}>
                  Delete
                </Button>
              )}
            </Stack>
            <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
              <FormControl>
                <InputLabel>Subsystem</InputLabel>
                <Select
                  label="Subsystem"
                  value={command.subsystemId}
                  onChange={(event) => {
                    const subsystemId = event.target.value;
                    const nextSubsystem = subsystems.find((candidate) => candidate.id === subsystemId);
                    updateCommandAtPath(path, {
                      subsystemId,
                      method: getMethodsForSubsystem(nextSubsystem)[0]?.name ?? ""
                    });
                  }}
                >
                  {subsystems.map((candidate) => (
                    <MenuItem key={candidate.id ?? candidate.name} value={candidate.id ?? ""}>
                      {candidate.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <FormControl>
                <InputLabel>Method</InputLabel>
                <Select label="Method" value={command.method} onChange={(event) => updateCommandAtPath(path, { method: event.target.value })}>
                  {methods.map((method) => (
                    <MenuItem key={method.name} value={method.name}>
                      {method.name}{method.needsValue ? "(value)" : ""}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {needsValue && (
                renderConstantFields(command, path, "Value", false)
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  function renderCommandInspector(command: BindingCommand | null, path: number[] | null) {
    if (form && path === null) {
      return (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              Binding Root
            </Typography>
            <AddCommandMenuButton targetPath={null} />
          </Stack>
          <Divider />
          <Typography color="text.secondary">
            This binding has {form.commands.length} top-level command{form.commands.length === 1 ? "" : "s"}.
          </Typography>
        </Stack>
      );
    }

    if (!command || !path) {
      return (
        <Stack spacing={2} sx={{ alignItems: "center", justifyContent: "center", minHeight: 260, textAlign: "center" }}>
          <Typography variant="h6">Select a command node</Typography>
          <Typography color="text.secondary">Choose a function, wait, sequential, or parallel race node from the tree.</Typography>
        </Stack>
      );
    }

    const canDelete = Boolean(form && form.commands.length > 1) || path.length > 1;
    const isGroup = command.kind === "sequence" || command.kind === "parallelRace";
    if (isGroup) {
      return (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>
              {command.kind === "parallelRace" ? "Parallel Race" : "Sequential"}
            </Typography>
            <CommandKindSelect command={command} path={path} />
            {canDelete && (
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => deleteCommandAtPath(path)}>
                Delete
              </Button>
            )}
          </Stack>
          <Divider />
          <AddCommandMenuButton targetPath={path} />
          <Typography color="text.secondary">
            This group has {(command.children ?? []).length} child command{(command.children ?? []).length === 1 ? "" : "s"}.
          </Typography>
        </Stack>
      );
    }

    if (command.kind === "wait") {
      return (
        <Stack spacing={2}>
          <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
            <Typography variant="h6" sx={{ flexGrow: 1 }}>Wait</Typography>
            <CommandKindSelect command={command} path={path} />
            {canDelete && (
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => deleteCommandAtPath(path)}>
                Delete
              </Button>
            )}
          </Stack>
          <Divider />
          {renderConstantFields(command, path, "Seconds", true)}
        </Stack>
      );
    }

    const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
    const methods = getMethodsForSubsystem(subsystem);
    const needsValue = methodNeedsValue(subsystems, command);
    return (
      <Stack spacing={2}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>Function</Typography>
          <CommandKindSelect command={command} path={path} />
          {canDelete && (
            <Button color="error" startIcon={<DeleteIcon />} onClick={() => deleteCommandAtPath(path)}>
              Delete
            </Button>
          )}
        </Stack>
        <Divider />
        <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" } }}>
          <FormControl>
            <InputLabel>Subsystem</InputLabel>
            <Select
              label="Subsystem"
              value={command.subsystemId}
              onChange={(event) => {
                const subsystemId = event.target.value;
                const nextSubsystem = subsystems.find((candidate) => candidate.id === subsystemId);
                updateCommandAtPath(path, {
                  subsystemId,
                  method: getMethodsForSubsystem(nextSubsystem)[0]?.name ?? ""
                });
              }}
            >
              {subsystems.map((candidate) => (
                <MenuItem key={candidate.id ?? candidate.name} value={candidate.id ?? ""}>
                  {candidate.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl>
            <InputLabel>Method</InputLabel>
            <Select label="Method" value={command.method} onChange={(event) => updateCommandAtPath(path, { method: event.target.value })}>
              {methods.map((method) => (
                <MenuItem key={method.name} value={method.name}>
                  {method.name}{method.needsValue ? "(value)" : ""}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
        {needsValue && renderConstantFields(command, path, "Value", false)}
      </Stack>
    );
  }

  useEffect(() => {
    void loadBindings();
    void loadConstants();
  }, []);

  function renderConstantFields(command: BindingCommand, path: number[], valueLabel: string, showOwner: boolean) {
    const subsystemConstants = constantOptions.filter((constant) => constant.subsystemId === command.subsystemId);
    const constantSource = command.constantSource === "existing" ? "existing" : "new";
    return (
      <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" } }}>
        {showOwner && (
          <FormControl>
            <InputLabel>Constant owner</InputLabel>
            <Select
              label="Constant owner"
              value={command.subsystemId}
              onChange={(event) => updateCommandAtPath(path, { subsystemId: event.target.value })}
            >
              {subsystems.map((candidate) => (
                <MenuItem key={candidate.id ?? candidate.name} value={candidate.id ?? ""}>
                  {candidate.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
        <FormControl>
          <InputLabel>Constant source</InputLabel>
          <Select
            label="Constant source"
            value={constantSource}
            onChange={(event) => updateCommandAtPath(path, { constantSource: event.target.value as "new" | "existing" })}
          >
            <MenuItem value="new">New constant</MenuItem>
            <MenuItem value="existing">Existing constant</MenuItem>
          </Select>
        </FormControl>
        {constantSource === "existing" ? (
          <FormControl>
            <InputLabel>Existing constant</InputLabel>
            <Select
              label="Existing constant"
              value={subsystemConstants.some((constant) => constant.name === command.constantName) ? command.constantName : ""}
              onChange={(event) => {
                const selected = subsystemConstants.find((constant) => constant.name === event.target.value);
                if (selected) {
                  updateCommandAtPath(path, { constantName: selected.name, value: selected.value });
                }
              }}
            >
              <MenuItem value="">Select constant</MenuItem>
              {subsystemConstants.map((constant) => (
                <MenuItem key={constant.name} value={constant.name}>
                  {constant.name} = {constant.value}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : (
          <TextField
            label="Constant name"
            value={command.constantName ?? ""}
            onChange={(event) => updateCommandAtPath(path, { constantName: event.target.value.toUpperCase() })}
          />
        )}
        {constantSource === "new" && (
          <TextField
            label={valueLabel}
            type="number"
            value={command.value ?? ""}
            onChange={(event) => updateCommandAtPath(path, { value: event.target.value })}
          />
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 2,
        gridTemplateColumns: { xs: "1fr", md: "320px 1fr" },
        height: { xs: "auto", md: "calc(100vh - 150px)" },
        minHeight: { md: 520 },
        overflow: { xs: "visible", md: "hidden" }
      }}
    >
      <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden" }}>
        <CardContent sx={{ height: "100%", overflowY: "auto" }}>
          <Stack spacing={2}>
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              onClick={() => {
                setForm(createEmptyBindingForm(subsystems));
                setSelectedCommandPath(null);
              }}
            >
              Create Binding
            </Button>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => void loadBindings()}>
              Refresh
            </Button>
            <Divider />
            <Typography variant="subtitle2">Button Bindings</Typography>
            {document.loading && <CircularProgress size={22} />}
            {document.bindings.map((binding, index) => {
              const isSelected = form?.index === index;
              return (
                <Button
                  key={binding.id ?? `${binding.name}-${index}`}
                  variant={isSelected ? "contained" : "outlined"}
                  color={isSelected ? "primary" : "inherit"}
                  onClick={() => {
                    const nextForm = bindingToForm(binding, index, subsystems);
                    setForm(nextForm);
                    setSelectedCommandPath(null);
                  }}
                  sx={{
                    justifyContent: "flex-start",
                    minHeight: 64,
                    textAlign: "left",
                    textTransform: "none",
                    ...(isSelected && {
                      color: "primary.contrastText",
                      "& .MuiChip-root": {
                        bgcolor: "rgba(24, 24, 27, 0.18)",
                        color: "primary.contrastText",
                        fontWeight: 900
                      }
                    })
                  }}
                >
                  <Stack spacing={0.25} sx={{ alignItems: "flex-start", minWidth: 0 }}>
                    <Typography noWrap sx={{ fontWeight: 700, maxWidth: "100%" }}>
                      {binding.name || "Unnamed binding"}
                    </Typography>
                    <Stack direction="row" spacing={0.75} sx={{ flexWrap: "wrap", rowGap: 0.5 }}>
                      <Chip size="small" label={binding.controller ?? "driver"} variant={isSelected ? "filled" : "outlined"} sx={!isSelected ? { fontWeight: 800 } : undefined} />
                      <Chip size="small" label={binding.input ?? "a"} variant={isSelected ? "filled" : "outlined"} sx={!isSelected ? { fontWeight: 800 } : undefined} />
                      <Chip size="small" label={binding.event ?? "onTrue"} variant={isSelected ? "filled" : "outlined"} sx={!isSelected ? { fontWeight: 800 } : undefined} />
                    </Stack>
                  </Stack>
                </Button>
              );
            })}
            {!document.loading && document.bindings.length === 0 && (
              <Typography color="text.secondary">No button bindings yet.</Typography>
            )}
          </Stack>
        </CardContent>
      </Card>

      <Stack sx={{ minHeight: 0 }}>
        <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden", flexGrow: 1 }}>
          <CardContent sx={{ height: "100%", overflowY: "auto" }}>
            {form ? (
              <Stack spacing={2}>
                <Typography variant="h6">{form.mode === "create" ? "Create Binding" : `Edit ${form.name || "Binding"}`}</Typography>
                <Divider />
                <Box
                  sx={{
                    display: "grid",
                    gap: 2,
                    gridTemplateColumns: { xs: "1fr", md: "2fr repeat(3, minmax(150px, 1fr))" }
                  }}
                >
                  <TextField label="Binding name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
                  <FormControl>
                    <InputLabel>Controller</InputLabel>
                    <Select
                      label="Controller"
                      value={form.controller}
                      onChange={(event) => setForm({ ...form, controller: event.target.value as BindingFormState["controller"] })}
                    >
                      {controllerOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <InputLabel>Button</InputLabel>
                    <Select label="Button" value={form.input} onChange={(event) => setForm({ ...form, input: event.target.value })}>
                      {inputOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <FormControl>
                    <InputLabel>Event</InputLabel>
                    <Select
                      label="Event"
                      value={form.event}
                      onChange={(event) => setForm({ ...form, event: event.target.value as BindingFormState["event"] })}
                    >
                      {eventOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Divider />
                <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, flexGrow: 1 }}>Command Tree</Typography>
                </Stack>
                <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", lg: "360px 1fr" }, minHeight: 360 }}>
                  <Card variant="outlined" sx={{ minHeight: 0 }}>
                    <CardContent sx={{ height: "100%", overflowY: "auto" }}>
                      <Stack spacing={0.5}>
                        <Stack
                          component="button"
                          direction="row"
                          spacing={1}
                          onClick={() => setSelectedCommandPath(null)}
                          sx={{
                            alignItems: "center",
                            bgcolor: selectedCommandPath === null ? "action.selected" : "transparent",
                            border: 0,
                            borderRadius: 1,
                            color: "text.primary",
                            cursor: "pointer",
                            font: "inherit",
                            px: 1,
                            py: 0.75,
                            textAlign: "left",
                            width: "100%"
                          }}
                        >
                          <Chip size="small" label="root" color="primary" />
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            Binding Root
                          </Typography>
                        </Stack>
                        {renderCommandTree(form.commands)}
                      </Stack>
                    </CardContent>
                  </Card>
                  <Card variant="outlined" sx={{ minHeight: 0 }}>
                    <CardContent sx={{ height: "100%", overflowY: "auto" }}>
                      {renderCommandInspector(getCommandAtPath(form.commands, selectedCommandPath), selectedCommandPath)}
                    </CardContent>
                  </Card>
                </Box>
              </Stack>
            ) : (
              <Stack spacing={2} sx={{ alignItems: "center", justifyContent: "center", minHeight: 420, textAlign: "center" }}>
                <Typography variant="h6">Select a binding</Typography>
                <Typography color="text.secondary">Choose a binding from the sidebar or create a new one.</Typography>
              </Stack>
            )}
          </CardContent>
        </Card>
        {form && (
          <>
            <Stack direction="row" spacing={1} sx={{ alignItems: "center", borderTop: 1, borderColor: "divider", py: 1.5 }}>
              <Button startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />} variant="contained" onClick={saveForm} disabled={saving}>
                Save Binding
              </Button>
              <Button variant="outlined" onClick={() => setForm(null)}>Cancel</Button>
              <Box sx={{ flexGrow: 1 }} />
              {form.mode === "edit" && (
                <Button color="error" startIcon={<DeleteIcon />} onClick={() => setDeleteBindingOpen(true)} disabled={saving}>
                  Delete
                </Button>
              )}
            </Stack>
            <Dialog open={deleteBindingOpen} onClose={() => setDeleteBindingOpen(false)}>
              <DialogTitle>Delete Button Binding?</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  This removes {form.name || "this binding"} from powerlib-bindings.json. Update Code will remove it from the generated Java.
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeleteBindingOpen(false)}>Cancel</Button>
                <Button color="error" startIcon={saving ? <CircularProgress size={18} /> : <DeleteIcon />} onClick={() => void deleteBinding()} disabled={saving}>
                  Delete
                </Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Stack>
    </Box>
  );
}
