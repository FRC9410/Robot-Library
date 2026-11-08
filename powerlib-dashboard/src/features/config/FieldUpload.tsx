import { useRef, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControlLabel, Stack, TextField, Typography } from "@mui/material";
import { validateUploadedField } from "../../../electron/uploadedField";
import type { UploadedField } from "../../../electron/uploadedField";
import { readFieldImage } from "../field/fieldUpload";
import { removeFieldUpload, saveFieldUpload } from "../field/fieldLayouts";
import { useUploadedField } from "../field/useUploadedField";

type FieldUploadProps = { dimensions: { length: number; width: number } };

export function FieldUpload({ dimensions }: FieldUploadProps) {
  const uploaded = useUploadedField();
  const input = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<UploadedField["image"] | null>(null);
  const [name, setName] = useState("");
  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const operation = useRef(false);

  async function choose(files: File[]) {
    if (operation.current) return;
    setError(""); setMessage("");
    if (files.length !== 1) { setError("Drop one field image at a time."); return; }
    operation.current = true; setBusy(true);
    try {
      const image = await readFieldImage(files[0]);
      setDraft(image); setName(files[0].name.replace(/\.[^.]+$/, "").slice(0, 80));
      setLength(String(dimensions.length)); setWidth(String(dimensions.width));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read this image."); }
    finally { operation.current = false; setBusy(false); }
  }

  async function save() {
    if (!draft || operation.current) return;
    operation.current = true; setBusy(true); setError(""); setMessage("");
    try {
      await saveFieldUpload(validateUploadedField({ version: 1, label: name, length: Number(length), width: Number(width), image: draft }));
      setDraft(null); setMessage("Uploaded field saved and selected for Dashboard, Autos, and Logs.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this field."); }
    finally { operation.current = false; setBusy(false); }
  }

  async function remove() {
    if (operation.current) return;
    operation.current = true; setBusy(true); setError(""); setMessage("");
    try { await removeFieldUpload(); setMessage("Uploaded field removed."); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not remove this field."); }
    finally { operation.current = false; setBusy(false); }
  }

  const valid = !!name.trim() && name.trim().length <= 80 && [length, width].every(value => !!value.trim() && Number.isFinite(Number(value)) && Number(value) > 0);
  return <Stack spacing={2} component="section" aria-label="Custom field upload" onKeyDown={event => {
    if (event.key === "Enter" && event.target instanceof HTMLInputElement) { event.preventDefault(); if (valid) void save(); }
  }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>Upload a field</Typography>
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" aria-label="Choose field image" hidden
      onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ""; if (files.length) void choose(files); }} />
    <Box component="button" type="button" aria-label="Upload field image" disabled={busy}
      onClick={() => input.current?.click()} onDragOver={event => { event.preventDefault(); setDragging(true); }}
      onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }}
      onDrop={event => { event.preventDefault(); event.stopPropagation(); setDragging(false); void choose(Array.from(event.dataTransfer.files)); }}
      sx={{ p: 3, border: "2px dashed", borderColor: dragging ? "primary.main" : "divider", borderRadius: 2,
        bgcolor: dragging ? "action.hover" : "transparent", color: "text.primary", cursor: busy ? "wait" : "pointer",
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 } }}>
      <Typography component="span" sx={{ display: "block" }}>{busy ? "Working…" : "Drop a field image here, or click to browse"}</Typography>
      <Typography component="span" variant="body2" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>PNG, JPEG, or WebP · Up to 10 MB</Typography>
    </Box>
    <Typography variant="body2" color="text.secondary">Use an image cropped to the field edges. Set its full size in meters, with the blue origin at the bottom left.</Typography>
    {draft && <>
      <Box component="img" src={draft.href} alt="Uploaded field preview" sx={{ width: "100%", maxHeight: 200, objectFit: "contain",
        transform: draft.rotate180 ? "rotate(180deg)" : undefined }} />
      <TextField label="Uploaded field name" value={name} disabled={busy} slotProps={{ htmlInput: { maxLength: 80 } }} onChange={event => setName(event.target.value)} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <TextField type="number" label="Uploaded field length (m)" value={length} disabled={busy} fullWidth
          slotProps={{ htmlInput: { min: 0, step: "any" } }} onChange={event => setLength(event.target.value)} />
        <TextField type="number" label="Uploaded field width (m)" value={width} disabled={busy} fullWidth
          slotProps={{ htmlInput: { min: 0, step: "any" } }} onChange={event => setWidth(event.target.value)} />
      </Stack>
      <FormControlLabel control={<Checkbox checked={draft.rotate180} disabled={busy} onChange={(_, rotate180) => setDraft({ ...draft, rotate180 })} />}
        label="Rotate image 180°" />
      <Stack direction="row" spacing={1}>
        <Button type="button" variant="contained" disabled={busy || !valid} onClick={() => void save()}>{uploaded ? "Replace uploaded field" : "Save uploaded field"}</Button>
        <Button type="button" disabled={busy} onClick={() => { setDraft(null); setError(""); }}>Cancel upload</Button>
      </Stack>
    </>}
    {uploaded && <Stack spacing={1}>
      <Typography variant="body2">Saved upload: {uploaded.label} · {uploaded.length} × {uploaded.width} m</Typography>
      <Stack direction="row" spacing={1}>
        <Button type="button" disabled={busy} onClick={() => {
          if (!uploaded.image) return;
          const { href, pixelWidth, pixelHeight, rotate180 } = uploaded.image;
          setDraft({ href, pixelWidth, pixelHeight, rotate180 }); setName(uploaded.label);
          setLength(String(uploaded.length)); setWidth(String(uploaded.width)); setError(""); setMessage("");
        }}>Edit uploaded field</Button>
        <Button type="button" color="error" disabled={busy} onClick={() => void remove()}>Remove uploaded field</Button>
      </Stack>
    </Stack>}
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="success">{message}</Alert>}
  </Stack>;
}
