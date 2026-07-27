import type { NtTopicSnapshot } from "../../networktables/nt4Client";

export type LimelightInfo = {
  tableName: string;
  webUiUrl: string;
  topicCount: number;
  keys: string[];
  lastChangedTime?: number;
};

const knownLimelightKeys = new Set([
  "tv",
  "tx",
  "ty",
  "ta",
  "tl",
  "cl",
  "hb",
  "heartbeat",
  "getpipe",
  "pipeline",
  "pipe",
  "tid",
  "json",
  "botpose",
  "botpose_wpiblue",
  "botpose_wpired",
  "camerapose_targetspace",
  "targetpose_cameraspace",
  "targetpose_robotspace",
  "botpose_targetspace",
  "txnc",
  "tync",
  "tcornxy"
]);

const primaryLimelightKeys = new Set(["tv", "tx", "ty", "ta", "getpipe", "pipeline", "botpose", "json"]);

function getTopicParts(topicName: string) {
  return topicName.split("/").filter(Boolean);
}

function isLikelyLimelightTable(tableName: string, keys: string[]) {
  const normalizedTableName = tableName.toLowerCase();
  const normalizedKeys = keys.map((key) => key.toLowerCase());
  const matchingKnownKeys = normalizedKeys.filter((key) => knownLimelightKeys.has(key));
  const matchingPrimaryKeys = normalizedKeys.filter((key) => primaryLimelightKeys.has(key));

  if (normalizedTableName.startsWith("limelight")) {
    return matchingKnownKeys.length > 0;
  }

  return matchingPrimaryKeys.length >= 3;
}

function toLimelightHostname(tableName: string) {
  const normalized = tableName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized || "limelight";
}

export function getLimelightWebUiUrl(tableName: string) {
  return `http://${toLimelightHostname(tableName)}.local:5801`;
}

export function detectLimelights(topics: NtTopicSnapshot[]) {
  const topicsByTable = new Map<string, NtTopicSnapshot[]>();

  topics.forEach((topic) => {
    const [tableName] = getTopicParts(topic.name);
    if (!tableName) {
      return;
    }

    const existing = topicsByTable.get(tableName) ?? [];
    existing.push(topic);
    topicsByTable.set(tableName, existing);
  });

  return Array.from(topicsByTable.entries())
    .map(([tableName, tableTopics]) => {
      const keys = Array.from(
        new Set(
          tableTopics
            .map((topic) => getTopicParts(topic.name)[1])
            .filter((key): key is string => Boolean(key))
        )
      ).sort((left, right) => left.localeCompare(right));

      return {
        tableName,
        webUiUrl: getLimelightWebUiUrl(tableName),
        topicCount: tableTopics.length,
        keys,
        lastChangedTime: tableTopics.reduce<number | undefined>((latest, topic) => {
          if (topic.lastChangedTime === undefined) {
            return latest;
          }

          return latest === undefined ? topic.lastChangedTime : Math.max(latest, topic.lastChangedTime);
        }, undefined)
      };
    })
    .filter((limelight) => isLikelyLimelightTable(limelight.tableName, limelight.keys))
    .sort((left, right) => left.tableName.localeCompare(right.tableName));
}
