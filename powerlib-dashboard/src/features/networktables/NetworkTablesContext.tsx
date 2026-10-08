import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { NtTopicSnapshot, PowerLibNt4Client } from "../../networktables/nt4Client";
import type { ConnectionState } from "../../types/app";
import { TopicSnapshotBuffer } from "../../networktables/TopicSnapshotBuffer";
import { telemetryUpdateIntervalMs, tuningUpdateIntervalMs } from "../../networktables/telemetryTiming";
import { TopicViews, type TopicView } from "../../networktables/TopicViews";

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
  telemetryError: string | null;
  setTopics: React.Dispatch<React.SetStateAction<NtTopicSnapshot[]>>;
  upsertTopic: (snapshot: NtTopicSnapshot) => void;
  pruneTopics: (predicate: (snapshot: NtTopicSnapshot) => boolean) => void;
};

const NetworkTablesContext = createContext<NetworkTablesContextValue | null>(null);
const TopicViewsContext = createContext<TopicViews | null>(null);
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
  const topicViews = useRef(new TopicViews());
  const [telemetryError, setTelemetryError] = useState<string | null>(null);
  const topicBuffer = useRef(new TopicSnapshotBuffer());

  function setConnectionSettings(settings: ConnectionSettings) {
    setConnectionSettingsState(settings);
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
  }

  const setTopics: React.Dispatch<React.SetStateAction<NtTopicSnapshot[]>> = useCallback((update) => {
    const next = typeof update === "function" ? update(topicBuffer.current.values()) : update;
    // Connection resets also discard readings waiting for the next screen refresh.
    topicBuffer.current.replace(next);
    setTelemetryError(null);
    topicViews.current.replace(next);
  }, []);

  const upsertTopic = useCallback((snapshot: NtTopicSnapshot) => {
    // Timestamp receipt immediately so batching cannot make old telemetry look fresh.
    topicBuffer.current.upsert(snapshot, performance.now());
  }, []);

  const pruneTopics = useCallback((predicate: (snapshot: NtTopicSnapshot) => boolean) => {
    topicBuffer.current.retain(predicate);
    const next = topicBuffer.current.flush();
    if (next !== null) topicViews.current.replace(next);
  }, []);

  useEffect(() => {
    let nextTuningRefresh = 0;
    const timer = window.setInterval(() => {
      const next = topicBuffer.current.flush();
      setTelemetryError(topicBuffer.current.telemetryError);
      if (next !== null) topicViews.current.replace(next, false);
      const now = performance.now();
      // Share the 100 ms timer without skipping a tuning refresh due to submillisecond jitter.
      if (now + 1 >= nextTuningRefresh) {
        nextTuningRefresh = now + tuningUpdateIntervalMs;
        topicViews.current.refreshTuning();
      }
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
        telemetryError,
        setTopics,
        upsertTopic,
        pruneTopics
      }}
    >
      <TopicViewsContext.Provider value={topicViews.current}>{children}</TopicViewsContext.Provider>
    </NetworkTablesContext.Provider>
  );
}

export function useTopics(view: TopicView) {
  const store = useContext(TopicViewsContext);
  if (!store) throw new Error("useTopics must be used inside NetworkTablesProvider.");
  const snapshot = useCallback(() => store.get(view), [store, view]);
  return useSyncExternalStore(store.subscribe, snapshot);
}

export function useNetworkTables() {
  const context = useContext(NetworkTablesContext);
  if (!context) {
    throw new Error("useNetworkTables must be used inside NetworkTablesProvider.");
  }

  return context;
}
