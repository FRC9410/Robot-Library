import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert, Link, Stack, Typography } from "@mui/material";
import { groupSavedLogs } from "../logLibraryModel";
import type { LogFilter, SavedLog } from "../logLibraryModel";
import { useLogLibrary } from "../useLogLibrary";
import { LogFolderBar } from "./LogFolderBar";
import { LogLibraryToolbar } from "./LogLibraryToolbar";
import { RobotLogsButton } from "./RobotLogsButton";
import { SavedLogGroup } from "./SavedLogGroup";
import { SavedLogRow } from "./SavedLogRow";
import { ScrollArea } from "./ScrollArea";

type LogLibraryProps = {
  openId?: string;
  keptIds: string[];
  loading: boolean;
  onOpen: (log: SavedLog) => void;
  onOpenFile: () => void;
  /** Extra controls at the end of the toolbar, like the drawer's close button. */
  action?: ReactNode;
};

/** The logs in the logs folder, grouped by event, Matches first. Used on the start page and in the drawer. */
export function LogLibrary({ openId, keptIds, loading, onOpen, onOpenFile, action }: LogLibraryProps) {
  const library = useLogLibrary();
  const [filter, setFilter] = useState<LogFilter>("matches");
  const [search, setSearch] = useState("");
  const groups = useMemo(() => groupSavedLogs(library.logs, filter, search), [library.logs, filter, search]);

  let message: ReactNode = null;
  if (!library.available) message = "The logs list needs the Power Tool app. Drop a .wpilog file here instead.";
  else if (!library.exists) message = "This folder doesn't exist yet. Pick the folder your logs are in.";
  else if (library.logs.length === 0) message = library.listing ? "Looking for logs…" : "No .hoot or .wpilog files in this folder.";
  else if (groups.length === 0 && filter === "matches" && !search) {
    message = <>No match logs here. Logs recorded with the field connected show up here. <Link component="button" variant="body2" onClick={() => setFilter("all")}>Show all</Link></>;
  } else if (groups.length === 0) message = "Nothing matches.";

  return (
    <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
      <LogLibraryToolbar filter={filter} search={search} listing={library.listing} onFilter={setFilter} onSearch={setSearch}
        onRefresh={() => void library.refresh()}
        action={<><RobotLogsButton onOpenLog={onOpen} onDownloaded={() => void library.refresh()} />{action}</>} />
      {library.error && <Alert severity="error">{library.error}</Alert>}
      <ScrollArea>
        {message
          ? <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>{message}</Typography>
          : groups.map(group => (
            <SavedLogGroup key={group.id} group={group} renderLog={log => (
              <SavedLogRow key={log.id} log={log} disabled={loading} onOpen={onOpen}
                status={log.id === openId ? "open" : keptIds.includes(log.id) ? "kept" : undefined} />
            )} />
          ))}
      </ScrollArea>
      <LogFolderBar folder={library.folder} onChangeFolder={() => void library.chooseFolder()} onOpenFile={onOpenFile} />
    </Stack>
  );
}
