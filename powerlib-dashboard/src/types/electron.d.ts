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
      readTuningSelection: () => Promise<{
        exists: boolean;
        path: string;
        selectedTopics: string[];
        monitorDrawerOpen: boolean;
        sidebarExpandedSection: "subsystem" | "command";
        error?: string;
      }>;
      saveTuningSelection: (selectedTopics: string[]) => Promise<{
        exists: boolean;
        path: string;
        selectedTopics: string[];
        monitorDrawerOpen: boolean;
        sidebarExpandedSection: "subsystem" | "command";
      }>;
      saveTuningMonitorDrawerOpen: (open: boolean) => Promise<{
        exists: boolean;
        path: string;
        selectedTopics: string[];
        monitorDrawerOpen: boolean;
        sidebarExpandedSection: "subsystem" | "command";
      }>;
      saveTuningSidebarExpandedSection: (section: "subsystem" | "command") => Promise<{
        exists: boolean;
        path: string;
        selectedTopics: string[];
        monitorDrawerOpen: boolean;
        sidebarExpandedSection: "subsystem" | "command";
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
