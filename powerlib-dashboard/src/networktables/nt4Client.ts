import {
  NetworkTables,
  NetworkTablesPrefixTopic,
  NetworkTablesTopic,
  NetworkTablesTypeInfos
} from "ntcore-ts-client";
import type { NetworkTablesTypes, TypeString } from "ntcore-ts-client";

export type NtPrimitive = string | number | boolean;
export type NtValue = NetworkTablesTypes | null;
export type NtTopicType = "boolean" | "double" | "int" | "string";

export type NtTopicSnapshot = {
  name: string;
  type: TypeString | NtTopicType;
  value: NtValue;
  lastChangedTime?: number;
};

const typeInfoByType = {
  boolean: NetworkTablesTypeInfos.kBoolean,
  double: NetworkTablesTypeInfos.kDouble,
  int: NetworkTablesTypeInfos.kInteger,
  string: NetworkTablesTypeInfos.kString
} as const;

export class PowerLibNt4Client {
  private nt: NetworkTables | null = null;
  private topics = new Map<string, NetworkTablesTopic<NtPrimitive>>();
  private prefixTopics = new Map<string, NetworkTablesPrefixTopic>();
  private unsubscribers: Array<() => void> = [];

  connect(uri: string, port: number, onConnectionChange: (connected: boolean) => void) {
    this.disconnect();
    this.nt = NetworkTables.getInstanceByURI(uri, port);
    this.unsubscribers.push(this.nt.addRobotConnectionListener(onConnectionChange, true));
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
    await topic.publish();
    topic.setValue(value);
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
