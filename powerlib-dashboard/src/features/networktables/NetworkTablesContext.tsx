import { createContext, ReactNode, useContext, useRef, useState } from "react";
import { NtTopicSnapshot, PowerLibNt4Client } from "../../networktables/nt4Client";
import type { ConnectionState } from "../../types/app";

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
  const [topics, setTopics] = useState<NtTopicSnapshot[]>([]);

  function setConnectionSettings(settings: ConnectionSettings) {
    setConnectionSettingsState(settings);
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }

  function upsertTopic(snapshot: NtTopicSnapshot) {
    setTopics((current) => {
      const existing = current.filter((topic) => topic.name !== snapshot.name);
      return [...existing, snapshot];
    });
  }

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
