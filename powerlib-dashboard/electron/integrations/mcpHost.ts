import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { StdioServerParameters } from "@modelcontextprotocol/sdk/client/stdio.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema, CallToolResultSchema, GetPromptRequestSchema, GetPromptResultSchema,
  ListPromptsRequestSchema, ListPromptsResultSchema, ListResourcesRequestSchema, ListResourcesResultSchema,
  ListResourceTemplatesRequestSchema, ListResourceTemplatesResultSchema, ListToolsRequestSchema, ListToolsResultSchema,
  ReadResourceRequestSchema, ReadResourceResultSchema
} from "@modelcontextprotocol/sdk/types.js";
import type { ServerStatus } from "./catalog.js";

function proxyFor(client: Client) {
  const upstream = client.getServerCapabilities();
  const server = new Server(client.getServerVersion() ?? { name: "Power Tool integration", version: "1" }, {
    instructions: client.getInstructions(),
    capabilities: {
      ...(upstream?.tools ? { tools: {} } : {}),
      ...(upstream?.resources ? { resources: {} } : {}),
      ...(upstream?.prompts ? { prompts: {} } : {})
    }
  });
  if (upstream?.tools) {
    server.setRequestHandler(ListToolsRequestSchema, (request, { signal }) => client.request(request, ListToolsResultSchema, { signal }));
    server.setRequestHandler(CallToolRequestSchema, (request, { signal }) => client.request(request, CallToolResultSchema, { signal, timeout: 300_000 }));
  }
  if (upstream?.resources) {
    server.setRequestHandler(ListResourcesRequestSchema, (request, { signal }) => client.request(request, ListResourcesResultSchema, { signal }));
    server.setRequestHandler(ListResourceTemplatesRequestSchema, (request, { signal }) => client.request(request, ListResourceTemplatesResultSchema, { signal }));
    server.setRequestHandler(ReadResourceRequestSchema, (request, { signal }) => client.request(request, ReadResourceResultSchema, { signal }));
  }
  if (upstream?.prompts) {
    server.setRequestHandler(ListPromptsRequestSchema, (request, { signal }) => client.request(request, ListPromptsResultSchema, { signal }));
    server.setRequestHandler(GetPromptRequestSchema, (request, { signal }) => client.request(request, GetPromptResultSchema, { signal }));
  }
  return server;
}

type RunningServer = { client: Client; status: ServerStatus };

export class McpHost {
  private readonly servers = new Map<string, RunningServer>();
  private port = 0;
  private readonly http = createServer((request, response) => void this.handle(request, response));

  constructor(private readonly secret: string) {}

  async listen(port: number) {
    await new Promise<void>((resolve, reject) => {
      this.http.once("error", reject);
      this.http.listen(port, "127.0.0.1", () => {
        this.http.off("error", reject);
        resolve();
      });
    });
    this.port = (this.http.address() as { port: number }).port;
    return this.port;
  }

  status(key: string): ServerStatus {
    return this.servers.get(key)?.status ?? { state: "stopped" };
  }

  start(key: string, options: StdioServerParameters) {
    const client = new Client({ name: "Power Tool", version: "1" });
    const transport = new StdioClientTransport({ ...options, stderr: "pipe" });
    const running: RunningServer = { client, status: { state: "starting" } };
    this.servers.set(key, running);
    let stderr = "";
    transport.stderr?.on("data", data => { stderr = (stderr + String(data)).slice(-2000); });
    client.onclose = () => {
      if (this.servers.get(key) === running && running.status.state !== "error") {
        running.status = { state: "error", error: stderr.trim() || "The MCP server stopped unexpectedly." };
      }
    };
    void client.connect(transport, { timeout: 180_000 }).then(() => {
      if (this.servers.get(key) !== running) return;
      running.status = { state: "running", url: `http://127.0.0.1:${this.port}/mcp/${this.secret}/${key}` };
    }).catch(async (error: NodeJS.ErrnoException) => {
      if (this.servers.get(key) === running) {
        const message = error.code === "ENOENT" ? "Install uv and make sure it is on PATH, then reopen Power Tool." : error.message;
        running.status = { state: "error", error: stderr.trim() || message };
      }
      await client.close().catch(() => {});
    });
  }

  async stop(key: string) {
    const running = this.servers.get(key);
    this.servers.delete(key);
    await running?.client.close();
  }

  async close() {
    this.http.close();
    this.http.closeAllConnections();
    await Promise.allSettled([...this.servers.keys()].map(key => this.stop(key)));
  }

  private async handle(request: IncomingMessage, response: ServerResponse) {
    const prefix = `/mcp/${this.secret}/`;
    if (request.headers.host !== `127.0.0.1:${this.port}` || request.headers.origin || !request.url?.startsWith(prefix)) {
      response.writeHead(404).end();
      return;
    }
    const running = this.servers.get(request.url.slice(prefix.length));
    if (running?.status.state !== "running") {
      response.writeHead(404).end();
      return;
    }
    const server = proxyFor(running.client);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    response.once("close", () => void server.close().catch(() => {}));
    try {
      await server.connect(transport);
      await transport.handleRequest(request, response);
    } catch {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    }
  }
}
