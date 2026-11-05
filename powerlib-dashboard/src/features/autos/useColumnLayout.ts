import { useState } from "react";
import type { ColumnLayout } from "./autoColumns";
import { columnStorageKey, parseColumns } from "./autoColumns";

/** The Auto Builder's column sizes, remembered on this laptop once someone resizes them. */
export function useColumnLayout() {
  const [layout, setLayout] = useState<ColumnLayout>(() => {
    try {
      return parseColumns(localStorage.getItem(columnStorageKey), window.innerWidth);
    } catch {
      return parseColumns(null, window.innerWidth);
    }
  });
  const update = (next: ColumnLayout) => {
    setLayout(next);
    try { localStorage.setItem(columnStorageKey, JSON.stringify(next)); } catch { /* Sizes just won't persist. */ }
  };
  return [layout, update] as const;
}
