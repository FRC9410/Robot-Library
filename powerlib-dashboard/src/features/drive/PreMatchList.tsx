import { useEffect, useState } from "react";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { autoProject } from "../autos/autoCode";
import { parseAutoDocument } from "../autos/autoModel";
import type { PlannedAutos, PreMatchCheck } from "./preMatch";

/** Auto Builder autos from the open robot project, read again after File → Update Code; null outside Power Tool. */
export function usePlannedAutos() {
  const [planned, setPlanned] = useState<PlannedAutos | null>(null);
  useEffect(() => {
    const api = window.powerlib;
    if (!api?.readAutos) return;
    let active = true;
    const read = () => {
      api.readAutos().then(state => {
        if (active) setPlanned({ document: parseAutoDocument(state.document), project: autoProject(state), generatedSource: state.generatedSource ?? null });
      }, () => { if (active) setPlanned(null); });
    };
    read();
    window.addEventListener("powerlib:autos-written", read);
    return () => { active = false; window.removeEventListener("powerlib:autos-written", read); };
  }, []);
  return planned;
}

const icons = { ok: <CheckCircleOutlineIcon />, warning: <WarningAmberIcon />, info: <InfoOutlinedIcon /> };

export function PreMatchList({ checks }: { checks: PreMatchCheck[] }) {
  return <ul className="drive-prematch" aria-label="Pre-match checks">
    {checks.map(check => <li key={check.id} className={check.status}>{icons[check.status]}<span>{check.text}</span></li>)}
  </ul>;
}
