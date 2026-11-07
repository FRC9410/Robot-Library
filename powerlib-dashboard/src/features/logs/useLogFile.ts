import { useState } from "react";
import { isViewerSignal } from "./logModel";
import type { LogSource } from "./logModel";
import { savedLogTitle } from "./logLibraryModel";
import type { SavedLog } from "./logLibraryModel";
import { parseWpilog } from "./wpilog";

/** `id` is set when the log was opened from the logs folder list. */
export type LoadedLog = { id?: string; name: string; converted: boolean; sources: LogSource[] };

/** How many logs opened from the list stay parsed in memory, so going back to one is instant. */
const keepLoaded = 3;

const cleanError = (caught: unknown) =>
  (caught instanceof Error ? caught.message : String(caught)).replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");

/**
 * Opening a log from the list, the Open dialog or a drop: .wpilog files are read here, .hoot files are
 * converted by the Power Tool app. Used once, by `LoadedLogsProvider`, so open logs outlive the Logs tab.
 */
export function useLogFile() {
  const [loaded, setLoaded] = useState<LoadedLog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<LoadedLog[]>([]);

  function show(log: LoadedLog) {
    setLoaded(log);
    setError(log.sources.some(source => source.file.truncated)
      ? "The end of this log was cut off (the robot may have lost power). Everything before that point is shown." : null);
    if (log.id) setRecent(current => [log, ...current.filter(item => item.id !== log.id)].slice(0, keepLoaded));
  }

  /** Several files are one session (one per CAN bus); the roboRIO's comes first. */
  function load(files: { name: string; bytes: Uint8Array }[], name: string, converted: boolean, id?: string) {
    show({ id, name, converted, sources: files.map(file => ({ name: file.name, file: parseWpilog(file.bytes, isViewerSignal) })) });
  }

  async function run(task: () => Promise<void>) {
    setLoading(true);
    try {
      await task();
    } catch (caught) {
      setError(cleanError(caught));
    } finally {
      setLoading(false);
    }
  }

  function openLog() {
    void run(async () => {
      if (!window.powerlib?.openLog) throw new Error("Opening files needs the Power Tool app. Drag a .wpilog file here instead.");
      const result = await window.powerlib.openLog();
      if (!result.canceled) load(result.files, result.name, result.converted);
    });
  }

  function openSaved(log: SavedLog) {
    const kept = recent.find(item => item.id === log.id);
    if (kept) {
      show(kept);
      return;
    }
    void run(async () => {
      if (!window.powerlib?.openLogFiles) throw new Error("Opening logs from the list needs the Power Tool app.");
      const result = await window.powerlib.openLogFiles(log.files);
      load(result.files, savedLogTitle(log), result.converted, log.id);
    });
  }

  function openFiles(files: File[]) {
    if (!files.length) return;
    void run(async () => {
      const hoot = files.find(file => /\.hoot$/i.test(file.name));
      if (hoot) {
        const filePath = window.powerlib?.getPathForFile?.(hoot);
        if (!filePath || !window.powerlib?.openLogPath) throw new Error("Opening .hoot files needs the Power Tool app.");
        const result = await window.powerlib.openLogPath(filePath);
        load(result.files, result.name, result.converted);
      } else {
        // Several dropped .wpilog files open together as one session, roboRIO file first.
        const read = await Promise.all(files.map(async file => ({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) })));
        read.sort((left, right) => Number(/(^|_)rio_/i.test(right.name)) - Number(/(^|_)rio_/i.test(left.name)));
        load(read, files.length > 1 ? `${files[0].name} + ${files.length - 1} more` : files[0].name, false);
      }
    });
  }

  const keptIds = recent.flatMap(item => (item.id ? [item.id] : []));
  return { loaded, loading, error, setError, openLog, openFiles, openSaved, keptIds };
}

export type LogFileState = ReturnType<typeof useLogFile>;
