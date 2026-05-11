import { createContext, ReactNode, useContext, useRef, useState } from "react";
import { NtTopicSnapshot, PowerLibNt4Client } from "../../networktables/nt4Client";
import type { ConnectionState } from "../../types/app";

type NetworkTablesContextValue = {
  clientRef: React.MutableRefObject<PowerLibNt4Client>;
  status: ConnectionState;
  setStatus: (status: ConnectionState) => void;
  topics: NtTopicSnapshot[];
  setTopics: React.Dispatch<React.SetStateAction<NtTopicSnapshot[]>>;
  error: string | null;
  setError: (error: string | null) => void;
  upsertTopic: (snapshot: NtTopicSnapshot) => void;
};

const NetworkTablesContext = createContext<NetworkTablesContextValue | null>(null);

export function NetworkTablesProvider({ children }: { children: ReactNode }) {
  const clientRef = useRef(new PowerLibNt4Client());
  const [status, setStatus] = useState<ConnectionState>("idle");
  const [topics, setTopics] = useState<NtTopicSnapshot[]>([]);
  const [error, setError] = useState<string | null>(null);

  function upsertTopic(snapshot: NtTopicSnapshot) {
    setTopics((current) => {
      const existing = current.filter((topic) => topic.name !== snapshot.name);
      return [...existing, snapshot];
    });
  }

  return (
    <NetworkTablesContext.Provider value={{ clientRef, status, setStatus, topics, setTopics, error, setError, upsertTopic }}>
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
