// Types shared by the Auto Builder's components and hooks. Model types live in autoModel.ts.
import type { DrivetrainConstants, StrainRange } from "./autoLimits";
import type { AutoDocument, BranchArm } from "./autoModel";

/** What Power Tool read from the robot project for the Auto Builder. */
export type AutoFiles = {
  loading: boolean;
  path: string;
  states: string[];
  driveCommandInstalled: boolean | null;
  robotAutosHooked: boolean | null;
  robotAutosStrings: string[];
  checks: string[];
  robot: { width: number; length: number };
  /** From TunerConstants, for the speed checks; null when the robot project doesn't have it. */
  drivetrain: DrivetrainConstants | null;
  /** From VisionConstants, for the tag view; null when the robot project doesn't have it. */
  vision: { basePositionStdDev: number; maxTagDistance: number; cameraNames: string[] } | null;
  error: string | null;
};

/** What `window.powerlib.readAutos()` returns. */
export type AutoFilesState = Awaited<ReturnType<NonNullable<Window["powerlib"]>["readAutos"]>>;

export type AutoMessage = { severity: "success" | "error" | "info" | "warning"; text: string };
export type Notify = (message: AutoMessage) => void;

/** `key` merges rapid edits of the same thing (a drag, typing in one field) into one undo step. */
export type ChangeDocument = (update: (document: AutoDocument) => AutoDocument, key?: string) => void;

export type SaveState = "saved" | "saving" | "error";
export type AutoView = "field" | "code";
/** How a click changes the step selection: replace it, toggle the steps, or add them. */
export type SelectMode = "replace" | "toggle" | "add";

export type FieldPoint = { x: number; y: number };
/** A robot on the field; `travel` is its direction of motion in degrees, for the wheels. */
export type FieldPose = { x: number; y: number; heading: number; travel?: number };
export type FieldSize = { length: number; width: number };
export type RobotSize = { width: number; length: number };

/** A field edit to one drive point; missing values stay as they are. */
export type PointChange = { stepId: string; x?: number; y?: number; heading?: number };
export type PointMove = { stepId: string; x: number; y: number };

/** One side of a branch, for adding steps into it. */
export type BranchSide = { branchId: string; arm: BranchArm };

/** The right-click menu for an auto in the list, at the pointer. */
export type AutoMenuAnchor = { id: string; x: number; y: number };

/** How the replay drives a leg; `robotExtraSeconds` is how much longer the robot's drivetrain needs, when it is known. */
export type LegReplayInfo = { seconds: number; exitSpeed: number; peakSpeed: number; robotExtraSeconds?: number; finished: boolean };

/** What the branch inspector shows and changes besides the step itself. */
export type BranchView = {
  /** StateMachine methods a branch can check. */
  checks: string[];
  /** When the replay reaches the branch, and the autonomous period. */
  reachedAt?: number;
  period: number;
  showing: BranchArm;
  onShow: (arm: BranchArm) => void;
  onAddTo: (arm: BranchArm, anchor: HTMLElement) => void;
};

/** How the robot's drivetrain compares with the ideal replay. */
export type RobotCheck = {
  /** What the drivetrain can do, such as "about 5.4 m/s and 6.7 m/s²". */
  summary: string;
  extraSeconds: number;
  robotDuration: number;
  strain: StrainRange[];
  /** Where the robot's files disagree or leave something out. */
  notes: string[];
};

/** The other side of a branch: from the point before it, through its points, to the point after the branch. */
export type GhostRoute = { from: FieldPoint | null; points: { stepId: string; x: number; y: number }[]; to: FieldPoint | null };

/**
 * What each camera covers at one moment: a wedge for its field of view, and a line to every tag it
 * can use there. The wedge is the raw field of view, so a tag inside it with no line is one the
 * field blocks, is too far, or is turned too far away.
 */
export type VisionOverlay = {
  cones: { id: string; name: string; color: string; x: number; y: number; yaw: number; hFov: number; range: number }[];
  lines: { key: string; color: string; from: FieldPoint; to: FieldPoint; title: string }[];
};
