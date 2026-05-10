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
      updateSubsystemCode: () => Promise<{
        stdout: string;
        stderr: string;
      }>;
      updatePowerTool: () => Promise<{
        started: boolean;
      }>;
    };
  }
}
