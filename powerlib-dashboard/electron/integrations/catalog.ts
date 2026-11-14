import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

const repository = "https://github.com/j0n5m1th/mcp-wpilib-nt4.git";
const id = z.string().regex(/^[a-z][a-z0-9-]*$/);
const entry = z.object({
  name: z.string().min(1),
  repository: z.enum([repository, "https://github.com/j0n5m1th/mcp-wpilib-nt4"]).transform(() => repository),
  revision: z.string().regex(/^[a-f0-9]{40}$/).optional(),
  definition: z.string().regex(/^[a-z][a-z0-9-]*\.json$/),
  installationDirectory: z.string().regex(/^(?:installed\/)?[a-z][a-z0-9-]*$/)
});
const inputValue = z.union([z.string(), z.number().int()]);
const input = z.object({
  label: z.string(), type: z.enum(["string", "integer", "directory"]), default: inputValue.optional(),
  required: z.boolean().optional(), minimum: z.number().int().optional(), maximum: z.number().int().optional()
});
const launcher = [z.literal("--directory"), z.literal("${integrationDir}"), z.literal("run"), z.literal("--locked"), z.literal("--no-dev")] as const;
const script = z.string().regex(/^mcp-[a-z0-9-]+$/);
const python = z.string().regex(/^3\.\d+$/);
const server = z.object({
  name: z.string(), description: z.string(), enabledByDefault: z.literal(false), transport: z.literal("stdio"),
  command: z.literal("uv"),
  args: z.union([z.tuple([...launcher, z.literal("--python"), python, script]), z.tuple([...launcher, script])]),
  env: z.record(z.string().regex(/^(?:NT4|WPILOG|SIM|VSCODE|JFR)_[A-Z0-9_]+$/), z.string())
});
const definition = z.object({
  schemaVersion: z.literal(1), id, name: z.string(), description: z.string(),
  requirements: z.object({ commands: z.array(z.string()), python: z.string().transform(value => value.replace(/^>=/, "")).pipe(python) }),
  inputs: z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]*$/), input), servers: z.record(id, server)
});
const catalog = z.object({ schemaVersion: z.literal(1), integrations: z.record(id, entry) });
export const valuesSchema = z.record(z.string(), inputValue);
export type InputValues = z.infer<typeof valuesSchema>;
export type IntegrationInput = z.infer<typeof input>;
export type Integration = z.infer<typeof entry> & { revision: string; config: z.infer<typeof definition> };
export type ServerDefinition = z.infer<typeof server>;
export type ServerStatus = { state: "stopped" | "starting" | "running" | "error"; error?: string; url?: string };
export type IntegrationView = {
  id: string; name: string; description: string; installed: boolean; installing: boolean;
  requirements: Integration["config"]["requirements"];
  inputs: Record<string, IntegrationInput>; values: InputValues;
  servers: Array<ServerStatus & { id: string; name: string; description: string; enabled: boolean }>;
};

async function readJson(file: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(file, "utf8"));
}

export function isMissing(error: unknown) {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

export async function readCatalog(projectDirectory: string, bundledDirectory: string) {
  let directory = projectDirectory;
  let mapping: unknown;
  try { mapping = await readJson(path.join(directory, "mapping.json")); }
  catch (error) {
    if (!isMissing(error)) throw error;
    directory = bundledDirectory;
    mapping = await readJson(path.join(directory, "mapping.json"));
  }
  const listed = Object.entries(catalog.parse(mapping).integrations);
  const bundled = listed.some(([, value]) => !value.revision)
    ? catalog.parse(await readJson(path.join(bundledDirectory, "mapping.json"))).integrations : {};
  const entries = await Promise.all(listed.map(async ([key, value]) => {
    const config = definition.parse(await readJson(path.join(directory, value.definition)));
    if (config.id !== key || (value.installationDirectory !== key && value.installationDirectory !== `installed/${key}`)) {
      throw new Error(`The integration ID and installation directory must match ${key}.`);
    }
    const revision = value.revision ?? bundled[key]?.revision;
    if (!revision) throw new Error(`Pin a source revision for ${key} in mapping.json.`);
    return { ...value, installationDirectory: key, revision, config };
  }));
  return new Map(entries.map(integration => [integration.config.id, integration]));
}

export function defaultValues(integration: Integration, projectRoot: string): InputValues {
  return Object.fromEntries(Object.entries(integration.config.inputs).flatMap(([key, field]) => {
    if (field.default === undefined) return [];
    const value = typeof field.default === "string" ? field.default.replaceAll("${robotProjectDir}", () => projectRoot) : field.default;
    return [[key, field.type === "directory" && typeof value === "string" ? path.normalize(value) : value]];
  }));
}

export function validateInputs(integration: Integration, values: InputValues) {
  for (const [key, value] of Object.entries(values)) {
    const field = integration.config.inputs[key];
    if (!field) throw new Error(`Unknown setting ${key}.`);
    if (field.type === "integer") {
      if (typeof value !== "number" || value < (field.minimum ?? -Infinity) || value > (field.maximum ?? Infinity)) {
        throw new Error(`${field.label} must be a whole number between ${field.minimum} and ${field.maximum}.`);
      }
    } else if (typeof value !== "string" || (field.type === "directory" && value && !path.isAbsolute(value))) {
      throw new Error(`Enter ${field.type === "directory" ? "an absolute path" : "text"} for ${field.label}.`);
    }
  }
}

export function launchOptions(integration: Integration, server: ServerDefinition, values: InputValues, projectRoot: string) {
  const integrationDir = path.join(projectRoot, "integrations", integration.installationDirectory);
  const variables = { ...values, integrationDir, robotProjectDir: projectRoot };
  const replace = (value: string) => value.replace(/\$\{([^}]+)\}/g, (_match, key: string) => {
    if (!Object.hasOwn(variables, key) || variables[key as keyof typeof variables] === "") {
      throw new Error(`Set ${integration.config.inputs[key]?.label ?? key} before enabling this server.`);
    }
    return String(variables[key as keyof typeof variables]);
  });
  const env = Object.fromEntries(Object.entries(server.env).map(([key, value]) => [key, replace(value)]));
  const args = server.args.map(replace);
  if (!args.includes("--python")) args.splice(-1, 0, "--python", integration.config.requirements.python);
  return { command: server.command, args, cwd: integrationDir, env };
}
