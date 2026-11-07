export type Span = { start: number; end: number };
export type JavaField = Span & { name: string; type: string; expression: Span; value: string; tunable: boolean; custom: boolean };
export type Replacement = Span & { text: string };
export const customStart = "// POWERLIB CUSTOM CONSTANTS START - DO NOT DELETE";
export const customEnd = "// POWERLIB CUSTOM CONSTANTS END - DO NOT DELETE";

/** Preserve offsets and line endings while hiding delimiters inside comments and literals. */
export function maskJava(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    value => value.replace(/[^\r\n]/g, " "));
}

export function closing(mask: string, opening: number) {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const stack: string[] = [];
  for (let index = opening; index < mask.length; index++) {
    const char = mask[index];
    if (pairs[char]) stack.push(pairs[char]);
    else if (")]}".includes(char)) {
      if (stack.pop() !== char) throw Error("Unbalanced Java delimiters. Repair the source before saving.");
      if (!stack.length) return index;
    }
  }
  throw Error("Incomplete Java expression. Repair the source before saving.");
}

export function validateJava(source: string) {
  const mask = maskJava(source);
  if (/^(?:<<<<<<<|=======|>>>>>>>)/m.test(mask)) throw Error("Resolve Java merge conflicts before saving.");
  if (/["']|\/\*|\*\//.test(mask)) throw Error("Java contains an unterminated string or comment.");
  for (let index = 0; index < mask.length; index++) {
    if ("([{".includes(mask[index])) index = closing(mask, index);
    else if (")]}".includes(mask[index])) throw Error("Unbalanced Java source.");
  }
}

export function javaFields(source: string): JavaField[] {
  const mask = maskJava(source);
  const customFrom = source.indexOf(customStart);
  const customTo = source.indexOf(customEnd);
  if ((customFrom >= 0) !== (customTo >= 0) || (customFrom >= 0 && customTo < customFrom)) throw Error("Invalid custom constants markers.");
  const pattern = /(?:(@(?:frc\.powerlib\.tuning\.)?TunableConstant)\s+)?\bpublic\s+static\s+(?:(?:final|volatile)\s+)?([\w.$<>?,\s\[\]]+?)\s+([A-Za-z_$][\w$]*)\s*=/g;
  const result: JavaField[] = [];
  for (let match; (match = pattern.exec(mask));) {
    let depth = 0;
    for (let index = 0; index < match.index; index++) depth += mask[index] === "{" ? 1 : mask[index] === "}" ? -1 : 0;
    if (depth !== 1) continue;
    let end = pattern.lastIndex;
    for (; end < mask.length && mask[end] !== ";"; end++) if ("([{".includes(mask[end])) end = closing(mask, end);
    if (end === mask.length) throw Error(`Missing semicolon for ${match[3]}.`);
    const raw = source.slice(pattern.lastIndex, end);
    const start = pattern.lastIndex + (raw.match(/^\s*/)?.[0].length ?? 0);
    const valueEnd = end - (raw.match(/\s*$/)?.[0].length ?? 0);
    result.push({ start: match.index, end: end + 1, name: match[3], type: match[2].trim(), expression: { start, end: valueEnd },
      value: source.slice(start, valueEnd), tunable: Boolean(match[1]), custom: customFrom >= 0 && match.index > customFrom && end < customTo });
    pattern.lastIndex = end + 1;
  }
  if (new Set(result.map(field => field.name)).size !== result.length) throw Error("Duplicate Java constant declarations.");
  return result;
}

export function splitExpressions(source: string, range: Span): Span[] {
  const mask = maskJava(source);
  const result: Span[] = [];
  let start = range.start;
  const add = (end: number) => {
    const raw = source.slice(start, end);
    if (stripComments(raw).trim()) result.push({ start: start + (raw.match(/^\s*/)?.[0].length ?? 0), end: end - (raw.match(/\s*$/)?.[0].length ?? 0) });
  };
  for (let index = start; index < range.end; index++) {
    if ("([{".includes(mask[index])) index = closing(mask, index);
    else if (mask[index] === ",") { add(index); start = index + 1; }
  }
  add(range.end);
  return result;
}

export function callExpression(source: string, range: Span) {
  const mask = maskJava(source);
  const text = mask.slice(range.start, range.end).trim();
  const match = /^(?:new\s+)?([\w.$]+)(?:\s*<[^>]*>)?\s*\(/.exec(text);
  if (!match) throw Error(`Unsupported Java expression: ${source.slice(range.start, range.end)}`);
  const open = range.start + mask.slice(range.start, range.end).indexOf("(");
  const end = closing(mask, open);
  if (mask.slice(end + 1, range.end).trim()) throw Error("Custom Java factory chains are read-only in this editor.");
  return { name: match[1], args: splitExpressions(source, { start: open + 1, end }) };
}

export function boundExpression(source: string, range: Span, seen = new Set<string>()): Span {
  const text = maskJava(source).slice(range.start, range.end).trim();
  if (/^[A-Za-z_$][\w$]*$/.test(text) && !["true", "false", "null"].includes(text)) {
    if (seen.has(text)) throw Error(`Cyclic constant reference ${text}.`);
    const field = javaFields(source).find(item => item.name === text);
    if (!field) throw Error(`Unresolved Java reference ${text}.`);
    return boundExpression(source, field.expression, new Set([...seen, text]));
  }
  return range;
}

export function literalValue(source: string, range: Span): string | number | boolean | null {
  const bound = boundExpression(source, range);
  const text = stripComments(source.slice(bound.start, bound.end)).trim();
  if (/^(true|false)$/.test(text)) return text === "true";
  if (/^(?:java\.util\.)?Optional\.empty\(\s*\)$/.test(text) || text === "null") return null;
  if (/^(?:java\.util\.)?Optional\.of\(/.test(text)) return literalValue(source, callExpression(source, bound).args[0]);
  if (/^[+-]?(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][+-]?[\d_]+)?[fFdDlL]?$/.test(text)) {
    const value = Number(text.replaceAll("_", "").replace(/[fFdDlL]$/, ""));
    if (Number.isFinite(value) && (!/[lL]$/.test(text) || Number.isSafeInteger(value))) return value;
  }
  if (/^"(?:\\.|[^"\\])*"$/.test(text)) {
    return JSON.parse(text.replace(/\\'/g, "'").replace(/\\([0-7]{1,3})/g, (_all, digits: string) => `\\u${parseInt(digits, 8).toString(16).padStart(4, "0")}`));
  }
  throw Error(`Expression is read-only: ${text}`);
}

export function stripComments(source: string) {
  return source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g,
    value => value.startsWith("//") || value.startsWith("/*") ? value.replace(/[^\r\n]/g, " ") : value);
}

export function replaceSpans(source: string, changes: Replacement[]) {
  const unique = new Map<string, Replacement>();
  for (const change of changes) {
    const key = `${change.start}:${change.end}`;
    if (unique.has(key) && unique.get(key)!.text !== change.text) throw Error("This edit changes a shared expression to conflicting values.");
    unique.set(key, change);
  }
  let boundary = source.length + 1;
  for (const change of [...unique.values()].sort((left, right) => right.start - left.start)) {
    if (change.end > boundary) throw Error("Overlapping Java edits; refresh before saving.");
    source = source.slice(0, change.start) + change.text + source.slice(change.end);
    boundary = change.start;
  }
  return source;
}

export function markerBlock(source: string, name: string, content: string) {
  const from = `// POWERLIB GENERATED ${name} START - DO NOT DELETE`;
  const to = `// POWERLIB GENERATED ${name} END - DO NOT DELETE`;
  const start = source.indexOf(from);
  const end = source.indexOf(to);
  if (start < 0 || end <= start || source.indexOf(from, start + 1) >= 0 || source.indexOf(to, end + 1) >= 0) throw Error(`Missing or ambiguous ${name} source markers. Repair the integration before editing structure.`);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  return source.slice(0, start + from.length) + newline + content.replace(/\r?\n/g, newline) + (content ? newline : "") + source.slice(end);
}
