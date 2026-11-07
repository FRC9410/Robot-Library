import { createContext } from "react";
import type { LogFileState } from "./useLogFile";

/** The open log and the last few opened, held above the Logs tab so they survive it unmounting. */
export const LoadedLogsContext = createContext<LogFileState | null>(null);
