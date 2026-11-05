import { useEffect, useRef } from "react";
import type { RefObject } from "react";

/** How long the step list takes to make room for the inspector; matches --ab-ease in autoBuilder.css. */
const listResizeMilliseconds = 200;

/**
 * Smoothly scrolls the primary selected step into view in the step list, such as when it is
 * picked on the field. When a selection starts, the list first eases down to make room for the
 * inspector, so the scroll waits until it has.
 */
export function useKeepStepVisible(listRef: RefObject<HTMLElement | null>, stepId: string | undefined) {
  const hadSelection = useRef(stepId !== undefined);
  useEffect(() => {
    const opening = !hadSelection.current && stepId !== undefined;
    hadSelection.current = stepId !== undefined;
    if (stepId === undefined) return;
    const timer = window.setTimeout(() => {
      listRef.current?.querySelector(`[data-step-id="${CSS.escape(stepId)}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, opening ? listResizeMilliseconds : 0);
    return () => window.clearTimeout(timer);
  }, [listRef, stepId]);
}
