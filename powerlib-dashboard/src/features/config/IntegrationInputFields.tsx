import { useState } from "react";
import { Button, Stack, TextField } from "@mui/material";
import type { IntegrationView, InputValues } from "../../../electron/integrations/catalog";

export type IntegrationInputFieldsProps = {
  integration: IntegrationView;
  disabled: boolean;
  onSave: (values: InputValues) => Promise<boolean>;
};

export function IntegrationInputFields({ integration, disabled, onSave }: IntegrationInputFieldsProps) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const fields = Object.entries(integration.inputs);
  if (!fields.length) return null;
  return <Stack component="form" spacing={1.5} onSubmit={async event => {
    event.preventDefault();
    const values = Object.fromEntries(fields.flatMap(([id, input]) => {
      const value = draft[id] ?? integration.values[id];
      if (value === undefined || (input.type === "integer" && value === "")) return [];
      return [[id, input.type === "integer" ? Number(value) : String(value)]];
    }));
    if (await onSave(values)) setDraft({});
  }}>
    {fields.map(([id, field]) => <TextField key={id} label={field.label} size="small" fullWidth disabled={disabled}
      required={field.required} type={field.type === "integer" ? "number" : "text"} value={draft[id] ?? integration.values[id] ?? ""}
      slotProps={{ htmlInput: { min: field.minimum, max: field.maximum, step: field.type === "integer" ? 1 : undefined } }}
      onChange={event => setDraft(previous => ({ ...previous, [id]: event.target.value }))} />)}
    <Button type="submit" variant="outlined" disabled={disabled || !Object.keys(draft).length} sx={{ alignSelf: "flex-start" }}>Save settings</Button>
  </Stack>;
}
