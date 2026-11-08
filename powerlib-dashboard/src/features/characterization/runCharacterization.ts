import { phases, type Report, type Target, type Settings, type RobotStatus, type Diagnostic, type ControlMode } from "../../../electron/characterization/types";
import { characterizationError, describeRobot, robotStateKey, type RobotObservation } from "./characterizationDiagnostics";
import { characterizationControlMode } from "./characterizationModel";

export type CharacterizationApi = {
  start(data: { simulation: boolean; controlMode: ControlMode; host: string; targets: Target[]; settings: Settings }): Promise<Report>;
  collect(id: string, test: { id: string; targetId: string; phase: typeof phases[number]; file: string }): Promise<unknown>;
  diagnostic(id: string, entry: Omit<Diagnostic, "at">): Promise<void>;
  finish(id: string, outcome: Report["outcome"], error?: string): Promise<Report>;
  driver(id: string, action: "check" | "enable" | "disable"): Promise<void>;
};
export type RunAdapter = {
  api: CharacterizationApi;
  publish(name: string, type: "string" | "double", value: string | number): Promise<void>;
  observe(): RobotObservation;
  now(): number;
  sleep(ms: number): Promise<void>;
  uuid(): string;
};
class Cancelled extends Error {}

export async function runCharacterization(adapter: RunAdapter, targets: Target[], settings: Settings,
  signal: AbortSignal, progress: (text: string) => void): Promise<Report> {
  const initial = adapter.observe();
  if (!initial.connected || !initial.status || adapter.now() - initial.receivedAt > 1500)
    throw Error("Connect to current robot characterization data first.");
  const simulation = initial.status.simulation;
  const controlMode = characterizationControlMode(initial.status);
  if (!controlMode) throw Error("Rebuild and restart simulation with current PowerLib so it can report whether Driver Station controls enable/disable.");
  const internalControl = controlMode === "simulation";
  if (initial.status.enabled || initial.status.fms || initial.status.estop || (!internalControl && !initial.status.test))
    throw Error("Start disabled, in Driver Station Test mode, outside FMS, with E-stop cleared by the operator.");
  const report = await adapter.api.start({ simulation, controlMode, host: initial.host, targets, settings });
  const runStart = adapter.now(), base = "/PowerLib/Characterization/";
  let testId = "", targetId = "", phaseName = "", label = "sequence", stage = "starting", previousState = "";
  let heartbeat = 0, outcome: Report["outcome"] = "complete", error: string | undefined;
  let diagnosticWrites = Promise.resolve(), diagnosticError = "";
  const record = (event: string, message: string, observation = adapter.observe()) => {
    const entry: Omit<Diagnostic, "at"> = {
      elapsedMs: Math.round(adapter.now() - runStart), stage, event, message, testId, targetId, phase: phaseName,
      connected: observation.connected, host: observation.host,
      statusAgeMs: Math.max(0, Math.round(adapter.now() - observation.receivedAt)),
      robot: observation.status ? { ...observation.status } : null
    };
    // Disk writes never delay the enable lease or motor-stop cleanup.
    diagnosticWrites = diagnosticWrites.then(() => adapter.api.diagnostic(report.id, entry))
      .catch(caught => { diagnosticError = characterizationError(caught); });
  };
  const connected = () => {
    const observation = adapter.observe(), key = robotStateKey(observation.status);
    if (key !== previousState) {
      previousState = key;
      record("robot-status", describeRobot(observation, adapter.now()), observation);
    }
    if (!observation.connected || observation.host !== initial.host || adapter.now() - observation.receivedAt > 1500)
      throw Error(`Robot connection changed or became stale during ${stage}. ${describeRobot(observation, adapter.now())}`);
    if (observation.status && (observation.status.simulation !== simulation || characterizationControlMode(observation.status) !== controlMode))
      throw Error(`Robot runtime or enable/disable control mode changed during ${stage}; sequence stopped.`);
    return observation.status;
  };
  record("started", `Characterization started using ${internalControl ? "internal simulation" : "FRC Driver Station"} control; simulation=${simulation}.`);
  let lease = true, heartbeatFailed = false;
  const leaseLoop = (async () => {
    while (lease) {
      try {
        await adapter.publish(base + "heartbeat", "double", ++heartbeat);
        if (heartbeatFailed) record("heartbeat-restored", "Heartbeat publication resumed.");
        heartbeatFailed = false;
      } catch (caught) {
        if (!heartbeatFailed) record("heartbeat-error", `Heartbeat publication failed: ${String(caught)}`);
        heartbeatFailed = true;
      }
      await adapter.sleep(100);
    }
  })();
  const wait = async (expected: string, predicate: (status: RobotStatus) => boolean, ms: number, cleanup = false) => {
    stage = `waiting for ${expected}`;
    record("waiting", `Waiting up to ${ms / 1000}s for ${expected}; requested test id=${testId}.`);
    const start = adapter.now();
    while (adapter.now() - start < ms) {
      if (signal.aborted && !cleanup) throw new Cancelled(`Cancelled while ${stage}.`);
      const status = connected();
      if (status && predicate(status)) {
        record("acknowledged", `Received ${expected}.`);
        return status;
      }
      await adapter.sleep(50);
    }
    const message = `Timed out after ${(ms / 1000).toFixed(1)}s waiting for ${expected}. `
      + `Requested test id=${testId}. ${describeRobot(adapter.observe(), adapter.now())}`;
    record("timeout", message);
    throw Error(message);
  };
  const control = async (enabled: boolean, cleanup = false) => {
    stage = `${cleanup ? "cleanup: " : ""}${enabled ? "enabling" : "disabling"} ${label}`;
    record("control-request", `Requesting ${enabled ? "enable" : "disable"} through ${internalControl ? "simulationControl" : "FRC Driver Station"}.`);
    if (internalControl) await adapter.publish(base + "simulationControl", "string", `${testId}|${enabled ? "enable" : "disable"}|${adapter.uuid()}`);
    else await adapter.api.driver(report.id, enabled ? "enable" : "disable");
    record("control-sent", "Control request sent; robot acknowledgement is still required.");
  };
  try {
    if (!internalControl) {
      stage = "checking FRC Driver Station";
      record("driver-check", "Checking for the FRC Driver Station window.");
      await adapter.api.driver(report.id, "check");
    }
    for (const target of targets) for (const phase of phases) {
      if (signal.aborted) throw new Cancelled("Cancelled by operator.");
      const before = connected();
      if (!before || before.enabled) throw Error("Robot must acknowledge disabled before preparing the next test.");
      testId = adapter.uuid(); targetId = target.id; phaseName = phase;
      label = `${target.name} / ${phase.replaceAll("-", " ")}`;
      progress(label); stage = `preparing ${label}`;
      record("prepare-request", `Preparing ${label}: duration=${settings.duration}s, ramp=${settings.ramp}V/s, step=${settings.step}V.`);
      await adapter.publish(base + "request", "string", JSON.stringify({ id: testId, target: target.id, phase, ...settings }));
      await wait(`${label} to prepare`, status => status.id === testId && ["prepared", "failed", "cancelled"].includes(status.state), 5000);
      const prepared = connected()!;
      if (prepared.state !== "prepared") throw Error(prepared.error || "Robot rejected the test.");
      if (signal.aborted) throw new Cancelled("Cancelled before enable.");
      await control(true);
      await wait(`${label} to enable`, status => status.id === testId && (status.enabled || ["complete", "failed", "cancelled"].includes(status.state)), 3000);
      const completed = await wait(`${label} to complete`, status => {
        if (status.id !== testId) return false;
        if (["cancelled", "failed"].includes(status.state)) throw new Cancelled(status.error || "Robot stopped the test.");
        return status.state === "complete";
      }, settings.duration * 1000 + 10000);
      await control(false);
      await wait(`${label} to become disabled`, status => !status.enabled, 5000);
      stage = `collecting ${label}`; progress(`Collecting ${target.name}: ${phase}`);
      record("collect-started", `Collecting closed log: ${completed.file}`);
      await adapter.api.collect(report.id, { id: testId, targetId: target.id, phase, file: completed.file });
      record("collect-complete", "Log downloaded and converted to samples and CSV.");
      stage = `disabled gap after ${label}`;
      await adapter.sleep(settings.settle * 1000);
      if (signal.aborted) throw new Cancelled("Cancelled by operator.");
    }
  } catch (caught) {
    outcome = caught instanceof Cancelled || signal.aborted ? "cancelled" : "failed";
    const message = characterizationError(caught);
    error = message.startsWith("Timed out") ? message : `${stage}: ${message}`;
    record(outcome, error);
  } finally {
    if (testId) {
      // Neutralize robot outputs before a Windows focus/shortcut attempt can block.
      try {
        record("cancel-request", "Stopping and releasing the robot characterization command.");
        await adapter.publish(base + "request", "string", JSON.stringify({ id: testId, cancel: true }));
      } catch (caught) { record("cleanup-error", `Could not send cancel request: ${characterizationError(caught)}`); }
      try {
        await control(false, true);
        await wait("robot to become disabled during cleanup", status => !status.enabled, 3000, true);
      } catch (caught) {
        const shortcutError = characterizationError(caught), failedAt = adapter.now();
        let disabled = false;
        try {
          await wait("fresh disabled robot status after the shortcut failed", status => !status.enabled && adapter.observe().receivedAt >= failedAt, 1500, true);
          disabled = true;
        } catch { /* A shortcut failure is unresolved until fresh telemetry confirms disabled. */ }
        if (disabled) record("disabled-confirmed", `Robot confirmed Disabled after the shortcut failed: ${shortcutError}`);
        else {
          outcome = "failed";
          const message = `Disable was not acknowledged: ${shortcutError}`;
          error = (error ? error + " " : "") + message;
          record("cleanup-error", message);
        }
      }
    }
    lease = false;
    await leaseLoop;
  }
  stage = "analysis";
  record("analysis-started", `Sequence outcome=${outcome}; analyzing collected logs and saving the report.`);
  await diagnosticWrites;
  if (diagnosticError) error = (error ? error + " " : "") + `Some diagnostics could not be saved: ${diagnosticError}`;
  progress("Analyzing logs and saving results…");
  return adapter.api.finish(report.id, outcome, error);
}
