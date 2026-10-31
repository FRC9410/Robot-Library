/** WPILib data log (.wpilog) v1.0 reader. Spec: allwpilib wpiutil/doc/datalog.adoc. */

export type Pose = { x: number; y: number; heading: number };
export type LogValue = boolean | number | string | number[] | boolean[] | string[] | Pose | null;

export type WpilogSignal = {
  name: string;
  type: string;
  metadata: string;
  /** Seconds, in the log's own clock. */
  times: number[];
  values: LogValue[];
};

export type WpilogFile = {
  extraHeader: string;
  signals: Map<string, WpilogSignal>;
  /** True when the file ended partway through a record, e.g. after a power loss. */
  truncated: boolean;
};

const utf8 = new TextDecoder("utf-8");
const skippedTypes = new Set(["raw", "rawBytes", "msgpack", "protobuf", "structschema"]);

export function parseWpilog(bytes: Uint8Array): WpilogFile {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 12 || utf8.decode(bytes.subarray(0, 6)) !== "WPILOG") {
    throw new Error("This isn't a .wpilog file (missing the WPILOG header).");
  }
  const major = view.getUint16(6, true) >> 8;
  if (major !== 1) throw new Error(`Unsupported .wpilog version ${major}.x; only 1.x is supported.`);
  const extraLength = view.getUint32(8, true);
  if (12 + extraLength > bytes.byteLength) throw new Error("The .wpilog header is truncated.");
  const extraHeader = utf8.decode(bytes.subarray(12, 12 + extraLength));

  const entries = new Map<number, WpilogSignal>();
  const signals = new Map<string, WpilogSignal>();
  const readUint = (offset: number, length: number) => {
    let value = 0;
    for (let index = length - 1; index >= 0; index -= 1) value = value * 256 + bytes[offset + index];
    return value;
  };

  let offset = 12 + extraLength;
  let truncated = false;
  while (offset < bytes.byteLength) {
    const header = bytes[offset];
    const idLength = (header & 0x3) + 1;
    const sizeLength = ((header >> 2) & 0x3) + 1;
    const timeLength = ((header >> 4) & 0x7) + 1;
    const headerLength = 1 + idLength + sizeLength + timeLength;
    if (offset + headerLength > bytes.byteLength) { truncated = true; break; }
    const id = readUint(offset + 1, idLength);
    const size = readUint(offset + 1 + idLength, sizeLength);
    const time = readUint(offset + 1 + idLength + sizeLength, timeLength) / 1e6;
    const start = offset + headerLength;
    if (start + size > bytes.byteLength) { truncated = true; break; }
    offset = start + size;

    if (id === 0) {
      readControl(view, bytes, start, size, entries, signals);
      continue;
    }
    const signal = entries.get(id);
    if (!signal || skippedTypes.has(signal.type)) continue;
    const value = decodeValue(signal.type, view, bytes, start, size);
    if (value === undefined) continue;
    signal.times.push(time);
    signal.values.push(value);
  }

  return { extraHeader, signals, truncated };
}

function readControl(view: DataView, bytes: Uint8Array, start: number, size: number,
  entries: Map<number, WpilogSignal>, signals: Map<string, WpilogSignal>) {
  if (size < 5) return;
  const kind = bytes[start];
  const entry = view.getUint32(start + 1, true);
  let cursor = start + 5;
  const end = start + size;
  const readString = () => {
    if (cursor + 4 > end) return null;
    const length = view.getUint32(cursor, true);
    if (cursor + 4 + length > end) return null;
    const text = utf8.decode(bytes.subarray(cursor + 4, cursor + 4 + length));
    cursor += 4 + length;
    return text;
  };
  if (kind === 0) {
    const name = readString();
    const type = readString();
    const metadata = readString();
    if (name === null || type === null) return;
    // An entry can be finished and started again under a new ID; keep one signal per name.
    let signal = signals.get(name);
    if (!signal || signal.type !== type) {
      signal = { name, type, metadata: metadata ?? "", times: [], values: [] };
      signals.set(name, signal);
    }
    entries.set(entry, signal);
  } else if (kind === 1) {
    entries.delete(entry);
  } else if (kind === 2) {
    const metadata = readString();
    const signal = entries.get(entry);
    if (signal && metadata !== null) signal.metadata = metadata;
  }
}

function decodeValue(type: string, view: DataView, bytes: Uint8Array, start: number, size: number): LogValue | undefined {
  switch (type) {
    case "boolean": return size >= 1 ? bytes[start] !== 0 : undefined;
    case "int64": return size >= 8 ? Number(view.getBigInt64(start, true)) : undefined;
    case "float": return size >= 4 ? view.getFloat32(start, true) : undefined;
    case "double": return size >= 8 ? view.getFloat64(start, true) : undefined;
    case "string":
    case "json": return utf8.decode(bytes.subarray(start, start + size));
    case "boolean[]": return Array.from(bytes.subarray(start, start + size), byte => byte !== 0);
    case "int64[]": return fixedArray(size, 8, index => Number(view.getBigInt64(start + index * 8, true)));
    case "float[]": return fixedArray(size, 4, index => view.getFloat32(start + index * 4, true));
    case "double[]": return fixedArray(size, 8, index => view.getFloat64(start + index * 8, true));
    case "string[]": return stringArray(view, bytes, start, size);
    case "struct:Pose2d":
      return size >= 24 ? { x: view.getFloat64(start, true), y: view.getFloat64(start + 8, true),
        heading: view.getFloat64(start + 16, true) } : undefined;
    default: return undefined;
  }
}

function fixedArray(size: number, width: number, read: (index: number) => number) {
  const values: number[] = [];
  for (let index = 0; index < Math.floor(size / width); index += 1) values.push(read(index));
  return values;
}

function stringArray(view: DataView, bytes: Uint8Array, start: number, size: number) {
  if (size < 4) return undefined;
  const count = view.getUint32(start, true);
  const values: string[] = [];
  let cursor = start + 4;
  for (let index = 0; index < count; index += 1) {
    if (cursor + 4 > start + size) return undefined;
    const length = view.getUint32(cursor, true);
    if (cursor + 4 + length > start + size) return undefined;
    values.push(utf8.decode(bytes.subarray(cursor + 4, cursor + 4 + length)));
    cursor += 4 + length;
  }
  return values;
}
