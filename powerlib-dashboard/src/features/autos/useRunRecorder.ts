import { useEffect, useRef, useState } from "react";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import { driveModel, getPowerLibAutoChooser } from "../drive/driveModel";
import type { ActualRun } from "./autoActual";
import { RunRecorder, readRuns, saveRuns } from "./autoActual";

/**
 * Records each enabled autonomous period, so the route the robot really took can be drawn over the
 * plan. The latest run of each auto is kept on this laptop.
 */
export function useRunRecorder(topics: NtTopicSnapshot[], connected: boolean) {
  const recorder = useRef(new RunRecorder());
  const [runs, setRuns] = useState<Record<string, ActualRun>>(readRuns);
  const [recording, setRecording] = useState<ActualRun | null>(null);
  const [showActual, setShowActual] = useState(true);

  useEffect(() => {
    const model = driveModel(topics, connected, performance.now());
    const { run, ended } = recorder.current.update({ time: Date.now(), mode: connected ? model.text("mode") : undefined,
      enabled: model.boolean("enabled"), autoName: getPowerLibAutoChooser(topics)?.active, pose: model.pose });
    setRecording(ended ? null : run);
    if (ended && run && run.points.length > 1) {
      setRuns(current => { const next = { ...current, [run.autoName]: run }; saveRuns(next); return next; });
      setShowActual(true);
    }
  }, [topics, connected]);

  return {
    recording,
    showActual,
    /** The run being recorded for this auto, else its last recorded run. */
    runFor: (autoName: string): ActualRun | undefined => recording?.autoName === autoName ? recording : runs[autoName],
    toggleActual: () => setShowActual(current => !current),
    clearRun: (autoName: string) => setRuns(current => {
      const next = { ...current };
      delete next[autoName];
      saveRuns(next);
      return next;
    })
  };
}
