import { useSyncExternalStore } from "react";
import { getUploadedField, subscribeFieldLayout } from "./fieldLayouts";

export function useUploadedField() {
  return useSyncExternalStore(subscribeFieldLayout, getUploadedField);
}
