import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";

type RpcResponse = {
  id: number;
  result?: unknown;
  error?: { message: string };
};

type UpdateResult = {
  isError?: boolean;
  content?: { type: string; text?: string }[];
};

const protocolVersion = "2025-11-25";

export function startNt4McpServer(appPath: string, packaged: boolean) {
  const project = process.env.POWERLIB_NT4_PROJECT || path.resolve(appPath, "../../mcp-wpilib-nt4");
  if (!existsSync(path.join(project, "pyproject.toml"))) {
    console.warn("Power Tool NT4 MCP checkout is missing. Set POWERLIB_NT4_PROJECT to its folder.");
    return null;
  }

  const userUv = path.join(process.env.USERPROFILE ?? "", ".local", "bin", "uv.exe");
  const uv = process.platform === "win32" && existsSync(userUv) ? userUv : "uv";
  const script = packaged
    ? path.join(process.resourcesPath, "nt4Dashboard.py")
    : path.join(appPath, "electron", "nt4Dashboard.py");
  const child = spawn(uv, ["--directory", project, "run", "--locked", "--no-dev", "--python", "3.13", "python", "-u", script], {
    windowsHide: true,
    env: { ...process.env, NT4_TOOLSET: "core", NT4_READ_ONLY: "1", NT4_IDLE_SECONDS: "0" }
  });

  let closed = false;
  let nextId = 0;
  const pending = new Map<number, (response: RpcResponse) => void>();
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      const response = JSON.parse(line) as RpcResponse;
      pending.get(response.id)?.(response);
    } catch {
      console.warn("Power Tool NT4 MCP returned invalid stdio output.");
    }
  });
  child.stderr.on("data", (data) => process.stderr.write(data));

  function stop(message?: string) {
    if (closed) return;
    closed = true;
    if (message) console.warn(`Power Tool NT4 MCP: ${message}`);
    lines.close();
    child.stdin.end();
    for (const [id, complete] of pending) {
      complete({ id, error: { message: message ?? "Server stopped." } });
    }
    const timeout = setTimeout(() => child.kill(), 1000);
    timeout.unref();
    child.once("close", () => clearTimeout(timeout));
  }

  child.on("error", (error) => stop(error.message));
  child.stdin.on("error", (error) => stop(error.message));
  child.on("close", (code) => stop(`Server exited with code ${code}.`));

  function send(message: object) {
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", ...message }) + "\n");
  }

  function request(method: string, params: object, timeoutMs: number) {
    return new Promise<unknown>((resolve, reject) => {
      if (closed) {
        reject(new Error("NT4 MCP is unavailable."));
        return;
      }
      const id = ++nextId;
      const timer = setTimeout(() => stop(`Timed out waiting for ${method}.`), timeoutMs);
      pending.set(id, (response) => {
        clearTimeout(timer);
        pending.delete(id);
        if (response.error) reject(new Error(response.error.message));
        else resolve(response.result);
      });
      send({ id, method, params });
    });
  }

  // The stdio MCP handshake runs at app startup, independently of robot availability.
  const ready = request("initialize", {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: "Power Tool", version: "1" }
  }, 120_000).then((result) => {
    if ((result as { protocolVersion?: string } | undefined)?.protocolVersion !== protocolVersion) {
      throw new Error("Incompatible MCP protocol version.");
    }
    if (!closed) send({ method: "notifications/initialized" });
    return !closed;
  }).catch((error: Error) => {
    stop(error.message);
    return false;
  });

  let lastCall: Promise<unknown> = ready;
  function read(host: string | null, port: number, watches: Record<string, string[]>) {
    // The renderer can reload while a call is in flight. Serialize subscription
    // changes and drains so each call sees the complete state of the last one.
    const call = lastCall.then(async () => {
      if (closed || !(await ready)) return null;
      const result = await request("tools/call", {
        name: "powerlib_dashboard_updates",
        arguments: { host, port, watches }
      }, 5000) as UpdateResult;
      const text = result.content?.find((item) => item.type === "text")?.text;
      if (result.isError || !text) return null;
      return JSON.parse(text) as unknown;
    });
    lastCall = call.catch(() => null);
    return lastCall;
  }

  return { read, stop };
}
