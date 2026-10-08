import { tuningUpdateIntervalMs } from "./telemetryTiming";

/** Retains this dashboard's switch intent through robot reconnects and checks the acknowledgement. */
export class TuningModeSync {
  desired: boolean | null = null;
  private connected = false;
  private generation = 0;
  private publishingGeneration: number | null = null;
  private resend = true;
  private nextCheck = 0;
  private lastError: string | null = null;

  constructor(private publish: (enabled: boolean) => Promise<void>, private reportError: (message: string) => void) {}

  request(enabled: boolean) {
    this.desired = enabled;
    this.resend = true;
  }

  connectionChanged(connected: boolean) {
    if (connected === this.connected) return;
    this.connected = connected;
    this.generation++;
    this.resend = true;
  }

  /** A different robot target gets its own switch state. */
  reset() {
    this.desired = null;
    this.generation++;
    this.resend = true;
    this.lastError = null;
  }

  async sync(now: number, requested: unknown, enabled: unknown) {
    // Tolerate timer jitter so a 200 ms interval cannot accidentally skip alternate checks.
    if (!this.connected || now + 1 < this.nextCheck || this.publishingGeneration === this.generation) return;
    this.nextCheck = now + tuningUpdateIntervalMs;
    if (this.desired === null) {
      this.desired = typeof requested === "boolean" ? requested : typeof enabled === "boolean" ? enabled : null;
    }
    const desired = this.desired;
    if (desired === null || (!this.resend && requested === desired && enabled === desired)) return;
    const generation = this.generation;
    this.publishingGeneration = generation;
    try {
      await this.publish(desired);
      if (generation === this.generation) {
        this.resend = this.desired !== desired;
        this.lastError = null;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (generation === this.generation && message !== this.lastError) {
        this.lastError = message;
        this.reportError(message);
      }
    } finally {
      if (this.publishingGeneration === generation) this.publishingGeneration = null;
    }
  }
}
