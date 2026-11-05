import { useCallback, useEffect, useRef, useState } from "react";
import type { AutoDocument } from "./autoModel";
import { parseAutoDocument } from "./autoModel";
import type { AutoFiles, AutoFilesState } from "./types";

const loadingFiles: AutoFiles = { loading: true, path: "", states: [], driveCommandInstalled: null, robotAutosHooked: null, robotAutosStrings: [],
  checks: [], robot: { width: 0.914, length: 0.914 }, drivetrain: null, vision: null, error: null };

const filesFrom = (state: AutoFilesState): AutoFiles => ({ loading: false, path: state.path, states: state.states,
  driveCommandInstalled: state.driveCommandInstalled, robotAutosHooked: state.robotAutosHooked, robotAutosStrings: state.robotAutosStrings ?? [],
  checks: state.checks ?? [], robot: state.robot, drivetrain: state.drivetrain ?? null, vision: state.vision ?? null, error: state.error ?? null });

/**
 * Reads the autos and what the Auto Builder needs to know about the robot project. `onDocument`
 * gets the saved autos each time they are (re)loaded.
 */
export function useAutoFiles(api: Window["powerlib"], onDocument: (document: AutoDocument) => void) {
  const [files, setFiles] = useState<AutoFiles>(loadingFiles);
  const onDocumentRef = useRef(onDocument);
  useEffect(() => { onDocumentRef.current = onDocument; });

  const load = useCallback(async () => {
    if (!api) {
      setFiles(current => ({ ...current, loading: false, error: "Open the Auto Builder in Power Tool to load and save robot autos." }));
      return;
    }
    setFiles(current => ({ ...current, loading: true }));
    try {
      const state = await api.readAutos();
      setFiles(filesFrom(state));
      onDocumentRef.current(parseAutoDocument(state.document));
    } catch (error) {
      setFiles(current => ({ ...current, loading: false, error: error instanceof Error ? error.message : "Could not read autos." }));
    }
  }, [api]);
  useEffect(() => { void load(); }, [load]);

  // File → Update Code may register the autos in RobotAutos.java; refresh what the panel shows.
  useEffect(() => {
    const onWritten = () => { void api?.readAutos().then(state => setFiles(filesFrom(state))).catch(() => {}); };
    window.addEventListener("powerlib:autos-written", onWritten);
    return () => window.removeEventListener("powerlib:autos-written", onWritten);
  }, [api]);

  return { files, load };
}
