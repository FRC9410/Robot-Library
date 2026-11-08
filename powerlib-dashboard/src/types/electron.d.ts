import type { ConstantRow, ConstantsFile } from "../features/constants/types";
import type { LogFileEntry } from "../features/logs/logLibraryModel";
import type { VisionConfig } from "../../electron/visionConfig";
import type { StateConfig } from "../../electron/stateConfig";
import type { LocalizationConfig } from "../../electron/localizationConfig";
import type { TunedSourceSave } from "../../electron/java-config/service";
import type { MigrationChange } from "../../electron/java-config/legacyMigration";
import type { TuningConnection, TuningSessionValue, TuningSessionFile } from "../../electron/tuningSession";
import type { UploadedField } from "../../electron/uploadedField";
import type { AutoFilesState } from "../../electron/autoFiles";
import type { AutoDocument } from "../../electron/autoModel";
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
      showAppMenu: (menuId: string, position: { x: number; y: number }) => Promise<void>;
      readConstants: () => Promise<ConstantsFile[]>;
      readAutos: () => Promise<AutoFilesState>;
      saveAutos: (document: AutoDocument, revision: string) => Promise<AutoFilesState>;
      generateAutos: (revision: string, sourceRevision: string, field: { length: number; width: number }) => Promise<{ generatedPath: string; hookAdded: boolean; state: AutoFilesState }>;
      readTuningSession: (connection: TuningConnection) => Promise<TuningSessionFile>;
      saveTuningSession: (connection: TuningConnection, values: TuningSessionValue[]) => Promise<TuningSessionFile>;
      readLegacyMigration: () => Promise<{ revision: string; files: string[]; changes: MigrationChange[] }>;
      applyLegacyMigration: (revision: string, selected: string[], confirmDeletes: boolean) => Promise<{ backup: string; changed: string[]; applied: number; archived: string[] }>;
      saveTunedSourceValues: (changes: TunedSourceSave) => Promise<{ subsystems: unknown[]; swerve: unknown; localization: LocalizationConfig | null; constants: ConstantsFile[] }>;
      readVisionConfig: () => Promise<{ path: string; vision: VisionConfig }>;
      readStateConfig: () => Promise<{ path: string; config: StateConfig; diagnostics?: string[]; repairable?: boolean }>;
      saveStateConfig: (config: StateConfig) => Promise<{ path: string; config: StateConfig; diagnostics?: string[]; repairable?: boolean }>;
      readLocalizationConfig: () => Promise<{ path: string; config: LocalizationConfig }>;
      saveLocalizationConfig: (config: LocalizationConfig) => Promise<{ path: string; config: LocalizationConfig }>;
      saveVisionConfig: (vision: VisionConfig) => Promise<{ path: string; vision: VisionConfig }>;
      saveConstants: (id: string, source: string, constants: ConstantRow[]) => Promise<ConstantsFile>;
      readSubsystems: () => Promise<{
        exists: boolean;
        path: string;
        subsystems: unknown[];
        swerve?: unknown;
        error?: string;
        swerveError?: string;
        revision?: string;
      }>;
      saveSubsystems: (subsystems: unknown[], swerve?: unknown, revision?: string, deleted?: string[]) => Promise<{
        exists: boolean;
        path: string;
        subsystems: unknown[];
        swerve?: unknown;
        revision?: string;
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
      onMenuToggleNetworkTables: (callback: () => void) => () => void;
      onMenuAutoShortcuts: (callback: () => void) => () => void;
      onMenuFieldLayout: (callback: (_event: unknown, id: string) => void) => () => void;
      setFieldLayoutMenu: (id: string, uploadedAvailable?: boolean) => void;
      readUploadedField: () => Promise<UploadedField | null>;
      saveUploadedField: (field: UploadedField) => Promise<UploadedField>;
      removeUploadedField: () => Promise<void>;
      onMenuUpdateSubsystemCode: (callback: () => void) => () => void;
      onMenuUpdateInstallSection: (callback: (_event: unknown, section: string) => void) => () => void;
      onMenuUpdatePowerTool: (callback: () => void) => () => void;
    };
  }
}
