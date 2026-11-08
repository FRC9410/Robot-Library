import { useCallback, useEffect, useRef, useState } from "react";
import type { AutoFilesState } from "../../../electron/autoFiles";
import { emptyDocument, generateAutosJava, hasErrors, validateAutos, type AutoProject } from "./autoModel";
import { useAutoHistory } from "./useAutoHistory";

type Dimensions = { length: number; width: number };

export function useAutoEditor(field: Dimensions) {
  const history = useAutoHistory(emptyDocument);
  const { document, setDocument, reset } = history;
  const [files, setFiles] = useState<AutoFilesState | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const current = useRef(document); current.current = document;
  const metadata = useRef(files); metadata.current = files;
  const saved = useRef(JSON.stringify(document));
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);
  const loadSequence = useRef(0);

  const accept = useCallback((state: AutoFilesState) => {
    if (!mounted.current) return;
    metadata.current = state; setFiles(state);
  }, []);

  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    if (!window.powerlib?.readAutos) { setLoading(false); setError("Auto files require the Power Tool app."); return; }
    setLoading(true); setError(""); setMessage("");
    try {
      await queue.current;
      const state = await window.powerlib.readAutos();
      if (!mounted.current || sequence !== loadSequence.current) return;
      const next = state.document ?? emptyDocument();
      saved.current = JSON.stringify(next); current.current = next;
      accept(state); reset(next);
      if (state.error) setError(state.error);
    } catch (caught) { if (mounted.current && sequence === loadSequence.current) setError(caught instanceof Error ? caught.message : "Could not read autos."); }
    finally { if (mounted.current && sequence === loadSequence.current) setLoading(false); }
  }, [accept, reset]);

  useEffect(() => {
    mounted.current = true; void reload();
    return () => { mounted.current = false; };
  }, [reload]);

  const flush = useCallback(() => {
    const snapshot = current.current;
    const serialized = JSON.stringify(snapshot);
    const operation = queue.current.then(async () => {
      if (serialized === saved.current) return;
      const info = metadata.current;
      if (!info || info.error || !window.powerlib?.saveAutos) throw Error(info?.error ?? "Auto files are not available.");
      if (mounted.current) { setSaving(true); setError(""); }
      try {
        const state = await window.powerlib.saveAutos(snapshot, info.revision);
        saved.current = serialized;
        accept(state);
      } finally { if (mounted.current) setSaving(false); }
    });
    queue.current = operation.catch(() => {});
    return operation;
  }, [accept]);

  const report = useCallback((caught: unknown) => {
    if (mounted.current) setError(caught instanceof Error ? caught.message : "Could not save autos. Your draft has been kept.");
  }, []);

  const dirty = JSON.stringify(document) !== saved.current;
  useEffect(() => {
    if (!dirty || loading || files?.error || generating || history.gesturing) return;
    const timer = window.setTimeout(() => { void flush().catch(report); }, 600);
    return () => window.clearTimeout(timer);
  }, [document, dirty, loading, files?.error, generating, history.gesturing, flush, report]);

  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (JSON.stringify(current.current) !== saved.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  const project: AutoProject = { states: files?.states ?? [], driveCommandInstalled: files?.driveCommandInstalled ?? null,
    handWrittenNames: files?.handWrittenNames ?? [], checks: files?.checks ?? [], field };
  const issues = validateAutos(document, project);
  let code = "";
  if (!hasErrors(issues)) code = generateAutosJava(document, project);
  const generatedCurrent = !dirty && !!files?.robotAutosHooked && files.generatedSource === code;
  useEffect(() => { setMessage(""); }, [document]);

  async function generate() {
    if (generating || loading || files?.error || history.gesturing) return;
    setGenerating(true); setError(""); setMessage("");
    try {
      await flush();
      const info = metadata.current;
      if (!info || !window.powerlib?.generateAutos) throw Error("Java generation requires the Power Tool app.");
      const result = await window.powerlib.generateAutos(info.revision, info.sourceRevision, field);
      accept(result.state);
      setMessage("Saved");
    } catch (caught) { report(caught); }
    finally { if (mounted.current) setGenerating(false); }
  }

  return { document, setDocument, files, loading, saving, generating, dirty, error, message, project, issues,
    generatedCurrent, reload, save: generate, history,
    readOnly: loading || generating || !files || !!files.error };
}
