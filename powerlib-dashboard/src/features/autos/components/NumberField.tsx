import { useEffect, useState } from "react";
import { TextField, Typography } from "@mui/material";

type NumberFieldProps = {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  /** Lets the field be cleared, which reports null. */
  allowEmpty?: boolean;
  placeholder?: string;
  error?: boolean;
};

/** A number input that keeps what's typed (such as "1.") until it is a number, and follows outside changes. */
export function NumberField({ label, value, onChange, unit, allowEmpty = false, placeholder, error }: NumberFieldProps) {
  const [draft, setDraft] = useState(value === null ? "" : String(value));
  // Follow outside edits, such as dragging on the field, without fighting the user's typing.
  useEffect(() => {
    setDraft(current => (current.trim() === "" ? null : Number(current)) === value ? current : value === null ? "" : String(value));
  }, [value]);
  const parsed = draft.trim() === "" ? null : Number(draft);
  const invalid = parsed === null ? !allowEmpty : !Number.isFinite(parsed);
  return <TextField size="small" label={label} value={draft} error={invalid || error} placeholder={placeholder} fullWidth
    slotProps={{ inputLabel: placeholder ? { shrink: true } : undefined, input: { endAdornment: unit
      ? <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: "nowrap" }}>{unit}</Typography> : undefined } }}
    onChange={event => {
      setDraft(event.target.value);
      const next = event.target.value.trim() === "" ? null : Number(event.target.value);
      if (next === null ? allowEmpty : Number.isFinite(next)) onChange(next);
    }} />;
}
