export type ConstantRow = {
  originalName: string | null;
  name: string;
  type: string;
  value: string;
  custom: boolean;
  tunable: boolean;
};

export const editableConstantTypes = ["String", "boolean", "int", "double"] as const;

export function normalizeConstantName(name: string) {
  return name.replace(/\s/g, "_").toUpperCase();
}

export function constantValueForEditor(row: ConstantRow) {
  if (row.type === "String" || row.type === "java.lang.String") {
    try { const value: unknown = JSON.parse(row.value); if (typeof value === "string") return value; } catch { /* Preserve expressions until edited. */ }
  }
  return isNumericConstantType(row.type) ? row.value.replace(/[fFLlDd]$/, "") : row.value;
}

export function constantValueFromEditor(value: string, type: string) {
  if (type === "String" || type === "java.lang.String") return JSON.stringify(value);
  if (type === "boolean" || type === "Boolean" || type === "java.lang.Boolean") {
    if (value !== "true" && value !== "false") throw new Error("Choose a boolean value.");
    return value;
  }
  if (isNumericConstantType(type)) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value.trim())) throw new Error("Enter a number.");
    return formatNumericConstantValue(Number(value), type);
  }
  return value;
}

export function isNumericConstantType(type: string) {
  return /^(?:byte|short|int|long|float|double|(?:java\.lang\.)?(?:Byte|Short|Integer|Long|Float|Double))$/.test(type.trim());
}

export function formatNumericConstantValue(value: number, type: string) {
  if (!Number.isFinite(value)) throw new Error("Tunable values must be finite numbers.");
  const normalized = type.trim().replace(/^java\.lang\./, "");
  const integerRange: Record<string, [number, number]> = {
    byte: [-128, 127], Byte: [-128, 127], short: [-32768, 32767], Short: [-32768, 32767],
    int: [-2147483648, 2147483647], Integer: [-2147483648, 2147483647],
    long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], Long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]
  };
  if (integerRange[normalized]) {
    const [min, max] = integerRange[normalized];
    if (!Number.isInteger(value) || value < min || value > max) throw new Error(`Value is outside the whole-number range for ${type}.`);
    return `${value}${normalized === "long" || normalized === "Long" ? "L" : ""}`;
  }
  if (normalized === "float" || normalized === "Float") {
    if (!Number.isFinite(Math.fround(value))) throw new Error("Value is outside the float range.");
    return `${Math.fround(value)}f`;
  }
  const literal = String(value);
  return Number.isInteger(value) && !/[eE]/.test(literal) ? `${literal}.0` : literal;
}

export type ConstantsFile = {
  id: string;
  name: string;
  kind: "subsystem" | "robot";
  path: string;
  exists: boolean;
  source: string;
  constants: ConstantRow[];
  error?: string;
};
