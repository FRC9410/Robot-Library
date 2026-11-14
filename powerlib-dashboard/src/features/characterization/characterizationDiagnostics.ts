import type { RobotStatus } from "../../../electron/characterization/types";

export type RobotObservation = {
  connected: boolean;
  host: string;
  status: RobotStatus | null;
  receivedAt: number;
};

export function characterizationError(caught: unknown): string {
  const message = caught instanceof Error ? caught.message : String(caught);
  const readable = message.replace(/^Error invoking remote method '[^']+':\s*(?:Error:\s*)?/, "").replace(/^Error:\s*/, "");
  return readable.length > 2400 ? readable.slice(0, 2350) + "… (truncated)" : readable;
}

export function describeRobot(observation: RobotObservation, now: number): string {
  const status = observation.status;
  if (!status) return `No robot status received; connected=${observation.connected}, host=${observation.host}.`;
  return `Last robot status: state=${status.state}, enabled=${status.enabled}, Test=${status.test}, control=${status.controlMode ?? (status.simulation ? "unknown" : "driver-station")}, `
    + `DS attached=${status.dsAttached ?? "unknown"}, command scheduled=${status.commandScheduled ?? "unknown"}, `
    + `command started=${status.commandStarted ?? "unknown"}, FMS=${status.fms}, E-stop=${status.estop}, `
    + `robot test id=${status.id || "none"}, status age=${Math.max(0, Math.round(now - observation.receivedAt))}ms.`
    + (status.error ? ` Robot error: ${status.error}` : "");
}

/** Ignore the robot's timestamp and heartbeat age; retain meaningful state transitions. */
export function robotStateKey(status: RobotStatus | null): string {
  return JSON.stringify(status && [status.id, status.target, status.phase, status.state, status.enabled,
    status.test, status.error, status.file, status.fms, status.estop, status.dsAttached,
    status.commandScheduled, status.commandStarted, status.commandEnded, status.lastControl, status.controlMode]);
}
