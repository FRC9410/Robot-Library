import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const dashboard = fileURLToPath(new URL("../", import.meta.url));
const repository = path.dirname(dashboard);
export async function configFixture(label) {
  const result = await build({ stdin: { contents: `export * from './electron/java-config/service.ts'; export * from './electron/constantsFiles.ts'; export * from './electron/java-config/project.ts';`, resolveDir: dashboard }, bundle: true, write: false, format: "esm", platform: "node" });
  const api = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].contents).toString("base64")}`);
  await fs.mkdir(path.join(repository, "build"), { recursive: true });
  const root = await fs.mkdtemp(path.join(repository, "build", label + "-"));
  const java = path.join(root, "src/main/java/frc/robot");
  await fs.cp(path.join(repository, "templates/replacements/src/main/java/frc/robot"), java, { recursive: true });
  return { api, root, file: relative => path.join(java, relative) };
}
