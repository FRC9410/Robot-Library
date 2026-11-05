import type { Dispatch, SetStateAction } from "react";
import type { AutoDocument, AutoProject, AutoRoutine, BranchArm, BranchChoices } from "./autoModel";
import type { ChangeDocument, FieldSize, Notify } from "./types";

/** What the Auto Builder's editing actions read and change, rebuilt each render by the panel. */
export type EditorContext = {
  document: AutoDocument;
  change: ChangeDocument;
  /** The auto being edited, as saved. */
  auto: AutoRoutine | null;
  /** Its mirrored copy, when the auto has symmetry. */
  mirror: AutoRoutine | null;
  /** The field is showing the mirrored copy; field edits are flipped back onto the original. */
  viewingMirror: boolean;
  field: FieldSize;
  project: AutoProject;
  choices: BranchChoices;
  showArm: (branchId: string, arm: BranchArm) => void;
  selectedAutoId: string | null;
  selectAuto: (id: string | null) => void;
  selection: string[];
  selectedStepId: string | null;
  setSelection: Dispatch<SetStateAction<string[]>>;
  notify: Notify;
};
