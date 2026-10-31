import type { ConstantRow, ConstantsFile } from "../features/constants/types";
export {};

type AutoFilesState = {
  path: string;
  document: unknown;
  states: string[];
  driveCommandInstalled: boolean;
  robotAutosHooked: boolean | null;
  robotAutosStrings: string[];
  robot: { width: number; length: number };
  error?: string;
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
      readAutos: () => Promise<AutoFilesState>;
      saveAutos: (document: unknown) => Promise<AutoFilesState>;
      updateAutoCode: (document: unknown, javaSource: string) => Promise<{
        generatedPath: string;
        hookAdded: boolean;
        state: AutoFilesState;
      }>;
      updateInstallSection: (section: string) => Promise<{
        stdout: string;
        stderr: string;
      }>;
      updatePowerTool: () => Promise<{
        started: boolean;
      }>;
      onMenuConnectionSettings: (callback: () => void) => () => void;
      onMenuUpdateSubsystemCode: (callback: () => void) => () => void;
      onMenuUpdateInstallSection: (callback: (_event: unknown, section: string) => void) => () => void;
      onMenuUpdatePowerTool: (callback: () => void) => () => void;
      onMenuFieldLayout: (callback: (_event: unknown, id: string) => void) => () => void;
      setFieldLayoutMenu: (id: string) => void;
    };
  }
}
