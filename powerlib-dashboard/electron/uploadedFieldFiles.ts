import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { maxFieldImageBytes, validateUploadedField } from "./uploadedField.js";

const filePath = (userData: string) => path.join(userData, "uploaded-field.json");
let pending: Promise<unknown> = Promise.resolve();

function serialize<T>(action: () => Promise<T>) {
  const result = pending.then(action);
  pending = result.catch(() => {});
  return result;
}

export async function readUploadedField(userData: string) {
  try {
    const filename = filePath(userData);
    if ((await fs.stat(filename)).size > maxFieldImageBytes * 1.4 + 4096) throw Error("Uploaded field file is too large.");
    return validateUploadedField(JSON.parse(await fs.readFile(filename, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw Error(`Could not load the uploaded field: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export function saveUploadedField(userData: string, value: unknown) {
  const field = validateUploadedField(value);
  return serialize(async () => {
    await fs.mkdir(userData, { recursive: true });
    const destination = filePath(userData);
    const temporary = `${destination}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporary, JSON.stringify(field) + "\n");
      await fs.rename(temporary, destination);
    } finally { await fs.rm(temporary, { force: true }); }
    return field;
  });
}

export function removeUploadedField(userData: string) {
  return serialize(() => fs.rm(filePath(userData), { force: true }));
}
