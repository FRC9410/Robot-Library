import type { ReactNode } from "react";
import { LoadedLogsContext } from "./loadedLogsContext";
import { useLogFile } from "./useLogFile";

type LoadedLogsProviderProps = {
  children: ReactNode;
};

/** Holds the open log for the whole app; wrap it around everything that shows logs. */
export function LoadedLogsProvider({ children }: LoadedLogsProviderProps) {
  return <LoadedLogsContext.Provider value={useLogFile()}>{children}</LoadedLogsContext.Provider>;
}
