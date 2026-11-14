import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer, createConnection, type Server, type Socket } from "node:net";
import { promisify } from "node:util";

const execute = promisify(execFile);
const powershell = (script: string) => execute("powershell.exe", [
  "-NoProfile", "-NonInteractive", "-EncodedCommand", Buffer.from(script, "utf16le").toString("base64")
], { windowsHide: true });

const quote = (value: string) => "'" + value.replaceAll("'", "''") + "'";
const argument = "--characterization-restart=";
const startup = process.argv.find(value => value.startsWith(argument))?.slice(argument.length);
const handoff = startup?.match(/^(\d{1,5}):([a-f0-9-]{36})$/);
export const openCharacterizationOnStartup = process.platform === "win32" && !!handoff;
let access: Promise<boolean> | undefined;

export function hasCharacterizationAccess(): Promise<boolean> {
  if (process.platform !== "win32") return Promise.resolve(true);
  if (!access) {
    access = powershell([
      "$identity = [Security.Principal.WindowsIdentity]::GetCurrent()",
      "$principal = [Security.Principal.WindowsPrincipal]::new($identity)",
      "[Console]::WriteLine($principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator))"
    ].join("\n")).then(result => result.stdout.trim() === "True").catch(error => {
      access = undefined;
      throw error;
    });
  }
  return access;
}

export async function startElevatedCharacterization(executable: string, project: string, appPath?: string) {
  const token = randomUUID();
  const server: Server = createServer();
  const connections = new Set<Socket>();
  let signalReady: () => void = () => {};
  const ready = new Promise<void>(resolve => { signalReady = resolve; });
  server.on("connection", socket => {
    connections.add(socket);
    socket.on("error", () => {});
    socket.on("close", () => connections.delete(socket));
    socket.setTimeout(2000, () => socket.destroy());
    let message = "";
    socket.on("data", data => {
      message += data.toString("utf8");
      if (message === token) {
        socket.setTimeout(0);
        signalReady();
      } else if (!token.startsWith(message)) {
        socket.destroy();
      }
    });
  });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string") throw Error("Could not start the administrator restart.");
    const args = [appPath && '"' + appPath + '"', argument + address.port + ":" + token].filter(Boolean).join(" ");
    const result = await powershell([
      "$ErrorActionPreference = 'Stop'",
      "try {",
      "  Start-Process -FilePath " + quote(executable) + " -WorkingDirectory " + quote(project) +
        " -Verb RunAs -ArgumentList " + quote(args),
      "} catch {",
      "  if ($_.Exception.GetBaseException().NativeErrorCode -eq 1223) { [Console]::WriteLine('cancelled') } else { throw }",
      "}"
    ].join("\n"));
    if (result.stdout.trim() === "cancelled") return false;
    await Promise.race([ready, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(Error("The elevated Power Tool window did not start.")), 20000);
    })]);
    return true;
  } finally {
    clearTimeout(timer);
    // Stop accepting connections. The authenticated connection ends when the original app exits.
    server.close();
    for (const socket of connections) {
      if (socket.timeout) socket.destroy();
    }
  }
}

export function acknowledgeCharacterizationRestart(): Promise<void> {
  if (!openCharacterizationOnStartup || !handoff) return Promise.resolve();
  return new Promise(resolve => {
    const socket = createConnection({ port: Number(handoff[1]), host: "127.0.0.1" });
    socket.setTimeout(20000, () => socket.destroy());
    socket.once("connect", () => socket.write(handoff[2]));
    socket.once("error", () => socket.destroy());
    socket.once("close", resolve);
  });
}
