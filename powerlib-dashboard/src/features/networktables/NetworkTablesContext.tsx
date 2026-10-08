import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { NtTopicSnapshot, PowerLibNt4Client } from "../../networktables/nt4Client";
import type { ConnectionState } from "../../types/app";
import { TopicSnapshotBuffer } from "../../networktables/TopicSnapshotBuffer";
import { telemetryUpdateIntervalMs } from "../../networktables/telemetryTiming";

export type ConnectionSettings = {
  targetId: string;
  host: string;
  port: number;
};

type NetworkTablesContextValue = {
  clientRef: React.MutableRefObject<PowerLibNt4Client>;
  status: ConnectionState;
  setStatus: (status: ConnectionState) => void;
  connectionSettings: ConnectionSettings;
  setConnectionSettings: (settings: ConnectionSettings) => void;
  topics: NtTopicSnapshot[];
  setTopics: React.Dispatch<React.SetStateAction<NtTopicSnapshot[]>>;
  upsertTopic: (snapshot: NtTopicSnapshot) => void;
};

const NetworkTablesContext = createContext<NetworkTablesContextValue | null>(null);
const settingsStorageKey = "powerlib.connectionSettings";
const defaultConnectionSettings: ConnectionSettings = {
  targetId: "sim-localhost",
  host: "localhost",
  port: 5810
};

function readSavedConnectionSettings() {
  try {
    const raw = window.localStorage.getItem(settingsStorageKey);
    if (!raw) {
      return defaultConnectionSettings;
    }

    const parsed = JSON.parse(raw) as Partial<ConnectionSettings>;
    return {
      targetId: parsed.targetId || defaultConnectionSettings.targetId,
      host: parsed.host || defaultConnectionSettings.host,
      port: Number.isFinite(Number(parsed.port)) ? Number(parsed.port) : defaultConnectionSettings.port
    };
  } catch {
    return defaultConnectionSettings;
  }
}

export function NetworkTablesProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef(new PowerLibNt4Client());
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [connectionSettingsState, setConnectionSettingsState] = useState<ConnectionSettings>(readSavedConnectionSettings);
  const [topics, setRenderedTopics] = useState<NtTopicSnapshot[]>([]);
  const topicBuffer = useRef(new TopicSnapshotBuffer());

  function setConnectionSettings(settings: ConnectionSettings) {
    setConnectionSettingsState(settings);
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }

  const setTopics: React.Dispatch<React.SetStateAction<NtTopicSnapshot[]>> = useCallback((update) => {
    const next = typeof update === "function" ? update(topicBuffer.current.values()) : update;
    // Connection resets also discard readings waiting for the next screen refresh.
    topicBuffer.current.replace(next);
    setRenderedTopics(next);
  }, []);

  const upsertTopic = useCallback((snapshot: NtTopicSnapshot) => {
    // Timestamp receipt immediately so batching cannot make old telemetry look fresh.
    topicBuffer.current.upsert(snapshot, performance.now());
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = topicBuffer.current.flush();
      if (next !== null) setRenderedTopics(next);
    }, telemetryUpdateIntervalMs);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <NetworkTablesContext.Provider
      value={{
        clientRef,
        status,
        setStatus,
        connectionSettings: connectionSettingsState,
        setConnectionSettings,
        topics,
        setTopics,
        upsertTopic
      }}
    >
      {children}
    </NetworkTablesContext.Provider>
  );
}

export function useNetworkTables() {
  const context = useContext(NetworkTablesContext);
  if (!context) {
    throw new Error("useNetworkTables must be used inside NetworkTablesProvider.");
  }

  return context;
}
