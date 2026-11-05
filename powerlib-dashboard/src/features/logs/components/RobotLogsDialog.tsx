import { useEffect, useMemo, useState } from "react";
import { Alert, Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import RefreshIcon from "@mui/icons-material/Refresh";
import { groupSavedLogs, isDownloaded } from "../logLibraryModel";
import type { SavedLog } from "../logLibraryModel";
import { useLogLibrary } from "../useLogLibrary";
import { useRobotLogs } from "../useRobotLogs";
import { DeleteRobotLogsDialog } from "./DeleteRobotLogsDialog";
import { LogsDialog } from "./LogsDialog";
import { RobotLogRow } from "./RobotLogRow";
import { RobotLogsFooter } from "./RobotLogsFooter";
import { SavedLogGroup } from "./SavedLogGroup";
import { ScrollArea } from "./ScrollArea";

type RobotLogsDialogProps = {
  open: boolean;
  onClose: () => void;
  onOpenLog: (log: SavedLog) => void;
  onDownloaded: () => void;
};

/** The runs on the robot: tick some and download them into the logs folder (one ticked also opens it), or delete them from the robot. */
export function RobotLogsDialog({ open, onClose, onOpenLog, onDownloaded }: RobotLogsDialogProps) {
  const robot = useRobotLogs();
  const local = useLogLibrary();
  const [picked, setPicked] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const groups = useMemo(() => groupSavedLogs(robot.logs, "all"), [robot.logs]);
  const chosen = robot.logs.filter(log => picked.includes(log.id));
  const busy = robot.progress !== null || robot.deleting;

  const { list } = robot;
  useEffect(() => {
    if (!open) return;
    setPicked([]);
    void list();
  }, [open, list]);

  const toggle = (log: SavedLog) => setPicked(current => (current.includes(log.id) ? current.filter(id => id !== log.id) : [...current, log.id]));

  async function download() {
    const saved = await robot.download(chosen, local.folder, local.logs);
    if (saved.length === 0) return;
    onDownloaded();
    void local.refresh();
    if (chosen.length === 1) onOpenLog(saved[0]);
    onClose();
  }

  async function remove() {
    await robot.remove(chosen);
    setConfirmDelete(false);
    setPicked([]);
  }

  const status = robot.listing ? "Connecting to the robot…" : robot.robot ? `${robot.robot} · ${robot.logs.length} run${robot.logs.length === 1 ? "" : "s"}` : "";
  return (
    <LogsDialog open={open} onClose={busy ? () => undefined : onClose}>
      <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 0.5, flexShrink: 0 }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Get logs from robot</Typography>
            <Typography variant="caption" color="text.secondary">{status}</Typography>
          </Box>
          <Tooltip title="Look again">
            <span><IconButton size="small" onClick={() => void robot.list()} disabled={robot.listing || busy} aria-label="Look again"><RefreshIcon fontSize="small" /></IconButton></span>
          </Tooltip>
          <IconButton size="small" onClick={onClose} disabled={busy} aria-label="Close"><CloseIcon fontSize="small" /></IconButton>
        </Stack>
        {robot.error && <Alert severity="error">{robot.error}</Alert>}
        <ScrollArea>
          {!robot.listing && !robot.error && robot.logs.length === 0
            ? <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>No logs on the robot.</Typography>
            : groups.map(group => (
              <SavedLogGroup key={group.id} group={group} renderLog={log => (
                <RobotLogRow key={log.id} log={log} checked={picked.includes(log.id)} downloaded={isDownloaded(log, local.logs)}
                  disabled={busy} onToggle={toggle} />
              )} />
            ))}
        </ScrollArea>
        <RobotLogsFooter count={chosen.length} bytes={chosen.reduce((sum, log) => sum + log.bytes, 0)} progress={robot.progress}
          deleting={robot.deleting} onCancel={onClose} onDelete={() => setConfirmDelete(true)} onDownload={() => void download()} />
      </Stack>
      <DeleteRobotLogsDialog open={confirmDelete} count={chosen.length} notDownloaded={chosen.filter(log => !isDownloaded(log, local.logs)).length}
        deleting={robot.deleting} onCancel={() => setConfirmDelete(false)} onConfirm={() => void remove()} />
    </LogsDialog>
  );
}
