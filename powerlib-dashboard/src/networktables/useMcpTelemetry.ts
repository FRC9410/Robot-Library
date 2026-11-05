import { useEffect, type RefObject } from "react";
import type { NtTopicSnapshot, NtValue, PowerLibNt4Client } from "./nt4Client";
import { telemetryUpdateIntervalMs } from "./telemetryTiming";

type WireValue = string | number | boolean | null | { base64: string } | { number: string } | WireValue[];
export type NtWireSnapshot = Omit<NtTopicSnapshot, "value"> & { value: WireValue };

function decodeValue(value: WireValue): NtValue {
  if (Array.isArray(value)) return value.map(decodeValue) as NtValue;
  if (value === null || typeof value !== "object") return value;
  if ("base64" in value) return Uint8Array.from(atob(value.base64), character => character.charCodeAt(0)).buffer;
  return Number(value.number);
}

export function useMcpTelemetry(clientRef: RefObject<PowerLibNt4Client>, onValue: (value: NtTopicSnapshot) => void) {
  useEffect(() => {
    const read = window.powerlib?.readNt4;
    if (!read) return;
    const client = clientRef.current;
    let stopped = false;
    let timer: number;
    let hadTarget = false;

    async function poll() {
      const target = client.getTelemetryTarget();
      let delay = telemetryUpdateIntervalMs;
      const startedAt = performance.now();
      try {
        if (target) {
          hadTarget = true;
          const updates = await read!(target.host, target.port, client.getTelemetryWatches());
          if (updates === null) delay = 1000;
          if (!stopped && target === client.getTelemetryTarget()) {
            for (const update of updates ?? []) {
              if (client.isWatchedValue(update.name)) {
                onValue({ ...update, value: decodeValue(update.value) });
              }
            }
          }
        } else if (hadTarget) {
          hadTarget = false;
          await read!(null, 0, {});
        }
      } catch {
        delay = 1000; // The original NetworkTables client continues supplying readings.
      }
      if (!stopped) {
        const targetChanged = target !== client.getTelemetryTarget();
        timer = window.setTimeout(poll, targetChanged ? 0 : Math.max(0, delay - (performance.now() - startedAt)));
      }
    }

    timer = window.setTimeout(poll, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
      if (hadTarget) void read(null, 0, {}).catch(() => {});
    };
  }, [clientRef, onValue]);
}
