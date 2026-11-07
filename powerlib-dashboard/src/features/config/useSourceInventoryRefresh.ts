import { useEffect, useRef } from "react";

/** Re-read source on return from the IDE; editors keep their own drafts/revisions. */
export function useSourceInventoryRefresh(refresh: () => Promise<void>) {
  const latest = useRef(refresh);
  latest.current = refresh;
  useEffect(() => {
    const onFocus = () => { void latest.current(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);
}
