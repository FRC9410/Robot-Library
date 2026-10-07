import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const migrations = new Map<string, Promise<string>>();

export function generatedJsonPath(robotRoot: string, fileName: string): Promise<string> {
  const destination = path.join(robotRoot, "power-tool", "generated", fileName);
  const pending = migrations.get(destination);
  if (pending) return pending;
  const migration = (async () => {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    for (const directory of [robotRoot, path.join(robotRoot, "power-tool"), path.join(robotRoot, "powerlib-dashboard")]) {
      const legacy = path.join(directory, fileName);
      try {
        // Exclusive copy keeps the current configuration if both layouts exist.
        await fs.copyFile(legacy, destination, constants.COPYFILE_EXCL);
        await fs.unlink(legacy);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code === "EEXIST") {
          const archive = path.join(path.dirname(destination), "legacy");
          await fs.mkdir(archive, { recursive: true });
          await fs.rename(legacy, path.join(archive, `${path.parse(fileName).name}-${randomUUID()}.json`));
        } else if (code !== "ENOENT") throw error;
      }
    }
    return destination;
  })();
  migrations.set(destination, migration);
  void migration.finally(() => migrations.delete(destination)).catch(() => {});
  return migration;
}
