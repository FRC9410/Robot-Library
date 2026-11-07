import { useSyncExternalStore } from "react";
import { getDashboardSettings, subscribeDashboardSettings } from "./dashboardSettings";

export function useDashboardSettings() {
  return useSyncExternalStore(subscribeDashboardSettings, getDashboardSettings);
}
