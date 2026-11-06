import { useMemo } from "react";
import type { FieldLayout } from "../field/fieldLayouts";
import { fieldOccluders } from "../field/fieldObstacles";
import { collisionIssues } from "./autoCollisions";
import type { AutoDocument, AutoProject, AutoRoutine, BranchChoices } from "./autoModel";
import { createAuto, mirroredAuto, routeSteps, validateAutos } from "./autoModel";
import { drivetrainLimits, speedReport } from "./autoLimits";
import { replayAuto } from "./autoReplay";
import { branchGhosts, stepNumbering } from "./autoRoute";
import { stateColorFor } from "./autoView";
import type { VisionLimits } from "./autoVision";
import { defaultVisionLimits, routeVision } from "./autoVision";
import type { AutoFiles, FieldSize } from "./types";

type AnalysisInput = {
  document: AutoDocument;
  auto: AutoRoutine | null;
  files: AutoFiles;
  field: FieldSize;
  layout: FieldLayout | null;
  showMirror: boolean;
  showTags: boolean;
  choices: BranchChoices;
};

/**
 * Everything the Auto Builder works out from the autos: problems, the auto as the field shows it
 * (maybe mirrored, one side of each branch), its replay, speed checks and AprilTag coverage.
 */
export function useAutoAnalysis({ document, auto, files, field, layout, showMirror, showTags, choices }: AnalysisInput) {
  const project: AutoProject = useMemo(() => ({ states: files.states, driveCommandInstalled: files.driveCommandInstalled, field,
    handWrittenNames: files.robotAutosStrings, checks: files.checks }), [files.states, files.driveCommandInstalled, files.robotAutosStrings, files.checks, field]);
  const issues = useMemo(() => validateAutos(document, project), [document, project]);
  const mirror = useMemo(() => auto ? mirroredAuto(auto, field) : null, [auto, field]);
  const viewingMirror = showMirror && mirror !== null;
  const shownAuto = viewingMirror ? mirror : auto;
  // The field draws one run: each branch followed by the side picked for it.
  const routeAuto = useMemo(() => shownAuto ? { ...shownAuto, steps: routeSteps(shownAuto.steps, choices) } : null, [shownAuto, choices]);
  const ghosts = useMemo(() => routeAuto ? branchGhosts(routeAuto.steps, choices) : [], [routeAuto, choices]);
  const numbering = useMemo(() => stepNumbering(auto?.steps ?? []), [auto]);
  const replay = useMemo(() => replayAuto(shownAuto ?? createAuto(""), choices), [shownAuto, choices]);
  const durations = useMemo(() => new Map(replay.segments.map(segment => [segment.stepId, segment.end - segment.start])), [replay]);
  const autoDurations = useMemo(() => new Map(document.autos.map(candidate => [candidate.id, replayAuto(candidate).duration])), [document.autos]);
  // Speed checks: the same auto driven the way the robot's drivetrain can.
  const drivetrain = useMemo(() => files.drivetrain ? drivetrainLimits(files.drivetrain) : null, [files.drivetrain]);
  const speed = useMemo(() => drivetrain && shownAuto ? speedReport(shownAuto, choices, replay, drivetrain) : null, [drivetrain, shownAuto, choices, replay]);
  // Tag view: which AprilTags the cameras can use along the route, and how well the robot could place itself.
  const visionLimits: VisionLimits = useMemo(() => ({ ...defaultVisionLimits,
    ...(files.vision ? { basePositionStdDev: files.vision.basePositionStdDev, maxTagDistance: files.vision.maxTagDistance } : {}) }), [files.vision]);
  const occluders = useMemo(() => layout?.drawing ? fieldOccluders(layout.drawing) : [], [layout]);
  const vision = useMemo(() => showTags && layout && document.cameras.some(camera => camera.enabled)
    ? routeVision(replay, document.cameras, layout.tags, occluders, visionLimits) : null,
  [showTags, layout, document.cameras, replay, occluders, visionLimits]);
  // Collisions: the robot's bumpers against the field layout's solid elements along the replay.
  const collisions = useMemo(() => collisionIssues(replay, files.robot, occluders), [replay, files.robot, occluders]);
  const stateColor = useMemo(() => stateColorFor(files.states), [files.states]);
  // Speed and collision warnings come from the auto on the field, which may be the mirrored copy; its steps keep their ids.
  const autoIssues = auto ? [...issues.filter(issue => issue.autoId === auto.id),
    ...[...(speed?.issues ?? []), ...collisions].map(issue => ({ ...issue, autoId: auto.id }))] : [];

  return { project, issues, mirror, viewingMirror, shownAuto, routeAuto, ghosts, ...numbering, replay, durations, autoDurations, drivetrain, speed,
    visionLimits, vision, stateColor, autoIssues };
}

export type AutoAnalysis = ReturnType<typeof useAutoAnalysis>;
