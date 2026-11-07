import { useEffect, useState } from "react";
import { isTuningSessionValue, type TuningConnection, type TuningSessionFile } from "../../electron/tuningSession";
import type { PowerLibNt4Client } from "./nt4Client";
export type TuningRecovery = TuningSessionFile & { error: string | null };
const empty: TuningRecovery = { values: [], path: "", error: null };
export function useTuningPersistence(client: PowerLibNt4Client, connection: TuningConnection) {
  const { targetId, host, port } = connection;
  const scope = JSON.stringify([targetId, host.trim().toLowerCase(), port]);
  const [cached, setCached] = useState({ scope, recovery: empty });
  useEffect(() => {
    let active = true; let requested = 0; let received = -1;
    const target = { targetId, host, port };
    setCached({ scope, recovery: empty });
    const bridge = window.powerlib;
    if (!bridge?.readTuningSession || !bridge.saveTuningSession) return;
    const accept = (result: TuningSessionFile, revision: number) => { if (active && revision >= received) { received = revision; setCached({ scope, recovery: { ...result, error: null } }); } };
    void bridge.readTuningSession(target).then(result => accept(result, 0)).catch(error => { if (active && received < 0) setCached({ scope, recovery: { ...empty, error: String(error) } }); });
    const unsubscribe = client.onPublished(async publication => {
      if (publication.host.trim().toLowerCase() !== host.trim().toLowerCase() || publication.port !== port || !isTuningSessionValue(publication)) return;
      const revision = ++requested;
      try { accept(await bridge.saveTuningSession(target, [{ name: publication.name, type: publication.type, value: publication.value }]), revision); }
      catch (error) { if (active && revision >= received) { received = revision; setCached(current => ({ scope, recovery: { ...current.recovery, error: `Live tuning was applied, but recovery could not be saved: ${String(error)}` } })); } }
    });
    return () => { active = false; unsubscribe(); };
  }, [client, targetId, host, port, scope]);
  return cached.scope === scope ? cached.recovery : empty;
}
