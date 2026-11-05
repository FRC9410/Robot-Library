import {
  NetworkTables,
  NetworkTablesPrefixTopic,
  NetworkTablesTopic,
  NetworkTablesTypeInfos,
  msgPackValueSchema,
  typeStringSchema
} from "ntcore-ts-client";
import type { NetworkTablesTypes } from "ntcore-ts-client";
import { z } from "zod";
import { telemetryUpdateIntervalMs, tuningUpdateIntervalMs } from "./telemetryTiming";

export type NtPrimitive = string | number | boolean;
export type NtValue = NetworkTablesTypes | null;
export type NtTopicType = "boolean" | "double" | "int" | "string";

export type NtTopicSnapshot = {
  name: string;
  type: string;
  value: NtValue;
  lastChangedTime?: number;
  receivedAt?: number;
};

const typeInfoByType = {
  boolean: NetworkTablesTypeInfos.kBoolean,
  double: NetworkTablesTypeInfos.kDouble,
  int: NetworkTablesTypeInfos.kInteger,
  string: NetworkTablesTypeInfos.kString
} as const;

const publishGraceMs = 250;

function ensureNt4ProtocolCompatibility() {
  // ntcore-ts-client 3.1.3 validates whole announcement batches against a closed
  // list of type names. NT4 also permits custom names (structs and schemas use raw
  // bytes). Extend its exported schema in place so one custom topic cannot hide
  // every scalar tunable in the same batch. Keep the original names in snapshots.
  if (!typeStringSchema.safeParse("struct:Pose2d").success) {
    typeStringSchema.options.push(z.string().min(1) as unknown as (typeof typeStringSchema.options)[number]);
  }
  // MessagePack decodes raw values as Uint8Array, but this client only accepts
  // ArrayBuffer. Normalize the bytes so raw values cannot abort a binary batch.
  if (!msgPackValueSchema.safeParse(new Uint8Array()).success) {
    const binaryValue = z.instanceof(Uint8Array).transform((bytes) => new Uint8Array(bytes).buffer);
    msgPackValueSchema.options.push(binaryValue as unknown as (typeof msgPackValueSchema.options)[number]);
  }
}

function isAnnounceTimeoutError(error: unknown) {
  return error instanceof Error && error.message.includes("was not announced within 3 seconds");
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForPublisher(topic: NetworkTablesTopic<NtPrimitive>, timeoutMs: number) {
  const startedAt = Date.now();
  while (!topic.publisher && Date.now() - startedAt < timeoutMs) {
    await delay(25);
  }

  return topic.publisher;
}

function unpublishTopic(topic: NetworkTablesTopic<NtPrimitive>) {
  if (!topic.publisher) return;
  if (topic.pubuid !== undefined) {
    topic.unpublish();
  } else {
    // A late announcement after a restart can leave a publisher flag without an ID.
    (topic as unknown as { _publisher: boolean })._publisher = false;
  }
}

export class PowerLibNt4Client {
  private nt: NetworkTables | null = null;
  private topics = new Map<string, NetworkTablesTopic<NtPrimitive>>();
  private prefixTopics = new Map<string, NetworkTablesPrefixTopic>();
  private unsubscribers: Array<() => void> = [];
  private connectionRevision = 0;
  private publicationRevisions = new WeakMap<NetworkTablesTopic<NtPrimitive>, number>();
  private ownedPublications = new Set<NetworkTablesTopic<NtPrimitive>>();
  private stoppedSocketGuard: (() => void) | null = null;

  connect(uri: string, port: number, onConnectionChange: (connected: boolean) => void) {
    this.disconnect();
    this.stoppedSocketGuard?.();
    this.stoppedSocketGuard = null;
    ensureNt4ProtocolCompatibility();
    this.nt = NetworkTables.getInstanceByURI(uri, port);
    const nt = this.nt;
    const socket = nt.client.messenger.socket;
    let awaitingSocketClose = socket.isClosing();
    const restart = () => {
      if (this.nt !== nt) return;
      awaitingSocketClose = false;
      // Closing can finish after a late publication acknowledgement. Clear stale
      // flags before the cached client's reinstantiate() tries to republish them.
      this.ownedPublications.forEach((topic) => {
        if (topic.pubuid === undefined) unpublishTopic(topic);
      });
      socket.startAutoConnect();
      nt.changeURI(uri, port);
    };
    if (awaitingSocketClose) {
      // Finish closing the previous session before reusing the cached client.
      // Otherwise its late close event can start a second reconnect loop.
      const closingSocket = socket.websocket;
      closingSocket.addEventListener("close", restart, { once: true });
      this.unsubscribers.push(() => closingSocket.removeEventListener("close", restart));
    } else if (socket.isClosed()) {
      restart();
    } else {
      socket.startAutoConnect();
    }
    let wasConnected = false;
    this.unsubscribers.push(this.nt.addRobotConnectionListener((connected) => {
      if (connected && !wasConnected) {
        wasConnected = true;
        this.connectionRevision += 1;
        // This client skips timestamp synchronization on NT4.1. Without it,
        // writes use the dashboard's clock and can lose to existing robot values.
        // Restart the client's RTT measurement for each connection because a
        // simulator restart can change the server's clock base.
        const clock = socket as unknown as { bestRtt: number; heartbeat: () => void };
        clock.bestRtt = -1;
        clock.heartbeat();
      }
      wasConnected = connected;
      // An initial notification while the handshake is pending is not a failure.
      if (connected || (!awaitingSocketClose && !socket.isConnecting())) onConnectionChange(connected);
    }, true));
  }

  disconnect() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.topics.forEach((topic) => {
      topic.unsubscribeAll();
      unpublishTopic(topic);
    });
    this.topics.clear();
    this.prefixTopics.forEach((topic) => topic.unsubscribeAll());
    this.prefixTopics.clear();
    if (this.nt) {
      const socket = this.nt.client.messenger.socket;
      socket.stopAutoConnect();
      this.stoppedSocketGuard?.();
      // The dependency cannot cancel a retry already queued before Disconnect.
      // Close that socket immediately if it finishes opening while paused.
      this.stoppedSocketGuard = socket.addConnectionListener((connected) => {
        if (connected) socket.close();
      });
      socket.close();
    }
    this.nt = null;
  }

  subscribe(
    name: string,
    type: NtTopicType,
    defaultValue: NtPrimitive,
    onValue: (snapshot: NtTopicSnapshot) => void
  ) {
    if (!this.nt) {
      throw new Error("NetworkTables is not connected.");
    }

    const topic = this.nt.createTopic<NtPrimitive>(name, typeInfoByType[type], defaultValue);
    this.topics.set(name, topic);

    topic.subscribe((value) => {
      onValue({
        name,
        type,
        value,
        lastChangedTime: topic.lastChangedTime
      });
    }, { all: false, periodic: (name.includes("/Variables/") || name.startsWith("/PowerLib/Tuning/")
      ? tuningUpdateIntervalMs : telemetryUpdateIntervalMs) / 1000 });

    onValue({
      name,
      type,
      value: topic.getValue(),
      lastChangedTime: topic.lastChangedTime
    });
  }

  async publish(name: string, type: NtTopicType, value: NtPrimitive) {
    if (!this.nt) {
      throw new Error("NetworkTables is not connected.");
    }
    const nt = this.nt;
    const connectionRevision = this.connectionRevision;

    const topic =
      this.topics.get(name) ?? this.nt.createTopic<NtPrimitive>(name, typeInfoByType[type], value);
    this.topics.set(name, topic);
    this.ownedPublications.add(topic);
    // Publisher IDs belong to one server connection. A publication that used
    // the acknowledgement fallback below may not be republished by the client.
    if (topic.publisher && this.publicationRevisions.get(topic) !== this.connectionRevision) {
      unpublishTopic(topic);
    }
    if (!topic.publisher) {
      let publishError: unknown = null;
      const publishPromise = topic.publish().catch((error: unknown) => {
        publishError = error;
      });
      await Promise.race([publishPromise, delay(publishGraceMs)]);

      if (publishError && !isAnnounceTimeoutError(publishError)) {
        throw publishError;
      }

      if (!topic.publisher && topic.pubuid !== undefined) {
        (topic as unknown as { _publisher: boolean })._publisher = true;
      }

      if (!topic.publisher) {
        await publishPromise;
      }

      if (!topic.publisher && publishError) {
        throw publishError;
      }
    }

    if (this.nt !== nt || this.connectionRevision !== connectionRevision) {
      throw new Error("NetworkTables connection changed before the value could be published.");
    }
    topic.setValue(value);
    this.publicationRevisions.set(topic, this.connectionRevision);
  }

  watchPrefix(prefix: string, onValue: (snapshot: NtTopicSnapshot) => void,
    updateIntervalMs = telemetryUpdateIntervalMs) {
    if (!this.nt) {
      throw new Error("NetworkTables is not connected.");
    }

    const topic = this.prefixTopics.get(prefix) ?? this.nt.client.getPrefixTopicFromName(prefix) ?? this.nt.createPrefixTopic(prefix);
    this.prefixTopics.set(prefix, topic);

    const id = topic.subscribe(
      (value, params) => {
        onValue({
          name: params.name,
          type: params.type,
          value,
          lastChangedTime: topic.lastChangedTime
        });
      },
      { all: false, periodic: updateIntervalMs / 1000 }
    );
    return () => {
      topic.unsubscribe(id);
      if (topic.subscribers.size === 0) this.prefixTopics.delete(prefix);
    };
  }

  isWatchedValue(name: string) {
    return [...this.prefixTopics.entries()].some(([prefix, topic]) => name.startsWith(prefix)
      && [...topic.subscribers.values()].some(subscriber => !subscriber.options.topicsonly));
  }

  /** Discover custom-named cameras through announcements without subscribing to all values. */
  watchCameraAnnouncements(onValue: (snapshot: NtTopicSnapshot) => void) {
    if (!this.nt) throw new Error("NetworkTables is not connected.");
    const nt = this.nt;
    const socket = nt.client.messenger.socket;
    const metadata = this.prefixTopics.get("/") ?? nt.client.getPrefixTopicFromName("/") ?? nt.createPrefixTopic("/");
    this.prefixTopics.set("/", metadata);
    metadata.subscribe(() => {}, { topicsonly: true });
    const keys = new Map<string, Set<string>>();
    const watched = new Set<string>();
    let attached: WebSocket | null = null;
    const receive = (event: MessageEvent) => {
      if (typeof event.data !== "string") return;
      try {
        const messages: unknown = JSON.parse(event.data);
        if (!Array.isArray(messages)) return;
        for (const message of messages) {
          if (message?.method !== "announce" || typeof message.params?.name !== "string") continue;
          const [, table, key] = message.params.name.split("/");
          if (!table || !key || table.startsWith("limelight")) continue;
          const known = keys.get(table) ?? new Set<string>();
          if (["tv", "tx", "ty", "ta", "getpipe", "pipeline", "botpose", "json"].includes(key)) known.add(key);
          keys.set(table, known);
          if (known.size >= 3 && !watched.has(table)) {
            watched.add(table);
            this.watchPrefix(`/${table}/`, onValue);
          }
        }
      } catch { /* Malformed metadata cannot affect live telemetry. */ }
    };
    const attach = () => {
      if (attached === socket.websocket) return;
      attached?.removeEventListener("message", receive);
      const current = socket.websocket;
      current.addEventListener("message", receive);
      attached = current;
    };
    attach();
    this.unsubscribers.push(nt.addRobotConnectionListener(connected => { if (connected) attach(); }));
    this.unsubscribers.push(() => attached?.removeEventListener("message", receive));
  }
}
