import { useEffect, useState } from "react";
import { autoProject } from "../autos/autoCode";
import { parseAutoDocument } from "../autos/autoModel";
import type { PlannedAutos } from "./preMatch";

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
