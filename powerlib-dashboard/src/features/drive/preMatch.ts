// Pre-match checks for the drive team: an auto is picked, it fits the alliance, the robot sits on
// the auto's first point, and robot code has the latest Auto Builder autos.
import type { AutoDocument, AutoProject, AutoRoutine, DriveStep } from "../autos/autoModel";
import { generateAutosJava, hasErrors, legEndHeading, mirroredAuto, normalizeHeading, routeSteps, validateAutos } from "../autos/autoModel";

export type PreMatchCheck = { id: "auto" | "alliance" | "start" | "code"; status: "ok" | "warning" | "info"; text: string };
export type StartPose = { x: number; y: number; heading: number };
/** Auto Builder autos, the project they generate for, and GeneratedAutos.java as it is now. */
export type PlannedAutos = { document: AutoDocument; project: AutoProject; generatedSource: string | null };

/** How close the robot must be to point 1 to count as placed there. */
export const startTolerance = { meters: 0.15, degrees: 5 };

/** Every auto the chooser can show from the Auto Builder, mirrored copies included, by name. */
function registeredAutos(planned: PlannedAutos) {
  return new Map(planned.document.autos.flatMap(auto => [auto, mirroredAuto(auto, planned.project.field)])
    .filter((auto): auto is AutoRoutine => auto !== null).map(auto => [auto.name.trim(), auto]));
}

/** Whether GeneratedAutos.java holds what Update Code would write now; null when there are no Auto Builder autos. */
export function codeCheck(planned: PlannedAutos | null): PreMatchCheck | null {
  if (!planned?.document.autos.length) return null;
  if (hasErrors(validateAutos(planned.document, planned.project))) {
    return { id: "code", status: "warning", text: "Auto Builder autos have problems, so robot code can't get the latest" };
  }
  if (planned.generatedSource === null) return { id: "code", status: "warning", text: "Auto Builder autos aren't in robot code yet (File → Update Code)" };
  const lines = (source: string) => source.replace(/\r\n/g, "\n").trimEnd();
  return lines(planned.generatedSource) === lines(generateAutosJava(planned.document, planned.project))
    ? { id: "code", status: "ok", text: "Robot code has the latest Auto Builder autos" }
    : { id: "code", status: "warning", text: "Auto Builder changed since the last Update Code" };
}

const distance = (meters: number) => meters < 1 ? `${Math.round(meters * 100)} cm` : `${meters.toFixed(2)} m`;

/**
 * Checks for the selected auto. `alliance` is DriveTelemetry's ("Red", "Blue" or "Unknown").
 * Returns the auto's first pose too, so the field can show where to place the robot.
 */
export function preMatchChecks({ selected, alliance, pose, planned, code }: {
  selected?: string;
  alliance?: string;
  pose?: { x: number; y: number; heading: number };
  planned: PlannedAutos | null;
  code: PreMatchCheck | null;
}): { checks: PreMatchCheck[]; start?: StartPose } {
  const checks: PreMatchCheck[] = [];
  const auto = planned && selected ? registeredAutos(planned).get(selected) : undefined;
  const first = auto ? routeSteps(auto.steps).find((step): step is DriveStep => step.type === "drive") : undefined;
  const start = first ? { x: first.x, y: first.y, heading: legEndHeading(first) } : undefined;
  const side = alliance === "Red" || alliance === "Blue" ? alliance : null;

  if (!selected || selected === "None") checks.push({ id: "auto", status: "warning", text: "No auto selected" });

  if (!side) checks.push({ id: "alliance", status: "warning", text: "Alliance not set yet; the auto list changes once it is" });
  else if (auto?.alliance && auto.alliance !== side) checks.push({ id: "alliance", status: "warning", text: `This is a ${auto.alliance} auto, but the robot is on ${side}` });
  else if (auto && !auto.alliance && start && planned && (start.x < planned.project.field.length / 2 ? "Blue" : "Red") !== side) {
    checks.push({ id: "alliance", status: "warning", text: `Point 1 is on the ${side === "Red" ? "Blue" : "Red"} side, but the robot is on ${side}` });
  } else checks.push({ id: "alliance", status: "ok", text: `${side} alliance` });

  if (start) {
    if (!pose) checks.push({ id: "start", status: "info", text: "No robot position yet to check against point 1" });
    else {
      const off = Math.hypot(pose.x - start.x, pose.y - start.y);
      const turned = Math.abs(normalizeHeading(pose.heading - start.heading));
      checks.push(off <= startTolerance.meters && turned <= startTolerance.degrees
        ? { id: "start", status: "ok", text: "On point 1" }
        : { id: "start", status: "warning", text: `${distance(off)} and ${Math.round(turned)}° from point 1` });
    }
  }
  if (code) checks.push(code);
  return { checks, start };
}
