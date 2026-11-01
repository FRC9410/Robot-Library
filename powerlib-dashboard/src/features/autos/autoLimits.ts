// Speed sanity checks: what the drivetrain can physically do, worked out from TunerConstants (plus
// mass, wheel friction and motor type from PathPlanner's settings), and a replay that moves the way
// it can, so the Auto Builder can say where a plan asks for more than the robot has.
import type { AutoIssue, AutoRoutine, BranchChoices } from "./autoModel";
import { allSteps } from "./autoModel";
import type { Replay, RobotLimit, RobotModel } from "./autoReplay";
import { loopPeriodSeconds, replayAuto } from "./autoReplay";

type Vector = { x: number; y: number };

// Keep in sync with DrivetrainFiles in electron/autoFiles.ts, which reads these from the robot project.
export type DrivetrainConstants = {
  /** From TunerConstants, the code the robot runs; SI units. */
  speedAt12Volts: number;
  driveGearRatio: number;
  wheelRadius: number;
  slipCurrent: number;
  frictionVoltage: number;
  modules: Vector[];
  /** From PathPlanner's settings, the only place they appear; null when missing. */
  mass: number | null;
  wheelCOF: number | null;
  motor: string | null;
  /** PathPlanner's copy of the TunerConstants numbers, to point out where they disagree. */
  pathPlanner: { maxDriveSpeed: number | null; driveGearing: number | null; driveWheelRadius: number | null; modules: Vector[] | null } | null;
};

/** Typical battery voltage while driving hard in a match; the 12 V free speed is never reached. */
export const matchBatteryVolts = 11.5;
const gravity = 9.81;

/** Stall torque (N·m) and stall current (A) at 12 V, as in WPILib's DCMotor, by PathPlanner's driveMotorType. */
const motors: Record<string, { stallTorque: number; stallCurrent: number }> = {
  krakenx60: { stallTorque: 7.09, stallCurrent: 366 },
  krakenx60foc: { stallTorque: 9.37, stallCurrent: 483 },
  falcon500: { stallTorque: 4.69, stallCurrent: 257 },
  falcon500foc: { stallTorque: 5.84, stallCurrent: 304 },
  vortex: { stallTorque: 3.6, stallCurrent: 211 },
  neo: { stallTorque: 2.6, stallCurrent: 105 }
};

export type DrivetrainLimits = {
  /** Theoretical free speed at 12 V (kSpeedAt12Volts). */
  freeSpeed: number;
  /** Top speed with a match battery and drive friction. */
  topSpeed: number;
  /** Most acceleration from a standstill, or null when neither the motors and mass nor wheel friction are known. */
  maxAcceleration: number | null;
  /** Acceleration available while speeding up at a speed: it fades to zero at top speed as the motors run out of voltage. */
  accelerationAt: (speed: number) => number;
  /** Module positions from the robot's center, in meters. */
  modules: Vector[];
  /** Where the robot's files disagree or leave something out. */
  notes: string[];
};

const relativeDifference = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b));
const fixed = (value: number, digits = 1) => value.toFixed(digits);

export function drivetrainLimits(constants: DrivetrainConstants): DrivetrainLimits {
  const { speedAt12Volts, driveGearRatio, wheelRadius, slipCurrent, modules, mass, wheelCOF, motor, pathPlanner } = constants;
  const usableVolts = matchBatteryVolts - constants.frictionVoltage;
  const topSpeed = speedAt12Volts * usableVolts / 12;
  const motorSpec = motor ? motors[motor.toLowerCase()] : undefined;
  const grip = wheelCOF !== null ? wheelCOF * gravity : null;
  // Each wheel pushes with the motor's torque per amp through the gearing; CTRE limits drive stator current to the slip current.
  const newtonsPerAmp = motorSpec ? motorSpec.stallTorque / motorSpec.stallCurrent * driveGearRatio / wheelRadius : null;
  const resistance = motorSpec ? 12 / motorSpec.stallCurrent : null;
  const motorAcceleration = (speed: number) => {
    if (newtonsPerAmp === null || resistance === null || mass === null) return Number.POSITIVE_INFINITY;
    const backEmf = 12 * Math.max(0, speed) / speedAt12Volts;
    const current = Math.min(slipCurrent, Math.max(0, (usableVolts - backEmf) / resistance));
    return modules.length * newtonsPerAmp * current / mass;
  };
  const accelerationAt = (speed: number) => Math.min(grip ?? Number.POSITIVE_INFINITY, motorAcceleration(speed));
  const standstill = accelerationAt(0);

  const notes: string[] = [];
  if (mass === null) notes.push(grip === null
    ? "PathPlanner's settings have no robot mass or wheel friction, so acceleration isn't checked."
    : "PathPlanner's settings have no robot mass, so acceleration is only checked against wheel grip.");
  else if (!motorSpec) notes.push(`PathPlanner's settings ${motor ? `name an unknown drive motor ("${motor}")` : "don't name the drive motor"}, so acceleration is only checked against wheel grip.`);
  const slipAcceleration = motorAcceleration(0);
  if (grip !== null && Number.isFinite(slipAcceleration) && relativeDifference(grip, slipAcceleration) > 0.2) {
    notes.push(`Wheel grip disagrees: the ${fixed(slipCurrent, 0)} A slip current in TunerConstants means the wheels slip at about ${fixed(slipAcceleration)} m/s², `
      + `but PathPlanner's wheel friction of ${wheelCOF} means ${fixed(grip)} m/s². The checks use the lower one.`);
  }
  if (pathPlanner) {
    if (pathPlanner.driveGearing !== null && relativeDifference(pathPlanner.driveGearing, driveGearRatio) > 0.02) {
      notes.push(`Gearing is ${driveGearRatio}:1 in TunerConstants but ${pathPlanner.driveGearing}:1 in PathPlanner's settings.`);
    }
    if (pathPlanner.driveWheelRadius !== null && relativeDifference(pathPlanner.driveWheelRadius, wheelRadius) > 0.02) {
      notes.push(`Wheel radius is ${fixed(wheelRadius * 100, 2)} cm in TunerConstants but ${fixed(pathPlanner.driveWheelRadius * 100, 2)} cm in PathPlanner's settings.`);
    }
    if (pathPlanner.maxDriveSpeed !== null && relativeDifference(pathPlanner.maxDriveSpeed, speedAt12Volts) > 0.05) {
      notes.push(`Free speed is ${fixed(speedAt12Volts, 2)} m/s in TunerConstants but ${fixed(pathPlanner.maxDriveSpeed, 2)} m/s in PathPlanner's settings.`);
    }
    const other = pathPlanner.modules;
    if (other && other.length === modules.length && modules.some((module, index) => Math.hypot(module.x - other[index].x, module.y - other[index].y) > 0.01)) {
      const cm = (point: Vector) => `(${fixed(point.x * 100)}, ${fixed(point.y * 100)}) cm`;
      notes.push(`Module positions differ: the front left module is at ${cm(modules[0])} in TunerConstants but ${cm(other[0])} in PathPlanner's settings.`);
    }
  }
  return { freeSpeed: speedAt12Volts, topSpeed, maxAcceleration: Number.isFinite(standstill) ? standstill : null, accelerationAt, modules, notes };
}

/** One line on what the drivetrain can do, such as "about 5.4 m/s and 6.7 m/s²". */
export function describeLimits(limits: DrivetrainLimits) {
  return `about ${fixed(limits.topSpeed)} m/s${limits.maxAcceleration === null ? "" : ` and ${fixed(limits.maxAcceleration)} m/s²`}`;
}

const size = (v: Vector) => Math.hypot(v.x, v.y);
const scaled = (v: Vector, factor: number) => ({ x: v.x * factor, y: v.y * factor });

/** How the drivetrain follows a command: limited acceleration, a top speed, and wheel speed shared with turning. */
export function drivetrainModel(limits: DrivetrainLimits): RobotModel {
  return {
    follow(command, actual, heading, turnRate) {
      let limit: RobotLimit | null = null;
      // Speeding up runs out of voltage near top speed; slowing down is only limited by current and grip.
      let change = { x: command.x - actual.x, y: command.y - actual.y };
      const speedingUp = change.x * actual.x + change.y * actual.y > 0;
      const available = limits.accelerationAt(speedingUp ? size(actual) : 0);
      if (size(change) > available * loopPeriodSeconds + 1e-9) {
        change = scaled(change, available * loopPeriodSeconds / size(change));
        // Running out of voltage near top speed is a speed limit; current and grip limit acceleration.
        limit = available < limits.accelerationAt(0) - 1e-9 ? "speed" : "acceleration";
      }
      let velocity = { x: actual.x + change.x, y: actual.y + change.y };
      if (size(velocity) > limits.topSpeed) {
        velocity = scaled(velocity, limits.topSpeed / size(velocity));
        limit = "speed";
      }
      // Turning adds ω × r to every wheel. When a wheel would pass top speed, CTRE's swerve scales
      // the whole motion down, so the robot both drives and turns slower.
      const omega = turnRate * Math.PI / 180;
      const radians = heading * Math.PI / 180;
      const cos = Math.cos(radians), sin = Math.sin(radians);
      const fastestWheel = Math.max(...limits.modules.map(module => {
        const rx = module.x * cos - module.y * sin;
        const ry = module.x * sin + module.y * cos;
        return Math.hypot(velocity.x - omega * ry, velocity.y + omega * rx);
      }));
      let rate = turnRate;
      if (fastestWheel > limits.topSpeed + 1e-9) {
        const factor = limits.topSpeed / fastestWheel;
        velocity = scaled(velocity, factor);
        rate *= factor;
        limit = "turn";
      }
      return { velocity, turnRate: rate, limit };
    }
  };
}

/** A stretch of the ideal replay where the drivetrain falls behind, in the ideal replay's time. */
export type StrainRange = { stepId: string; limit: RobotLimit; start: number; end: number };

export type SpeedReport = {
  /** The auto as this drivetrain can drive it. */
  robot: Replay;
  /** How much longer the auto takes on this drivetrain than in the ideal replay. */
  extraSeconds: number;
  /** How much longer each step takes on this drivetrain, by step id. */
  extraByStep: Map<string, number>;
  strain: StrainRange[];
  /** Warnings for drive steps that ask for more than the drivetrain has. */
  issues: AutoIssue[];
};

/** A step has to lose at least this much time to the drivetrain before it gets a warning. */
const noticeableSeconds = 0.05;

export function speedReport(auto: AutoRoutine, choices: BranchChoices, ideal: Replay, limits: DrivetrainLimits): SpeedReport {
  const robot = replayAuto(auto, choices, drivetrainModel(limits));
  const idealSegments = new Map(ideal.segments.map(segment => [segment.stepId, segment]));
  const robotSegments = new Map(robot.segments.map(segment => [segment.stepIndex, segment]));
  const extraByStep = new Map(robot.segments.flatMap(segment => {
    const match = idealSegments.get(segment.stepId);
    return match ? [[segment.stepId, (segment.end - segment.start) - (match.end - match.start)] as const] : [];
  }));

  // Group held-back cycles into stretches, then place them on the ideal timeline in proportion within their step.
  const robotRanges: StrainRange[] = [];
  for (const frame of robot.frames) {
    const stepId = robotSegments.get(frame.stepIndex)?.stepId;
    if (!frame.limit || !stepId) continue;
    const last = robotRanges.at(-1);
    if (last && last.stepId === stepId && last.limit === frame.limit && frame.t - last.end < loopPeriodSeconds * 1.5) last.end = frame.t;
    else robotRanges.push({ stepId, limit: frame.limit, start: frame.t - loopPeriodSeconds, end: frame.t });
  }
  const strain = robotRanges.flatMap(range => {
    const from = robot.segments.find(segment => segment.stepId === range.stepId);
    const to = idealSegments.get(range.stepId);
    if (!from || !to) return [];
    const place = (t: number) => to.start + (t - from.start) / Math.max(from.end - from.start, 1e-9) * (to.end - to.start);
    return [{ ...range, start: place(range.start), end: place(range.end) }];
  });

  const issues: AutoIssue[] = [];
  const warn = (stepId: string, message: string) => issues.push({ autoId: auto.id, stepId, severity: "warning", message });
  for (const step of allSteps(auto.steps)) {
    if (step.type !== "drive") continue;
    const tooFast = step.maxVelocity > limits.freeSpeed + 1e-9;
    const tooHard = limits.maxAcceleration !== null && step.maxAcceleration > limits.maxAcceleration + 1e-9;
    if (tooFast) warn(step.id, `Max velocity ${step.maxVelocity} m/s is faster than this drivetrain can ever go (${fixed(limits.freeSpeed, 2)} m/s free speed in TunerConstants).`);
    if (tooHard) warn(step.id, `Max accel ${step.maxAcceleration} m/s² is more than this drivetrain can do (about ${fixed(limits.maxAcceleration ?? 0)} m/s²).`);
    // How the motion itself falls behind: the limit that held the robot back longest in this leg.
    const extra = extraByStep.get(step.id) ?? 0;
    if (extra < noticeableSeconds) continue;
    const heldBack = new Map<RobotLimit, number>();
    for (const range of strain) if (range.stepId === step.id) heldBack.set(range.limit, (heldBack.get(range.limit) ?? 0) + range.end - range.start);
    const main = [...heldBack.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const longer = `this leg takes about ${fixed(extra, 2)} s longer than the replay shows`;
    if (main === "speed" && !tooFast) warn(step.id, `With a match battery the robot tops out near ${fixed(limits.topSpeed)} m/s and gains speed slowly close to it, so ${longer}.`);
    if (main === "turn") warn(step.id, `Turning while driving this fast needs more than ${fixed(limits.topSpeed)} m/s at a wheel, so the robot slows down and ${longer}. Lower the max velocity or the max turn rate.`);
  }
  return { robot, extraSeconds: robot.duration - ideal.duration, extraByStep, strain, issues };
}
