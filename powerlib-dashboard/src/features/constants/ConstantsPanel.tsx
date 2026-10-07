import { useEffect, useState } from "react";
import { Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import type { ConstantRow, ConstantsFile } from "./types";
import { constantValueForEditor, constantValueFromEditor, editableConstantTypes, isNumericConstantType, normalizeConstantName } from "./types";

const editorOutline = { "& .MuiOutlinedInput-notchedOutline": { borderColor: "text.secondary" } };

function displayName(file: ConstantsFile) {
  return file.kind === "robot" ? file.name.replace(/([a-z])([A-Z])/g, "$1 $2") : file.name;
}

export function ConstantsPanel({ active }: { active: boolean }) {
  const [files, setFiles] = useState<ConstantsFile[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ index: number; name: string } | null>(null);
  const [editor, setEditor] = useState<{ index: number; row: ConstantRow; value: string } | null>(null);
  const selected = files.find((file) => file.id === selectedId);
  const rows = selected?.constants ?? [];
  const hasDrafts = Boolean(editor);
  const visibleRows = editor?.index === rows.length ? [...rows, editor.row] : rows;

  async function refresh() {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      if (!window.powerlib?.readConstants) throw new Error("PowerLib file bridge is not available.");
      const loaded = await window.powerlib.readConstants();
      setFiles(loaded);
      setEditor(null);
      setSelectedId((current) => loaded.some((file) => file.id === current) ? current : loaded[0]?.id ?? "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not load constants.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (active && !hasDrafts) void refresh(); }, [active]);
  // Keep the active edit when switching application tabs, and warn before closing or reloading.
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    if (hasDrafts) window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasDrafts]);

  function startEditing(index: number, row: ConstantRow) {
    setEditor({ index, row: { ...row, name: row.custom ? normalizeConstantName(row.name) : row.name }, value: constantValueForEditor(row) });
    setMessage(null);
    setError(null);
  }

  function changeType(type: string) {
    if (!editor) return;
    const value = type === "boolean" ? "false" : type === "String" ? "" : "0";
    setEditor({ ...editor, row: { ...editor.row, type, tunable: isNumericConstantType(type) }, value });
    setError(null);
  }

  async function finishEditing() {
    if (!editor) return;
    try {
      const row = { ...editor.row, name: editor.row.custom ? normalizeConstantName(editor.row.name) : editor.row.name,
        value: constantValueFromEditor(editor.value, editor.row.type), tunable: isNumericConstantType(editor.row.type) };
      if (!/^[A-Za-z_$][\w$]*$/.test(row.name)) throw new Error("Enter a name beginning with a letter or underscore, using letters, numbers, or underscores.");
      if (rows.some((existing, index) => index !== editor.index && existing.name === row.name)) throw new Error(`A constant named ${row.name} already exists.`);
      const next = editor.index === rows.length ? [...rows, row] : rows.map((existing, index) => index === editor.index ? row : existing);
      if (await persistRows(next)) setEditor(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Check this constant's value.");
    }
  }

  function cancelEditing() {
    setEditor(null);
    setError(null);
  }

  async function persistRows(next: ConstantRow[]) {
    if (!selected || !window.powerlib?.saveConstants) {
      setError("PowerLib file bridge is not available.");
      return false;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await window.powerlib.saveConstants(selected.id, selected.source, next);
      if (saved.error) throw new Error(saved.error);
      setFiles((current) => current.map((file) => file.id === saved.id ? saved : file));
      setMessage(`Saved ${displayName(saved)} constants. Run Update Code to apply them.`);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save constants.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (await persistRows(rows.filter((_, index) => index !== deleteTarget.index))) setEditor(null);
    setDeleteTarget(null);
  }

  return (
    <Box sx={{ display: "grid", gap: 2, gridTemplateColumns: { xs: "1fr", md: "320px 1fr" }, height: { xs: "auto", md: "calc(100vh - 150px)" }, minHeight: { md: 520 }, overflow: { xs: "visible", md: "hidden" } }}>
      <Card variant="outlined" sx={{ minHeight: 0, overflow: "hidden" }}>
        <CardContent sx={{ height: "100%", overflowY: "auto" }}>
          <Stack spacing={2}>
            <Button fullWidth startIcon={loading ? <CircularProgress size={18} /> : <RefreshIcon />} variant="outlined" disabled={loading || saving} onClick={() => hasDrafts ? setDiscardOpen(true) : void refresh()}>Refresh</Button>
            <Divider />
            <Typography variant="subtitle2" color="text.secondary">Subsystem Constants</Typography>
            {files.filter((file) => file.kind === "subsystem").length === 0 && <Typography variant="body2" color="text.secondary">Generated subsystems will appear here after they are created.</Typography>}
            {(["subsystem", "robot"] as const).map((kind) => (
              <Stack spacing={1} key={kind}>
                {kind === "robot" && <><Divider /><Typography variant="subtitle2" color="text.secondary">Robot Constants</Typography></>}
                {files.filter((file) => file.kind === kind).map((file) => (
                  <Button key={file.id} variant={selectedId === file.id ? "contained" : "outlined"} color={selectedId === file.id ? "primary" : "inherit"} disabled={saving || loading || Boolean(editor)} onClick={() => { setSelectedId(file.id); setMessage(null); setError(null); }} sx={{ justifyContent: "flex-start", minHeight: 64, textAlign: "left", textTransform: "none" }}>
                    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 700 }}>{displayName(file)}</Typography>
                      <Chip size="small" label={file.error ? "Unavailable" : `${file.constants.length} constants`} />
                    </Stack>
                  </Button>
                ))}
              </Stack>
            ))}
          </Stack>
        </CardContent>
      </Card>
      <Card elevation={0} sx={{ minHeight: 0, overflow: "hidden", height: { xs: "75vh", md: "100%" }, border: 0 }}>
        <CardContent sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
          <Stack spacing={2} sx={{ flex: 1, minHeight: 0 }}>
            {error && <Alert severity="error">{error}</Alert>}
            {message && <Alert severity="success">{message}</Alert>}
            {selected ? <>
              <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
                <Typography variant="h6">{displayName(selected)}</Typography>
                <Button disabled={!editor || saving || loading} onClick={() => { cancelEditing(); setMessage(null); }}>Reset</Button>
              </Stack>
              {selected.error ? <Alert severity="warning">{selected.error}</Alert> : <>
                {rows.length === 0 && <Alert severity="info">No custom constants yet. Add a constant to get started.</Alert>}
                <TableContainer sx={{ flex: 1, minHeight: 0, overflow: "auto" }}>
                  <Table stickyHeader size="small" aria-label="Constants" sx={{ minWidth: 700, "& th, & td": { border: 0 }, "& th": { bgcolor: "background.paper", fontWeight: 700, borderBottom: "1px solid", borderColor: "text.secondary" }, "& td": { verticalAlign: "top", py: 1.5 } }}>
                    <TableHead><TableRow><TableCell>Name</TableCell><TableCell>Java type</TableCell><TableCell>Value</TableCell><TableCell>Tunable</TableCell><TableCell>Actions</TableCell></TableRow></TableHead>
                    <TableBody>
                      {visibleRows.map((storedRow, index) => {
                        const editing = editor?.index === index;
                        const row = editing ? editor.row : storedRow;
                        const boolean = ["boolean", "Boolean", "java.lang.Boolean"].includes(row.type);
                        const numeric = isNumericConstantType(row.type);
                        return <TableRow key={`${selected.id}-${index}`} sx={editing ? { bgcolor: "action.hover" } : undefined}>
                          <TableCell sx={{ width: "28%" }}>{editing && row.custom ? <TextField autoFocus fullWidth variant="outlined" value={row.name} disabled={saving} onChange={(event) => setEditor({ ...editor, row: { ...row, name: normalizeConstantName(event.target.value) } })} size="small" sx={editorOutline} slotProps={{ htmlInput: { "aria-label": "Constant name" } }} /> : <Typography variant="body2" sx={{ overflowWrap: "anywhere" }}>{row.name}</Typography>}</TableCell>
                          <TableCell sx={{ width: "16%" }}>{editing && row.custom ? <Select fullWidth variant="outlined" size="small" value={row.type} disabled={saving} sx={editorOutline} inputProps={{ "aria-label": "Java type" }} onChange={(event) => changeType(event.target.value)}>
                            {!editableConstantTypes.some((type) => type === row.type) && <MenuItem disabled value={row.type}>{row.type}</MenuItem>}
                            {editableConstantTypes.map((type) => <MenuItem key={type} value={type}>{type === "String" ? "string" : type}</MenuItem>)}
                          </Select> : <Typography variant="body2">{row.type === "String" ? "string" : row.type}</Typography>}</TableCell>
                          <TableCell sx={{ width: "34%" }}>{boolean ? <Checkbox checked={(editing ? editor.value : row.value) === "true"} disabled={!editing || saving} onChange={(event) => { if (editor) setEditor({ ...editor, value: String(event.target.checked) }); }} slotProps={{ input: { "aria-label": `Value ${row.name || "new constant"}` } }} sx={{ p: 0 }} /> : editing ? <TextField fullWidth variant="outlined" type={numeric ? "number" : "text"} value={editor.value} disabled={saving} multiline={!numeric} minRows={1} onChange={(event) => setEditor({ ...editor, value: event.target.value })} size="small" sx={editorOutline} slotProps={{ input: { sx: { fontFamily: "monospace" } }, htmlInput: { "aria-label": `Value ${row.name || "new constant"}`, ...(numeric ? { step: /^(int|Integer|java\.lang\.Integer|byte|Byte|short|Short|long|Long)$/.test(row.type) ? 1 : "any", inputMode: "decimal", ...(row.type === "int" ? { min: -2147483648, max: 2147483647 } : {}) } : {}) } }} /> : <Typography variant="body2" sx={{ fontFamily: "monospace", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{constantValueForEditor(row)}</Typography>}</TableCell>
                          <TableCell><Typography variant="body2">{numeric ? "Yes" : "No"}</Typography></TableCell>
                          <TableCell sx={{ whiteSpace: "nowrap" }}>{editing ? <>
                            <Tooltip title="Save"><span><IconButton aria-label={`Save ${row.name || "constant"}`} disabled={saving || loading} sx={{ color: "success.main" }} onClick={() => void finishEditing()}><CheckIcon /></IconButton></span></Tooltip>
                            <Tooltip title="Cancel"><span><IconButton aria-label={`Cancel ${row.name || "constant"}`} disabled={saving || loading} sx={{ color: "error.main" }} onClick={cancelEditing}><CloseIcon /></IconButton></span></Tooltip>
                          </> : <>
                            <Tooltip title="Edit"><span><IconButton aria-label={`Edit ${row.name}`} disabled={saving || loading} onClick={() => startEditing(index, row)}><EditIcon /></IconButton></span></Tooltip>
                            <Tooltip title="Delete"><span><IconButton aria-label={`Delete ${row.name || "constant"}`} disabled={saving || loading || !row.custom} onClick={() => setDeleteTarget({ index, name: row.name })}><DeleteIcon /></IconButton></span></Tooltip>
                          </>}</TableCell>
                        </TableRow>;
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Button startIcon={<AddIcon />} variant="outlined" disabled={saving || loading || Boolean(editor)} sx={{ alignSelf: "flex-start" }} onClick={() => startEditing(rows.length, { originalName: null, name: "", type: "double", value: "0.0", custom: true, tunable: true })}>Add Constant</Button>
              </>}
            </> : !loading && !error && <Alert severity="info">Select a constants file from the menu.</Alert>}
          </Stack>
        </CardContent>
      </Card>
      <Dialog open={discardOpen} onClose={() => setDiscardOpen(false)}>
        <DialogTitle>Discard unsaved constants?</DialogTitle>
        <DialogContent>Refreshing will discard the current row edit.</DialogContent>
        <DialogActions><Button onClick={() => setDiscardOpen(false)}>Cancel</Button><Button onClick={() => { setDiscardOpen(false); void refresh(); }}>Discard and Refresh</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(deleteTarget)} onClose={saving ? undefined : () => setDeleteTarget(null)}>
        <DialogTitle>Delete constant?</DialogTitle>
        <DialogContent>Delete {deleteTarget?.name} from {selected ? displayName(selected) : "this subsystem"} constants?</DialogContent>
        <DialogActions>
          <Button disabled={saving} onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button color="error" disabled={saving} onClick={() => void confirmDelete()}>{saving ? "Deleting" : "Delete"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
