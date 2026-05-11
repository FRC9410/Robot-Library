import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
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
import type { BindingDocumentState, BindingFormState, GeneratedBinding } from "./types";
import {
  bindingToForm,
  chainOptions,
  controllerOptions,
  createEmptyBindingCommand,
  createEmptyBindingForm,
  eventOptions,
  formToBinding,
  getMethodsForSubsystem,
  inputOptions,
  methodNeedsValue,
  toConstantName
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
    if (binding.commands?.some((command) => !command.subsystemId || !command.method)) {
      onToast("Every binding command needs a subsystem and method.", "error");
      return;
    }
    if (
      binding.commands?.some((command) => methodNeedsValue(subsystems, command) && (!command.constantName || command.value === undefined))
    ) {
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
      setForm(null);
    } catch (caught) {
      onToast(caught instanceof Error ? caught.message : "Could not delete binding.", "error");
    } finally {
      setSaving(false);
    }
  }

  function updateCommand(index: number, patch: Partial<BindingFormState["commands"][number]>) {
    setForm((current) => {
      if (!current) {
        return current;
      }
      const commands = current.commands.map((command, commandIndex) =>
        commandIndex === index ? { ...command, ...patch } : command
      );
      return { ...current, commands };
    });
  }

  useEffect(() => {
    void loadBindings();
  }, []);

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
            <Button startIcon={<AddIcon />} variant="contained" onClick={() => setForm(createEmptyBindingForm(subsystems))}>
              Create Binding
            </Button>
            <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => void loadBindings()}>
              Refresh
            </Button>
            <Divider />
            <Typography variant="subtitle2">Button Bindings</Typography>
            {document.loading && <CircularProgress size={22} />}
            {document.bindings.map((binding, index) => (
              <Button
                key={binding.id ?? `${binding.name}-${index}`}
                variant={form?.index === index ? "contained" : "outlined"}
                onClick={() => setForm(bindingToForm(binding, index, subsystems))}
                sx={{ justifyContent: "flex-start", textAlign: "left" }}
              >
                <Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
                  <Typography sx={{ fontWeight: 800 }}>{binding.name || "Unnamed binding"}</Typography>
                  <Stack direction="row" spacing={0.75}>
                    <Chip size="small" label={binding.controller ?? "driver"} />
                    <Chip size="small" label={binding.input ?? "a"} />
                    <Chip size="small" label={binding.event ?? "onTrue"} />
                  </Stack>
                </Stack>
              </Button>
            ))}
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
                    gridTemplateColumns: { xs: "1fr", lg: "1.5fr repeat(4, minmax(150px, 1fr))" }
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
                  <FormControl>
                    <InputLabel>Chain</InputLabel>
                    <Select
                      label="Chain"
                      value={form.chain}
                      onChange={(event) => setForm({ ...form, chain: event.target.value as BindingFormState["chain"] })}
                    >
                      {chainOptions.map((option) => (
                        <MenuItem key={option} value={option}>{option}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Box>
                <Divider />
                <Stack direction="row" sx={{ alignItems: "center" }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, flexGrow: 1 }}>Commands</Typography>
                  <Button
                    startIcon={<AddIcon />}
                    variant="outlined"
                    onClick={() => setForm({ ...form, commands: [...form.commands, createEmptyBindingCommand(subsystems)] })}
                  >
                    Add Command
                  </Button>
                </Stack>
                <Stack spacing={2}>
                  {form.commands.map((command, index) => {
                    const subsystem = subsystems.find((candidate) => candidate.id === command.subsystemId);
                    const methods = getMethodsForSubsystem(subsystem);
                    const needsValue = methodNeedsValue(subsystems, command);
                    return (
                      <Card key={index} variant="outlined">
                        <CardContent>
                          <Stack spacing={2}>
                            <Stack direction="row" sx={{ alignItems: "center" }}>
                              <Typography sx={{ fontWeight: 800, flexGrow: 1 }}>Command {index + 1}</Typography>
                              {form.commands.length > 1 && (
                                <Button
                                  color="error"
                                  startIcon={<DeleteIcon />}
                                  onClick={() =>
                                    setForm({ ...form, commands: form.commands.filter((_, commandIndex) => commandIndex !== index) })
                                  }
                                >
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
                                    updateCommand(index, {
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
                                <Select
                                  label="Method"
                                  value={command.method}
                                  onChange={(event) => updateCommand(index, { method: event.target.value })}
                                >
                                  {methods.map((method) => (
                                    <MenuItem key={method.name} value={method.name}>
                                      {method.name}{method.needsValue ? "(value)" : ""}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                              {needsValue && (
                                <>
                                  <TextField
                                    label="Constant name"
                                    value={command.constantName ?? ""}
                                    onChange={(event) => updateCommand(index, { constantName: toConstantName(event.target.value) })}
                                  />
                                  <TextField
                                    label="Value"
                                    type="number"
                                    value={command.value ?? ""}
                                    onChange={(event) => updateCommand(index, { value: event.target.value })}
                                  />
                                </>
                              )}
                            </Box>
                          </Stack>
                        </CardContent>
                      </Card>
                    );
                  })}
                </Stack>
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
          <Stack direction="row" spacing={1} sx={{ alignItems: "center", borderTop: 1, borderColor: "divider", py: 1.5 }}>
            <Button startIcon={saving ? <CircularProgress size={18} /> : <SaveIcon />} variant="contained" onClick={saveForm} disabled={saving}>
              Save Binding
            </Button>
            <Button variant="outlined" onClick={() => setForm(null)}>Cancel</Button>
            <Box sx={{ flexGrow: 1 }} />
            {form.mode === "edit" && (
              <Button color="error" startIcon={<DeleteIcon />} onClick={() => void deleteBinding()} disabled={saving}>
                Delete
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </Box>
  );
}
