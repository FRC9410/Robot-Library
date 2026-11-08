import { useEffect, useState } from "react";
import { TextField } from "@mui/material";

type AutoNumberFieldProps = { label: string; value: number; onChange: (value: number) => void; disabled?: boolean; min?: number; max?: number };

export function AutoNumberField({ label, value, onChange, disabled, min, max }: AutoNumberFieldProps) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const valid = !!draft.trim() && Number.isFinite(Number(draft));
  return <TextField label={label} value={draft} type="number" size="small" fullWidth disabled={disabled}
    error={!valid || (min !== undefined && Number(draft) < min) || (max !== undefined && Number(draft) > max)}
    slotProps={{ htmlInput: { step: "any", min, max } }}
    onChange={event => {
      setDraft(event.target.value);
      if (event.target.value.trim() && Number.isFinite(Number(event.target.value))) onChange(Number(event.target.value));
    }} onBlur={() => { if (!valid) setDraft(String(value)); }} />;
}
