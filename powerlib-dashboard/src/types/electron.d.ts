import type { ConstantRow, ConstantsFile } from "../features/constants/types";
import type { LogFileEntry } from "../features/logs/logLibraryModel";
export {};

export type OpenedLog = {
  canceled: false;
  name: string;
  path: string;
  /** True when a .hoot file was converted to .wpilog through Owlet. */
  converted: boolean;
  /** One entry per log file: the chosen file, plus the other CAN buses' .hoot files from the same session. */
  files: { name: string; bytes: Uint8Array }[];
};

declare global {
  interface Window {
    powerlib?: {
      platform: NodeJS.Platform;
      readConstants: () => Promise<ConstantsFile[]>;
      saveConstants: (id: string, source: string, constants: ConstantRow[]) => Promise<ConstantsFile>;
      readSubsystems: () => Promise<{
        exists: boolean;
        path: string;
        subsystems: unknown[];
        swerve?: unknown;
        error?: string;
      }>;
      saveSubsystems: (subsystems: unknown[], swerve?: unknown) => Promise<{
        exists: boolean;
        path: string;
        subsystems: unknown[];
        swerve?: unknown;
      }>;
      updateSubsystemCode: () => Promise<{
        stdout: string;
        stderr: string;
      }>;
      updateInstallSection: (section: string) => Promise<{
        stdout: string;
        stderr: string;
      }>;
      updatePowerTool: () => Promise<{
        started: boolean;
      }>;
      openLog: () => Promise<OpenedLog | { canceled: true }>;
      openLogPath: (filePath: string) => Promise<OpenedLog>;
      /** Opens these files as one session, in this order (the roboRIO's first). */
      openLogFiles: (filePaths: string[]) => Promise<OpenedLog>;
      /** Documents\Power Tool\Logs, used until a folder is chosen. */
      defaultLogsFolder: () => Promise<string>;
      /** Every .hoot and .wpilog under `folder`; `folder` on each file is its subfolder, relative to `folder`. */
      listLogs: (folder: string) => Promise<{ folder: string; exists: boolean; files: LogFileEntry[] }>;
      chooseLogsFolder: () => Promise<string | null>;
      /** The robot address that answers on SSH (port 22), or null. */
      findRobot: () => Promise<string | null>;
      /** Every .hoot and .wpilog in the robot's log folders; `path` is on the robot. */
      listRobotLogs: () => Promise<{ host: string; username: string; files: LogFileEntry[] }>;
      /** Copies robot files into `localRoot`, each into its relative `localFolder`; returns them as local files. */
      downloadRobotLogs: (downloads: { remotePath: string; localFolder: string }[], localRoot: string) => Promise<LogFileEntry[]>;
      /** Deletes these log files from the robot (and a run's folder once it's empty). */
      deleteRobotLogs: (remotePaths: string[]) => Promise<{ deleted: string[]; failed: { path: string; error: string }[] }>;
      onRobotDownloadProgress:(callback: (_event: unknown, progress: { done: number; total: number; file: string }) => void) => () => void;
      /** Swerve drive and steer motor CAN IDs from the robot's TunerConstants.java; empty if not found. */
      readDriveMotorIds: () => Promise<number[]>;
      getPathForFile: (file: File) => string;
      onMenuConnectionSettings: (callback: () => void) => () => void;
      onMenuUpdateSubsystemCode: (callback: () => void) => () => void;
      onMenuUpdateInstallSection: (callback: (_event: unknown, section: string) => void) => () => void;
      onMenuUpdatePowerTool: (callback: () => void) => () => void;
    };
  }
}
