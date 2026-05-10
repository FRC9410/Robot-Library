export {};

declare global {
  interface Window {
    powerlib?: {
      platform: NodeJS.Platform;
    };
  }
}
