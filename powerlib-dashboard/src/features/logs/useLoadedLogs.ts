import { useContext } from "react";
import { LoadedLogsContext } from "./loadedLogsContext";

/** The open log and the actions that open one, from `LoadedLogsProvider`. */
export function useLoadedLogs() {
  const value = useContext(LoadedLogsContext);
  if (!value) throw new Error("useLoadedLogs needs a LoadedLogsProvider above it.");
  return value;
}
