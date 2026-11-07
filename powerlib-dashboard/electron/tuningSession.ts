export type TuningConnection = { targetId: string; host: string; port: number };
export type TuningSessionValue = { name: string; type: "boolean" | "double" | "int" | "string"; value: boolean | number | string };
export type TuningSessionFile = { path: string; values: TuningSessionValue[] };
export function normalizeTuningConnection(value: TuningConnection): TuningConnection {
  if (!value || typeof value.targetId !== "string" || !value.targetId.trim() || value.targetId.length > 256 || typeof value.host !== "string" || !value.host.trim() || value.host.length > 256
    || !Number.isInteger(value.port) || value.port < 1 || value.port > 65535) throw Error("Invalid tuning recovery connection.");
  return { targetId: value.targetId.trim(), host: value.host.trim().toLowerCase(), port: value.port };
}
export function isTuningSessionValue(value: unknown): value is TuningSessionValue {
  if (!value || typeof value !== "object") return false;
  const row = value as TuningSessionValue;
  if (typeof row.name !== "string" || row.name.length > 1024 || !/^\/PowerLib\/(?:Subsystems|Commands)\/[^/\r\n]+\/Variables\/[^\r\n]+$/.test(row.name)) return false;
  if (row.type === "boolean") return typeof row.value === "boolean";
  if (row.type === "string") return typeof row.value === "string" && row.value.length <= 65536;
  if (row.type === "double") return typeof row.value === "number" && Number.isFinite(row.value);
  return row.type === "int" && typeof row.value === "number" && Number.isSafeInteger(row.value);
}
