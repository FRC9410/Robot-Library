import type { ConstantRow, ConstantsFile } from "../features/constants/types";
import type { VisionConfig } from "../../electron/visionConfig";
import type { StateConfig } from "../../electron/stateConfig";
import type { LocalizationConfig } from "../../electron/localizationConfig";
export {};

declare global {
  interface Window {
    powerlib?: {
      platform: NodeJS.Platform;
      showAppMenu: (menuId: string, position: { x: number; y: number }) => Promise<void>;
      readConstants: () => Promise<ConstantsFile[]>;
      readVisionConfig: () => Promise<{ path: string; vision: VisionConfig }>;
      readStateConfig: () => Promise<{ path: string; config: StateConfig }>;
      saveStateConfig: (config: StateConfig) => Promise<{ path: string; config: StateConfig }>;
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
      onMenuConnectionSettings: (callback: () => void) => () => void;
      onMenuToggleNetworkTables: (callback: () => void) => () => void;
      onMenuUpdateSubsystemCode: (callback: () => void) => () => void;
      onMenuUpdateInstallSection: (callback: (_event: unknown, section: string) => void) => () => void;
      onMenuUpdatePowerTool: (callback: () => void) => () => void;
    };
  }
}
