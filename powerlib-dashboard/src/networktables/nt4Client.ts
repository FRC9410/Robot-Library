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

export type NtPrimitive = string | number | boolean;
export type NtValue = NetworkTablesTypes | null;
export type NtTopicType = "boolean" | "double" | "int" | "string";

export type NtTopicSnapshot = {
  name: string;
  type: string;
  value: NtValue;
  lastChangedTime?: number;
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

export class PowerLibNt4Client {
  private nt: NetworkTables | null = null;
  private topics = new Map<string, NetworkTablesTopic<NtPrimitive>>();
  private prefixTopics = new Map<string, NetworkTablesPrefixTopic>();
  private unsubscribers: Array<() => void> = [];
  private connectionRevision = 0;
  private publicationRevisions = new WeakMap<NetworkTablesTopic<NtPrimitive>, number>();

  connect(uri: string, port: number, onConnectionChange: (connected: boolean) => void) {
    this.disconnect();
    ensureNt4ProtocolCompatibility();
    this.nt = NetworkTables.getInstanceByURI(uri, port);
    const socket = this.nt.client.messenger.socket;
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
      onConnectionChange(connected);
    }, true));
  }

  disconnect() {
    this.unsubscribers.forEach((unsubscribe) => unsubscribe());
    this.unsubscribers = [];
    this.topics.forEach((topic) => topic.unsubscribeAll());
    this.topics.clear();
    this.prefixTopics.forEach((topic) => topic.unsubscribeAll());
    this.prefixTopics.clear();
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
    });

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

    const topic =
      this.topics.get(name) ?? this.nt.createTopic<NtPrimitive>(name, typeInfoByType[type], value);
    this.topics.set(name, topic);
    // Publisher IDs belong to one server connection. A publication that used
    // the acknowledgement fallback below may not be republished by the client.
    if (topic.publisher && this.publicationRevisions.get(topic) !== this.connectionRevision) {
      topic.unpublish();
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

    topic.setValue(value);
    this.publicationRevisions.set(topic, this.connectionRevision);
  }

  watchPrefix(prefix: string, onValue: (snapshot: NtTopicSnapshot) => void) {
    if (!this.nt) {
      throw new Error("NetworkTables is not connected.");
    }

    if (this.prefixTopics.has(prefix)) {
      return;
    }

    const topic = this.nt.createPrefixTopic(prefix);
    this.prefixTopics.set(prefix, topic);

    topic.subscribe(
      (value, params) => {
        onValue({
          name: params.name,
          type: params.type,
          value,
          lastChangedTime: topic.lastChangedTime
        });
      },
      { all: true }
    );
  }
}
