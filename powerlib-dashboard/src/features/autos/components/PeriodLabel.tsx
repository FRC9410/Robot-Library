import { useState } from "react";
import { Tooltip } from "@mui/material";

type PeriodLabelProps = {
  period: number;
  onChange: (seconds: number) => void;
};

/** The autonomous period, shown quietly at the end of the timeline; click it to change it. */
export function PeriodLabel({ period, onChange }: PeriodLabelProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const value = Number(draft);
    if (draft !== null && Number.isFinite(value) && value >= 1 && value <= 60) onChange(Math.round(value * 10) / 10);
    setDraft(null);
  };
  if (draft !== null) {
    return <input className="ab-period-input" autoFocus value={draft} aria-label="Autonomous period in seconds"
      onChange={event => setDraft(event.target.value)} onBlur={commit}
      onKeyDown={event => { if (event.key === "Enter") commit(); if (event.key === "Escape") setDraft(null); }} />;
  }
  return <Tooltip title="Autonomous period length. Click to change.">
    <button type="button" className="ab-period" onClick={() => setDraft(String(period))}>{period} s</button>
  </Tooltip>;
}
