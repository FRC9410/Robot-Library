import { useSyncExternalStore } from "react";
import type { FieldLayout } from "./fieldLayouts";
import { getFieldLayout, subscribeFieldLayout } from "./fieldLayouts";

/** The field layout picked in View → Field Layout, or null for the plain grid. */
export function useFieldLayout(): FieldLayout | null {
  return useSyncExternalStore(subscribeFieldLayout, getFieldLayout);
}
