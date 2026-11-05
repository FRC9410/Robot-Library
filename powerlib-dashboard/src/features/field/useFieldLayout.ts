import { useSyncExternalStore } from "react";
import type { FieldLayout } from "./fieldLayouts";
import { fieldLayouts, getFieldLayoutId, subscribeFieldLayout } from "./fieldLayouts";

/** The field layout picked in View → Field Layout, or null for the plain grid. */
export function useFieldLayout(): FieldLayout | null {
  const id = useSyncExternalStore(subscribeFieldLayout, getFieldLayoutId);
  return fieldLayouts.find(candidate => candidate.id === id) ?? null;
}
