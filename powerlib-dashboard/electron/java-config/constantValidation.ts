import { maskJava } from './source.js';
import type { ConstantRow } from '../constantsFiles.js';
type Declaration = ConstantRow;
const keywords = new Set("abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for goto if implements import instanceof int interface long native new package private protected public return short static strictfp super switch synchronized this throw throws transient try void volatile while true false null var record yield sealed permits".split(" "));
export function isNumericType(type: string) { return /^(?:byte|short|int|long|float|double|(?:java\.lang\.)?(?:Byte|Short|Integer|Long|Float|Double))$/.test(type.trim()); }
export function validateRow(row: ConstantRow, original?: Declaration) {
  if (!row || !/^[A-Za-z_$][\w$]*$/.test(row.name) || keywords.has(row.name)) throw new Error("Constant names must be valid Java identifiers.");
  if (typeof row.type !== "string" || !/^[A-Za-z_$][\w.$]*(?:\s*<\s*[\w.$?,<>\s]+>)?(?:\s*\[\])*\s*$/.test(row.type)) throw new Error(`Invalid Java type for ${row.name}.`);
  if (typeof row.value !== "string" || !row.value.trim()) throw new Error(`Enter a value for ${row.name}.`);
  if (typeof row.tunable !== "boolean") throw new Error(`Choose whether ${row.name} is tunable.`);
  if (row.tunable && !isNumericType(row.type)) throw new Error(`Only numeric constants can be tunable: ${row.name}.`);
  if (!original || row.type !== original.type || row.value !== original.value) {
    if (isNumericType(row.type)) {
      const literal = row.value.trim().replace(/[fFLlDd]$/, "");
      const number = Number(literal);
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(literal) || !Number.isFinite(number)) throw new Error(`${row.name} requires a finite number.`);
      const type = row.type.trim().replace(/^java\.lang\./, "");
      const ranges: Record<string, [number, number]> = { byte: [-128, 127], Byte: [-128, 127], short: [-32768, 32767], Short: [-32768, 32767], int: [-2147483648, 2147483647], Integer: [-2147483648, 2147483647], long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER], Long: [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER] };
      if (ranges[type] && (!Number.isInteger(number) || number < ranges[type][0] || number > ranges[type][1])) throw new Error(`${row.name} requires a whole number within the ${type} range.`);
      if ((type === "float" || type === "Float") && !Number.isFinite(Math.fround(number))) throw new Error(`${row.name} is outside the float range.`);
      if ((type === "long" || type === "Long") && !/[lL]$/.test(row.value.trim())) row.value = `${number}L`;
      if (type === "float" || type === "Float") row.value = `${Math.fround(number)}f`;
      if (type === "double" || type === "Double") {
        const literal = String(number);
        row.value = Number.isInteger(number) && !/[eE]/.test(literal) ? `${literal}.0` : literal;
      }
      if (["byte", "Byte", "short", "Short", "int", "Integer"].includes(type)) row.value = String(number);
    }
    if (["boolean", "Boolean", "java.lang.Boolean"].includes(row.type) && !/^(true|false)$/.test(row.value)) throw new Error(`${row.name} requires true or false.`);
    if (["String", "java.lang.String"].includes(row.type) && !/^"(?:\\(?:[btnfr"'\\]|u[0-9a-fA-F]{4})|[^"\\\r\n])*"$/.test(row.value)) throw new Error(`${row.name} requires a string value.`);
  }
  const masked = maskJava(row.value);
  if (/["']/.test(masked) || masked.includes("/*")) throw new Error(`Unterminated string or comment for ${row.name}.`);
  const stack: string[] = [];
  for (const char of masked) {
    if (char === ";") throw new Error(`${row.name} must contain a Java expression without a semicolon.`);
    if ("([{".includes(char)) stack.push(char);
    if (")]}".includes(char) && stack.pop() !== ({ ")": "(", "]": "[", "}": "{" } as Record<string, string>)[char]) throw new Error(`Unbalanced expression for ${row.name}.`);
  }
  if (stack.length) throw new Error(`Unbalanced expression for ${row.name}.`);
  // A trailing line comment would comment out the generated semicolon.
  const tokens = row.value.match(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*|"""[\s\S]*?"""|"(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'/g) ?? [];
  if (tokens.some((token) => token.startsWith("//") && row.value.endsWith(token))) throw new Error(`Remove the trailing line comment from ${row.name}.`);
}

