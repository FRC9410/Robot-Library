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
    };
  }
}
