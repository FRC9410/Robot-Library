import { useCallback, useEffect, useMemo, useState } from "react";
import { groupLogFiles } from "./logLibraryModel";
import type { LogFileEntry } from "./logLibraryModel";
import { readSaved, writeSaved } from "./logUtils";

const folderKey = "powerlib.logs.folder.v1";
const isText = (value: unknown): value is string => typeof value === "string";

/** The logs folder (a setting on this laptop) and the runs saved in it. Lists the folder again on `refresh`. */
export function useLogLibrary() {
  const [folder, setFolder] = useState(() => readSaved(folderKey, "", isText));
  const [files, setFiles] = useState<LogFileEntry[]>([]);
  const [exists, setExists] = useState(true);
  const [listing, setListing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!folder) window.powerlib?.defaultLogsFolder?.().then(setFolder).catch(() => setFolder(""));
  }, [folder]);

  const refresh = useCallback(async () => {
    if (!folder || !window.powerlib?.listLogs) return;
    setListing(true);
    try {
      const result = await window.powerlib.listLogs(folder);
      setFiles(result.files);
      setExists(result.exists);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setListing(false);
    }
  }, [folder]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function chooseFolder() {
    const chosen = await window.powerlib?.chooseLogsFolder?.();
    if (!chosen) return;
    setFolder(chosen);
    writeSaved(folderKey, chosen);
  }

  const logs = useMemo(() => groupLogFiles(files), [files]);
  return { folder, exists, listing, error, logs, refresh, chooseFolder, available: Boolean(window.powerlib?.listLogs) };
}
