import { boundExpression, callExpression, javaFields, literalValue, replaceSpans, type Replacement, type Span } from "./source.js";

export class SourceValues {
  readonly fields;
  constructor(readonly source: string) { this.fields = javaFields(source); }
  field(name: string) {
    const field = this.fields.find(item => item.name === name);
    if (!field) throw Error(`Missing Java declaration ${name}.`);
    return field;
  }
  value(name: string) { return literalValue(this.source, this.field(name).expression); }
  number(name: string) {
    const value = this.value(name);
    if (typeof value !== "number") throw Error(`${name} must be a literal number or a recognized local reference.`);
    return value;
  }
  string(name: string) {
    const value = this.value(name);
    if (typeof value !== "string") throw Error(`${name} must be a Java string literal.`);
    return value;
  }
  boolean(name: string) {
    const value = this.value(name);
    if (typeof value !== "boolean") throw Error(`${name} must be a boolean literal.`);
    return value;
  }
  call(name: string) { return callExpression(this.source, boundExpression(this.source, this.field(name).expression)); }
}

export function javaLiteral(value: unknown, type = "double"): string {
  if (type === "boolean") { if (typeof value !== "boolean") throw Error("Expected a boolean value."); return String(value); }
  if (type === "String") { if (typeof value !== "string") throw Error("Expected a string value."); return JSON.stringify(value).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029"); }
  if (typeof value === "boolean" || typeof value === "object" && value !== null) throw Error("Expected a numeric value.");
  if (value === null || value === "" || value === undefined) {
    if (type.startsWith("Optional")) return "Optional.empty()";
    throw Error("A required Java value is missing.");
  }
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) throw Error("Java numeric defaults must be finite literal values.");
  if (type === "int" && (!Number.isInteger(number) || number < -2147483648 || number > 2147483647)) throw Error("Value must fit a Java int.");
  const literal = type === "int" ? String(number) : Number.isInteger(number) ? `${number}.0` : String(number);
  return type.startsWith("Optional") ? `Optional.of(${literal})` : literal;
}

export function patchValues(source: string, values: Record<string, { value: unknown; type?: string }>, addMissing = false) {
  const table = new SourceValues(source);
  const edits: Replacement[] = [];
  const additions: string[] = [];
  for (const [name, setting] of Object.entries(values)) {
    const field = table.fields.find(item => item.name === name);
    const text = javaLiteral(setting.value, setting.type ?? field?.type ?? "double");
    if (!field) {
      if (!addMissing) throw Error(`Missing ${name}; repair its configuration before saving.`);
      additions.push(`  public static final ${setting.type ?? "double"} ${name} = ${text};`);
      continue;
    }
    if (setting.type?.startsWith("Optional") || field.type.includes("Optional")) {
      if (table.value(name) !== setting.value) edits.push({ ...field.expression, text });
    } else {
      if (table.value(name) !== setting.value) edits.push({ ...field.expression, text });
    }
  }
  let result = replaceSpans(source, edits);
  if (additions.length) {
    const open = result.indexOf("{", result.indexOf("class "));
    if (open < 0) throw Error("Missing Java constants class.");
    result = result.slice(0, open + 1) + "\n" + additions.join("\n") + "\n" + result.slice(open + 1);
  }
  return result;
}

export function expressionText(source: string, range: Span) { return source.slice(range.start, range.end); }
