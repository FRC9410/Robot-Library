import { useCallback, useEffect, useMemo, useState } from "react";
import { downloadFolderFor, groupLogFiles } from "./logLibraryModel";
import type { LogFileEntry, SavedLog } from "./logLibraryModel";

const cleanError = (caught: unknown) =>
  (caught instanceof Error ? caught.message : String(caught)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");

/** The runs on the robot, and downloading them into the logs folder with progress. */
export function useRobotLogs() {
  const [files, setFiles] = useState<LogFileEntry[]>([]);
  const [robot, setRobot] = useState<string | null>(null);
  const [listing, setListing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => window.powerlib?.onRobotDownloadProgress?.((_event, next) => setProgress({ done: next.done, total: next.total })), []);

  const list = useCallback(async () => {
    if (!window.powerlib?.listRobotLogs) return;
    setListing(true);
    setError(null);
    try {
      const result = await window.powerlib.listRobotLogs();
      setFiles(result.files);
      setRobot(`${result.username}@${result.host}`);
    } catch (caught) {
      setFiles([]);
      setRobot(null);
      setError(cleanError(caught));
    } finally {
      setListing(false);
    }
  }, []);

  /** Downloads `logs` into `localRoot` next to the `local` logs already there; returns them as local logs. */
  async function download(logs: SavedLog[], localRoot: string, local: SavedLog[]) {
    if (!window.powerlib?.downloadRobotLogs) return [];
    const downloads = logs.flatMap(log => {
      const localFolder = downloadFolderFor(log, local);
      return log.files.map(remotePath => ({ remotePath, localFolder }));
    });
    setError(null);
    setProgress({ done: 0, total: 1 });
    try {
      return groupLogFiles(await window.powerlib.downloadRobotLogs(downloads, localRoot));
    } catch (caught) {
      setError(cleanError(caught));
      return [];
    } finally {
      setProgress(null);
    }
  }

  /** Deletes every file of `logs` from the robot, then lists it again. Returns false if anything wasn't deleted. */
  async function remove(logs: SavedLog[]) {
    if (!window.powerlib?.deleteRobotLogs) return false;
    setDeleting(true);
    setError(null);
    try {
      const result = await window.powerlib.deleteRobotLogs(logs.flatMap(log => log.files));
      await list();
      if (result.failed.length === 0) return true;
      const names = result.failed.map(item => item.path.split("/").pop()).join(", ");
      setError(`Couldn't delete ${names} (${result.failed[0].error}).`);
      return false;
    } catch (caught) {
      setError(cleanError(caught));
      return false;
    } finally {
      setDeleting(false);
    }
  }

  const logs = useMemo(() => groupLogFiles(files), [files]);
  return { logs, robot, listing, deleting, error, progress, list, download, remove };
}
