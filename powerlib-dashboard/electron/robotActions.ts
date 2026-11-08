import { execFile, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

export type RobotAction = "build" | "deploy" | "sim-ds" | "sim-no-ds";
export type RobotActionResult = { stdout: string; stderr: string; started?: boolean; logPath?: string };
const exec = promisify(execFile);
const busy = new Set<string>();
const simulations = new Map<string, ChildProcess>();
const actions = new Set<RobotAction>(["build", "deploy", "sim-ds", "sim-no-ds"]);

async function exists(file: string) { return fs.access(file).then(() => true, () => false); }

/** Use the project's WPILib JDK ahead of an unrelated system JAVA_HOME. */
export async function robotEnvironment(root: string) {
  const source = await fs.readFile(path.join(root, "build.gradle"), "utf8");
  const year = /GradleRIO[^\n]*version\s*["'](20\d{2})/.exec(source)?.[1];
  const base = process.platform === "win32" ? path.join(process.env.PUBLIC || "C:/Users/Public", "wpilib") : path.join(process.env.HOME || "", "wpilib");
  const years = year ? [year] : (await fs.readdir(base).catch(() => [])).filter(value => /^20\d{2}$/.test(value)).sort().reverse();
  const candidates = [...years.map(value => path.join(base, value, "jdk")), process.env.JAVA_HOME].filter((value): value is string => !!value);
  const java = process.platform === "win32" ? "java.exe" : "java";
  const javaHome = (await Promise.all(candidates.map(async home => await exists(path.join(home, "bin", java)) ? home : null))).find(Boolean);
  return { ...process.env, ...(javaHome ? { JAVA_HOME: javaHome, PATH: path.join(javaHome, "bin") + path.delimiter + (process.env.PATH || "") } : {}) };
}

async function gradle(root: string, tasks: string[], env: NodeJS.ProcessEnv) {
  // All tasks come from the fixed action list; no renderer text is interpolated into a shell.
  const args = ["--no-daemon", "--console=plain", ...tasks];
  try {
    return await exec(process.platform === "win32" ? "powershell.exe" : "./gradlew", process.platform === "win32"
      ? ["-NoProfile", "-NonInteractive", "-Command", `& './gradlew.bat' ${args.join(" ")}; exit $LASTEXITCODE`]
      : args, { cwd: root, env, windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
  } catch (caught) {
    const error = caught as Error & { stdout?: string; stderr?: string };
    throw Error([error.message, error.stdout, error.stderr].filter(Boolean).join("\n").slice(-24000));
  }
}

type SimulationInfo = { type: string; mainClassName: string; libraryDir: string; environment?: Record<string, string>;
  extensions: { name: string; libName: string; defaultEnabled: boolean }[] };

/** GradleRIO supplies the native library locations; select the DS socket explicitly per launch. */
export async function simulationLaunch(root: string, withDS: boolean, env: NodeJS.ProcessEnv) {
  const entries = JSON.parse(await fs.readFile(path.join(root, "build/sim/release_java.json"), "utf8")) as SimulationInfo[];
  const info = entries.find(entry => entry.type === "java");
  if (!info?.mainClassName || !info.libraryDir || !Array.isArray(info.extensions)) throw Error("GradleRIO did not produce a Java simulation launch configuration.");
  const ds = info.extensions.find(extension => /halsim_ds_socket(?:\.|$)/.test(path.basename(extension.libName)));
  const gui = info.extensions.find(extension => /halsim_gui(?:\.|$)/.test(path.basename(extension.libName)));
  if (!gui || (withDS && !ds)) throw Error("The robot project must include wpi.sim.addGui() and wpi.sim.addDriverstation() for these simulation actions.");
  const extensions = info.extensions.filter(extension => extension === gui || extension === ds ? extension === gui || withDS : extension.defaultEnabled);
  for (const extension of extensions) if (!await exists(extension.libName)) throw Error(`Simulation extension is missing: ${extension.name}.`);
  const jars = (await fs.readdir(path.join(root, "build/libs"))).filter(name => name.endsWith(".jar") && !/-(?:sources|javadoc)\.jar$/.test(name));
  if (jars.length !== 1) throw Error("Expected one robot application JAR in build/libs after building.");
  const java = env.JAVA_HOME ? path.join(env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "java";
  return { command: java, args: [`-Djava.library.path=${info.libraryDir}`, "-cp", path.join(root, "build/libs", jars[0]), info.mainClassName],
    env: { ...env, ...info.environment, HALSIM_EXTENSIONS: extensions.map(extension => extension.libName).join(path.delimiter),
      PATH: info.libraryDir + path.delimiter + (env.PATH || "") } };
}

export async function runRobotAction(root: string, action: unknown, onExit?: (message: string) => void): Promise<RobotActionResult> {
  if (!actions.has(action as RobotAction)) throw Error("Unknown robot action.");
  const key = path.resolve(root).toLowerCase();
  if (busy.has(key)) throw Error("A robot build or launch is already in progress.");
  const simulation = action === "sim-ds" || action === "sim-no-ds";
  if (simulation && simulations.has(key)) throw Error("Simulation is already running. Close its window before starting another simulation.");
  busy.add(key);
  try {
    const env = await robotEnvironment(root);
    const build = await gradle(root, simulation ? ["build", "simulateExternalJavaRelease"] : ["build"], env);
    if (action === "deploy") {
      const deploy = await gradle(root, ["deploy"], env);
      return { stdout: build.stdout + deploy.stdout, stderr: build.stderr + deploy.stderr };
    }
    if (!simulation) return build;
    const launch = await simulationLaunch(root, action === "sim-ds", env);
    const logPath = path.join(root, "build/power-tool/simulation.log");
    await fs.mkdir(path.dirname(logPath), { recursive: true });
    const log = fsSync.openSync(logPath, "w");
    let child: ChildProcess;
    try { child = spawn(launch.command, launch.args, { cwd: root, env: launch.env, windowsHide: true, detached: true, stdio: ["ignore", log, log] }); }
    finally { fsSync.closeSync(log); }
    simulations.set(key, child);
    const remove = () => { if (simulations.get(key) === child) simulations.delete(key); };
    child.once("exit", (code) => { remove(); if (code) onExit?.(`Simulation exited with code ${code}. See ${logPath}`); });
    child.once("error", remove);
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { cleanup(); resolve(); }, 1000);
      const failed = (error: Error) => { cleanup(); reject(error); };
      const exited = (code: number | null) => { cleanup(); reject(Error(`Simulation exited during startup (${code}). See ${logPath}`)); };
      function cleanup() { clearTimeout(timer); child.removeListener("error", failed); child.removeListener("exit", exited); }
      child.once("error", failed); child.once("exit", exited);
    });
    child.unref();
    return { ...build, started: true, logPath };
  } finally { busy.delete(key); }
}
