import { useCallback, useEffect, useState } from "react";
import type { AutoRoutine, BranchArm, BranchChoices } from "./autoModel";
import { locateStep } from "./autoModel";

/** The side of each branch the field and replay follow; picking a step on the other side switches to it. */
export function useBranchChoices(auto: AutoRoutine | null, selectedStepId: string | null) {
  const [choices, setChoices] = useState<BranchChoices>({});
  const showArm = useCallback((branchId: string, arm: BranchArm) =>
    setChoices(current => (current[branchId] ?? "then") === arm ? current : { ...current, [branchId]: arm }), []);

  // A step picked on the side of a branch the field isn't showing switches the field to that side.
  useEffect(() => {
    const list = auto && selectedStepId ? locateStep(auto.steps, selectedStepId)?.list : null;
    if (list) showArm(list.branchId, list.arm);
  }, [auto, selectedStepId, showArm]);

  return { choices, showArm };
}
