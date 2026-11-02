import type { ConstantRow, ConstantsFile } from "../features/constants/types";
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
