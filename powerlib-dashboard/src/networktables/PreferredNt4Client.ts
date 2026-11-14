import type { Nt4BridgeReply, Nt4BridgeRequest } from "../../electron/integrations/nt4Bridge";
import { CameraTopicDiscovery } from "./CameraTopicDiscovery";
import { PowerLibNt4Client } from "./nt4Client";
import type { NtPrimitive, NtPublication, NtTopicSnapshot, NtTopicType, NtValue } from "./nt4Client";
import { defaultNt4Timing } from "./telemetryTiming";
import type { Nt4Timing } from "./telemetryTiming";

const cameraMetadataIntervalMs = 1000;
type Exchange = (request: Nt4BridgeRequest) => Promise<Nt4BridgeReply>;
type Receiver = (snapshot: NtTopicSnapshot) => void;
type PublicationListener = (publication: NtPublication) => void | Promise<void>;
type DirectClient = Pick<PowerLibNt4Client, "connect" | "disconnect" | "watchPrefix" | "watchCameraAnnouncements" | "publish" | "onPublished" | "isWatchedValue">;
type Watch = { prefix: string; intervalMs: number; receive: Receiver; stopDirect?: () => void };
type SharedConnection = {
  owner: string; readTimer?: number; reading: boolean; nextMetadata: number;
  discovery: CameraTopicDiscovery; cameraPrefixes: Set<string>;
};
type Connection = {
  host: string; port: number; timing: Nt4Timing; changed: (connected: boolean, switched?: boolean) => void;
  watches: Set<Watch>; camera?: Receiver; heartbeat?: number; probing: boolean;
  direct: boolean; shared?: SharedConnection; retryAfter: number;
};

/** Routes Power Tool traffic through the integration only while its shared connection is healthy. */
export class PreferredNt4Client {
  private connection?: Connection;
  private readonly publicationListeners = new Set<PublicationListener>();

  constructor(private readonly builtin: DirectClient = new PowerLibNt4Client(),
    private readonly bridge = (): Exchange | undefined => window.powerlib?.dashboardNt4) {
    this.builtin.onPublished(publication => this.notifyPublished(publication));
  }

  get source() { return this.connection?.shared ? "WPILib NT4" : "Built-in NT4"; }

  onPublished(listener: PublicationListener) {
    this.publicationListeners.add(listener);
    return () => { this.publicationListeners.delete(listener); };
  }

  private async notifyPublished(publication: NtPublication) {
    await Promise.allSettled([...this.publicationListeners].map(listener => Promise.resolve().then(() => listener(publication))));
  }

  connect(host: string, port: number, changed: Connection["changed"], timing = defaultNt4Timing) {
    this.disconnect();
    const connection: Connection = { host, port, timing, changed, watches: new Set(), probing: false, direct: false, retryAfter: 0 };
    this.connection = connection;
    if (!this.bridge()) {
      this.useBuiltin(connection);
      return;
    }
    connection.heartbeat = window.setInterval(() => void this.check(connection), timing.heartbeatIntervalMs);
    void this.check(connection);
  }

  disconnect() {
    const connection = this.connection;
    this.connection = undefined;
    if (!connection) return;
    window.clearInterval(connection.heartbeat);
    this.release(connection);
    if (connection.direct) this.builtin.disconnect();
  }

  watchPrefix(prefix: string, receive: Receiver, intervalMs?: number) {
    const connection = this.connection;
    if (!connection) throw new Error("NetworkTables is not connected.");
    const watch: Watch = { prefix, receive, intervalMs: intervalMs ?? connection.timing.updateIntervalMs };
    connection.watches.add(watch);
    if (connection.direct) this.watchBuiltin(connection, watch);
    return () => {
      connection.watches.delete(watch);
      watch.stopDirect?.();
    };
  }

  watchCameraAnnouncements(receive: Receiver) {
    const connection = this.connection;
    if (!connection) throw new Error("NetworkTables is not connected.");
    connection.camera = receive;
    if (connection.direct) this.watchBuiltinCameras(connection);
  }

  isWatchedValue(name: string) {
    const connection = this.connection;
    if (connection?.direct) return this.builtin.isWatchedValue(name);
    return !!connection && ([...connection.watches].some(watch => name.startsWith(watch.prefix))
      || [...connection.shared?.cameraPrefixes ?? []].some(prefix => name.startsWith(prefix)));
  }

  async publish(name: string, type: NtTopicType, value: NtPrimitive) {
    const connection = this.connection;
    if (connection?.direct) return this.builtin.publish(name, type, value);
    const shared = connection?.shared;
    const request = this.bridge();
    if (!connection || !shared || !request) throw new Error("NetworkTables is not connected.");
    const reply = await request({ action: "publish", owner: shared.owner, name, type, value } as Nt4BridgeRequest);
    if (!reply.ready || this.connection !== connection || connection.shared !== shared) {
      throw new Error("The WPILib connection changed while publishing.");
    }
    await this.notifyPublished({ name, type, value, host: connection.host, port: connection.port });
  }

  private watchBuiltin(connection: Connection, watch: Watch) {
    watch.stopDirect = this.builtin.watchPrefix(watch.prefix, snapshot => {
      if (this.connection === connection && connection.direct) watch.receive(snapshot);
    }, watch.intervalMs);
  }

  private watchBuiltinCameras(connection: Connection) {
    this.builtin.watchCameraAnnouncements(snapshot => {
      if (this.connection === connection && connection.direct) connection.camera?.(snapshot);
    }, connection.timing.updateIntervalMs);
  }

  private release(connection: Connection) {
    const shared = connection.shared;
    if (!shared) return;
    connection.shared = undefined;
    window.clearInterval(shared.readTimer);
    void this.bridge()?.({ action: "release", owner: shared.owner }).catch(() => {});
  }

  private useBuiltin(connection: Connection) {
    if (this.connection !== connection || connection.direct) return;
    const switched = !!connection.shared;
    this.release(connection);
    if (switched) {
      connection.retryAfter = Date.now() + connection.timing.heartbeatIntervalMs * 2;
      connection.changed(false, true);
    }
    connection.direct = true;
    this.builtin.connect(connection.host, connection.port, connected => {
      if (this.connection === connection && connection.direct) connection.changed(connected);
    });
    for (const watch of connection.watches) this.watchBuiltin(connection, watch);
    if (connection.camera) this.watchBuiltinCameras(connection);
  }

  private async check(connection: Connection) {
    if (connection.probing || this.connection !== connection || Date.now() < connection.retryAfter) return;
    connection.probing = true;
    try {
      const request = this.bridge();
      if (!request) { this.useBuiltin(connection); return; }
      const shared = connection.shared;
      if (shared) {
        const { ready } = await request({ action: "heartbeat", owner: shared.owner });
        if (!ready && connection.shared === shared) this.useBuiltin(connection);
        return;
      }
      const { host, port } = connection;
      if (!(await request({ action: "probe", host, port })).ready || this.connection !== connection) return;
      const owner = window.crypto.randomUUID();
      if (!(await request({ action: "attach", host, port, owner })).ready) return;
      if (this.connection !== connection) {
        void request({ action: "release", owner }).catch(() => {});
        return;
      }
      const switched = connection.direct;
      connection.direct = false;
      if (switched) {
        this.builtin.disconnect();
        for (const watch of connection.watches) watch.stopDirect = undefined;
      }
      const next: SharedConnection = { owner, reading: false, nextMetadata: 0, discovery: new CameraTopicDiscovery(), cameraPrefixes: new Set() };
      connection.shared = next;
      connection.changed(true, switched);
      next.readTimer = window.setInterval(() => void this.read(connection, next, request), connection.timing.updateIntervalMs);
      void this.read(connection, next, request);
    } catch {
      if (connection.shared) this.useBuiltin(connection);
    } finally {
      connection.probing = false;
      if (!connection.shared && !connection.direct && this.connection === connection) {
        try { this.useBuiltin(connection); }
        catch { connection.changed(false); }
      }
    }
  }

  private async read(connection: Connection, shared: SharedConnection, request: Exchange) {
    if (shared.reading || this.connection !== connection || connection.shared !== shared) return;
    shared.reading = true;
    try {
      const topicNames = !!connection.camera && Date.now() >= shared.nextMetadata;
      if (topicNames) shared.nextMetadata = Date.now() + cameraMetadataIntervalMs;
      const scopes = [...connection.watches].map(({ prefix, intervalMs }) => ({ prefix, intervalMs }));
      for (const prefix of shared.cameraPrefixes) scopes.push({ prefix, intervalMs: connection.timing.updateIntervalMs });
      const reply = await request({ action: "read", owner: shared.owner, topicNames, scopes });
      if (this.connection !== connection || connection.shared !== shared) return;
      if (!reply.ready) { this.useBuiltin(connection); return; }
      for (const name of reply.topicNames ?? []) {
        const prefix = shared.discovery.observe(name);
        if (prefix) shared.cameraPrefixes.add(prefix);
      }
      for (const { name, type, value, raw, lastChangedTime } of reply.updates ?? []) {
        const snapshot = { name, type, value: raw === undefined ? (value ?? null) as NtValue : Uint8Array.from(atob(raw), byte => byte.charCodeAt(0)).buffer, lastChangedTime };
        const receivers = new Set([...connection.watches].filter(watch => name.startsWith(watch.prefix)).map(watch => watch.receive));
        if (connection.camera && [...shared.cameraPrefixes].some(prefix => name.startsWith(prefix))) receivers.add(connection.camera);
        for (const receive of receivers) receive(snapshot);
      }
    } catch {
      if (connection.shared === shared) this.useBuiltin(connection);
    } finally { shared.reading = false; }
  }
}
