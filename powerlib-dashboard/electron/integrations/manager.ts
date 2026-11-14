import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { defaultValues, isMissing, launchOptions, readCatalog, validateInputs, valuesSchema } from "./catalog.js";
import type { Integration, IntegrationView, InputValues } from "./catalog.js";
import { installIntegration, isInstalled, migrateLegacyInstallation } from "./install.js";
import { McpHost } from "./mcpHost.js";
import { nt4BridgeRequest, wpilibNt4Key } from "./nt4Bridge.js";

const settingsSchema = z.object({
  enabled: z.record(z.string(), z.array(z.string())).default({}),
  inputs: z.record(z.string(), valuesSchema).default({}),
  endpoint: z.object({ port: z.number().int().min(1).max(65535), secret: z.string().regex(/^[a-f0-9]{48}$/) }).optional()
});
type Settings = z.infer<typeof settingsSchema>;

export class IntegrationManager {
  private readonly directory: string;
  private readonly settingsFile: string;
  private readonly loaded;
  private settings: Settings = { enabled: {}, inputs: {} };
  private pending: Promise<unknown> = Promise.resolve();
  private readonly installing = new Set<string>();
  private readonly errors = new Map<string, string>();
  private readonly shutdown = new AbortController();
  private host?: McpHost;

  constructor(private readonly root: string, bundledCatalog: string, private readonly wpilibBridgeScript?: string) {
    this.directory = path.join(root, "integrations");
    this.settingsFile = path.join(this.directory, "settings.json");
    this.loaded = this.load(bundledCatalog);
  }

  private async load(bundledCatalog: string) {
    const catalog = await readCatalog(this.directory, bundledCatalog);
    try { this.settings = settingsSchema.parse(JSON.parse(await fs.readFile(this.settingsFile, "utf8"))); }
    catch (error) { if (!isMissing(error)) throw error; }
    for (const integration of catalog.values()) {
      await migrateLegacyInstallation(path.join(this.directory, integration.installationDirectory));
    }
    return catalog;
  }

  private async save(next: Settings) {
    await fs.mkdir(this.directory, { recursive: true });
    const temporary = path.join(this.directory, `.settings-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify(next, null, 2) + "\n", { mode: 0o600 });
      await fs.rename(temporary, this.settingsFile);
      this.settings = next;
    } finally { await fs.rm(temporary, { force: true }); }
  }

  private change<T>(operation: () => Promise<T>) {
    const next = this.pending.then(() => {
      this.shutdown.signal.throwIfAborted();
      return operation();
    });
    this.pending = next.catch(() => {});
    return next;
  }

  private async integration(id: unknown) {
    const integration = typeof id === "string" ? (await this.loaded).get(id) : undefined;
    if (!integration) throw new Error("Unknown integration.");
    return integration;
  }

  private installed(integration: Integration) {
    return isInstalled(path.join(this.directory, integration.installationDirectory));
  }

  private values(integration: Integration) {
    const saved = Object.entries(this.settings.inputs[integration.config.id] ?? {}).filter(([key]) => Object.hasOwn(integration.config.inputs, key));
    return { ...defaultValues(integration, this.root), ...Object.fromEntries(saved) };
  }

  private async getHost() {
    if (this.host) return this.host;
    const previous = this.settings.endpoint;
    const secret = previous?.secret ?? randomBytes(24).toString("hex");
    const host = new McpHost(secret);
    try {
      const port = await host.listen(previous?.port ?? 0);
      if (!previous) await this.save({ ...this.settings, endpoint: { port, secret } });
      this.host = host;
      return host;
    } catch (error) {
      await host.close();
      throw error;
    }
  }

  private async start(integration: Integration, serverId: string) {
    const key = `${integration.config.id}/${serverId}`;
    const state = this.host?.status(key).state;
    if (state === "starting" || state === "running") return;
    this.errors.delete(key);
    try {
      const server = integration.config.servers[serverId];
      const values = this.values(integration);
      validateInputs(integration, values);
      const options = launchOptions(integration, server, values, this.root);
      if (key === wpilibNt4Key && this.wpilibBridgeScript) options.args.splice(-1, 1, "python", this.wpilibBridgeScript);
      for (const [name, value] of Object.entries(options.env)) {
        if (name === "WPILOG_DIR" || name === "JFR_DIR") await fs.mkdir(value, { recursive: true });
      }
      const host = await this.getHost();
      this.shutdown.signal.throwIfAborted();
      const uvEnvironment = Object.fromEntries(Object.entries(process.env).flatMap(([key, value]) =>
        key.startsWith("UV_") && value !== undefined ? [[key, value] as const] : []));
      host.start(key, { ...options, env: { ...uvEnvironment, ...options.env } });
    } catch (error) { this.errors.set(key, (error as Error).message); }
  }

  restore() {
    return this.change(async () => {
      for (const integration of (await this.loaded).values()) {
        const enabled = this.settings.enabled[integration.config.id] ?? [];
        if (!enabled.length || !await this.installed(integration)) continue;
        for (const serverId of new Set(enabled)) {
          if (Object.hasOwn(integration.config.servers, serverId)) await this.start(integration, serverId);
        }
      }
    });
  }

  async dashboardNt4(input: unknown) {
    const request = nt4BridgeRequest.parse(input);
    await this.loaded;
    if (request.action !== "release" && !this.settings.enabled["mcp-wpilib"]?.includes("wpilib-nt4")) {
      return { ready: false };
    }
    return this.host?.dashboardNt4(request) ?? { ready: false };
  }

  async list(): Promise<IntegrationView[]> {
    return Promise.all([...(await this.loaded).values()].map(async integration => {
      const { id, description, requirements, inputs, servers } = integration.config;
      const installed = await this.installed(integration);
      return {
        id, name: integration.name, description, requirements, installed, installing: this.installing.has(id), inputs, values: this.values(integration),
        servers: Object.entries(servers).map(([serverId, server]) => {
          const key = `${id}/${serverId}`;
          const error = this.errors.get(key);
          return {
            id: serverId, name: server.name, description: server.description,
            enabled: installed && (this.settings.enabled[id] ?? []).includes(serverId),
            ...(error ? { state: "error" as const, error } : this.host?.status(key) ?? { state: "stopped" as const })
          };
        })
      };
    }));
  }

  install(id: unknown) {
    return this.change(async () => {
      const integration = await this.integration(id);
      this.installing.add(integration.config.id);
      try {
        const directory = path.join(this.directory, integration.installationDirectory);
        if (await isInstalled(directory)) return;
        // Installing or reinstalling a package always leaves its servers unchecked.
        await this.save({ ...this.settings, enabled: { ...this.settings.enabled, [integration.config.id]: [] } });
        await installIntegration(integration, directory, this.shutdown.signal);
      } finally { this.installing.delete(integration.config.id); }
    });
  }

  uninstall(id: unknown, trash: (directory: string) => Promise<void>) {
    return this.change(async () => {
      const integration = await this.integration(id);
      const directory = path.join(this.directory, integration.installationDirectory);
      if (!await isInstalled(directory)) return;
      if (path.relative(directory, await fs.realpath(directory)) !== "") {
        throw new Error("The integration folder must be inside this robot project.");
      }
      await this.save({ ...this.settings, enabled: { ...this.settings.enabled, [integration.config.id]: [] } });
      await this.stopServers(integration.config.id, Object.keys(integration.config.servers));
      await trash(directory);
    });
  }

  private async stopServers(id: string, serverIds: string[]) {
    await Promise.all(serverIds.map(server => {
      const key = `${id}/${server}`;
      this.errors.delete(key);
      return this.host?.stop(key);
    }));
  }

  enable(id: unknown, serverId: unknown, enabled: unknown) {
    return this.change(async () => {
      const integration = await this.integration(id);
      const servers = integration.config.servers;
      if (typeof enabled !== "boolean" || (serverId !== null && (typeof serverId !== "string" || !Object.hasOwn(servers, serverId)))) {
        throw new Error("Unknown integration server.");
      }
      if (!await this.installed(integration)) throw new Error("Install this integration first.");
      const serverIds = serverId === null ? Object.keys(servers) : [serverId];
      const selected = new Set(serverId === null ? [] : this.settings.enabled[integration.config.id] ?? []);
      for (const server of serverIds) {
        if (enabled) selected.add(server); else selected.delete(server);
      }
      await this.save({ ...this.settings, enabled: { ...this.settings.enabled, [integration.config.id]: [...selected] } });
      if (enabled) {
        for (const server of serverIds) await this.start(integration, server);
      } else {
        await this.stopServers(integration.config.id, serverIds);
      }
    });
  }

  saveInputs(id: unknown, input: unknown) {
    return this.change(async () => {
      const integration = await this.integration(id);
      const values = valuesSchema.parse(input);
      validateInputs(integration, values);
      await this.save({ ...this.settings, inputs: { ...this.settings.inputs, [integration.config.id]: values } });
    });
  }

  async close() {
    this.shutdown.abort();
    await this.pending;
    await this.host?.close();
  }
}
