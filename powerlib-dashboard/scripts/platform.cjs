// OS-specific paths for the check scripts, so they run on Windows, macOS and Linux.
// The app resolves the same WPILib locations itself in electron/robotActions.ts.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const isWindows = process.platform === "win32";

/** WPILib 2026 install: %PUBLIC%\wpilib\2026 on Windows, ~/wpilib/2026 elsewhere. */
function wpilibRoot() {
  if (process.env.POWERLIB_WPILIB_ROOT) return process.env.POWERLIB_WPILIB_ROOT;
  return isWindows
    ? path.join(process.env.PUBLIC || "C:/Users/Public", "wpilib", "2026")
    : path.join(os.homedir(), "wpilib", "2026");
}

function javaHome() {
  return process.env.POWERLIB_JAVA_HOME || path.join(wpilibRoot(), "jdk");
}

/** A JDK tool such as "javac", with ".exe" on Windows. */
function jdkTool(home, name) {
  return path.join(home, "bin", isWindows ? `${name}.exe` : name);
}

/** The Electron binary installed in node_modules. */
function electronBinary(dashboardRoot) {
  const dist = path.join(dashboardRoot, "node_modules", "electron", "dist");
  if (isWindows) return path.join(dist, "electron.exe");
  if (process.platform === "darwin") return path.join(dist, "Electron.app", "Contents", "MacOS", "Electron");
  return path.join(dist, "electron");
}

/**
 * Write a fake Gradle wrapper. The app runs gradlew.bat on Windows and ./gradlew elsewhere,
 * so a fixture needs both scripts doing the same thing.
 */
function writeFakeGradlew(directory, { bat, sh }) {
  fs.writeFileSync(path.join(directory, "gradlew.bat"), bat);
  fs.writeFileSync(path.join(directory, "gradlew"), sh, { mode: 0o755 });
}

module.exports = { isWindows, wpilibRoot, javaHome, jdkTool, electronBinary, writeFakeGradlew };
