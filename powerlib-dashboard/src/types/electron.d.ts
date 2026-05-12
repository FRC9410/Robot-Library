export {};

declare global {
  interface Window {
    powerlib?: {
      platform: NodeJS.Platform;
      readSubsystems: () => Promise<{
        exists: boolean;
        path: string;
        subsystems: unknown[];
        error?: string;
      }>;
      saveSubsystems: (subsystems: unknown[]) => Promise<{
        exists: boolean;
        path: string;
        subsystems: unknown[];
      }>;
      readBindings: () => Promise<{
        exists: boolean;
        path: string;
        bindings: unknown[];
        error?: string;
      }>;
      saveBindings: (bindings: unknown[]) => Promise<{
        exists: boolean;
        path: string;
        bindings: unknown[];
      }>;
      readBindingConstants: () => Promise<{
        constants: unknown[];
        error?: string;
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
      onMenuUpdateSubsystemCode: (callback: () => void) => () => void;
      onMenuUpdateInstallSection: (callback: (_event: unknown, section: string) => void) => () => void;
      onMenuUpdatePowerTool: (callback: () => void) => () => void;
    };
  }
}
