/**
 * Which AprilTags each Limelight can see along an auto, and how well the robot could place itself
 * from them. The quality number is the standard deviation the robot's own pose estimator would use,
 * from LimelightVision.parseMeasurement:
 *
 *     stdDev = max(MIN_POSITION_STD_DEV, basePositionStdDev * averageTagDistance^2 / tagCount)
 *
 * so what this shows is what the robot would actually trust, not a made-up score. Keep it in sync
 * with frc/powerlib/vision/LimelightVision.java.
 */
import type { FieldTag } from "../field/fieldLayouts";
import type { Occluder } from "../field/fieldObstacles";
import { blocks } from "../field/fieldObstacles";
import type { CameraMount } from "./autoModel";
import type { Replay } from "./autoReplay";

/** The outer black square of an FRC 36h11 tag, 6.5 in. */
export const tagSizeMeters = 0.1651;
/** LimelightVision.MIN_POSITION_STD_DEV. */
export const minPositionStdDev = 0.001;

/** The robot's limits, read from VisionConstants, plus the two detection thresholds this model adds. */
export type VisionLimits = {
  basePositionStdDev: number;
  maxTagDistance: number;
  /** Past this angle between the tag's normal and the camera, the tag is too foreshortened to decode. */
  maxIncidenceDegrees: number;
  /** A tag narrower than this across the image doesn't decode. */
  minTagPixels: number;
};

export const defaultVisionLimits: VisionLimits = {
  basePositionStdDev: 0.07,
  maxTagDistance: 6.25,
  maxIncidenceDegrees: 60,
  minTagPixels: 12
};

/** One tag a camera can see, with the numbers that decided it. */
export type Sighting = {
  cameraId: string;
  tagId: number;
  /** Lens to tag center, in meters. */
  distance: number;
  /** Degrees between the tag's normal and the line to the camera; 0 is straight on. */
  incidence: number;
  /** How wide the tag lands in the image. */
  pixels: number;
  /** Where the sight line starts and ends, for drawing. */
  from: { x: number; y: number };
  to: { x: number; y: number };
};

/** What the robot could work out about its position from one pose. */
export type VisionFix = {
  sightings: Sighting[];
  /** Distinct tags, however many cameras see each one. */
  tagCount: number;
  /** Mean tag distance for the camera the standard deviation came from. */
  averageDistance: number;
  /** The standard deviation the pose estimator would use, or null when it would reject the frame. */
  stdDev: number | null;
};

export type RobotPose = { x: number; y: number; heading: number };

const radians = (degrees: number) => degrees * Math.PI / 180;

/** The lens in field coordinates, and the direction it looks. */
export function cameraPose(pose: RobotPose, mount: CameraMount) {
  const heading = radians(pose.heading);
  const cos = Math.cos(heading), sin = Math.sin(heading);
  return {
    x: pose.x + mount.x * cos - mount.y * sin,
    y: pose.y + mount.x * sin + mount.y * cos,
    z: mount.z,
    yaw: pose.heading + mount.yaw
  };
}

/** Where a point sits in the camera's own frame: x forward, y left, z up, after yaw and pitch. */
function inCameraFrame(lens: { x: number; y: number; z: number; yaw: number }, pitch: number,
  point: { x: number; y: number; z: number }) {
  const yaw = radians(lens.yaw);
  const dx = point.x - lens.x, dy = point.y - lens.y, dz = point.z - lens.z;
  const forward = dx * Math.cos(yaw) + dy * Math.sin(yaw);
  const left = -dx * Math.sin(yaw) + dy * Math.cos(yaw);
  const tilt = radians(pitch);
  return {
    x: forward * Math.cos(tilt) + dz * Math.sin(tilt),
    y: left,
    z: -forward * Math.sin(tilt) + dz * Math.cos(tilt)
  };
}

/** True when a point lands inside the image, as a rectilinear lens sees it. */
function inView(point: { x: number; y: number; z: number }, mount: CameraMount) {
  if (point.x <= 1e-6) return false;
  return Math.abs(point.y / point.x) <= Math.tan(radians(mount.hFov / 2))
    && Math.abs(point.z / point.x) <= Math.tan(radians(mount.vFov / 2));
}

/** The four corners of a vertical tag's face. */
function tagCorners(tag: FieldTag) {
  const yaw = radians(tag.yaw);
  // Across the face, perpendicular to the direction it looks.
  const alongX = -Math.sin(yaw), alongY = Math.cos(yaw);
  const half = tagSizeMeters / 2;
  return [half, -half].flatMap(across => [half, -half].map(up => ({
    x: tag.x + alongX * across, y: tag.y + alongY * across, z: tag.z + up
  })));
}

/**
 * Every tag each enabled camera can see from one robot pose. A tag has to be whole in the image,
 * turned toward the camera, big enough to decode, within the robot's distance limit and not behind
 * anything on the field.
 */
export function tagSightings(pose: RobotPose, cameras: CameraMount[], tags: FieldTag[],
  occluders: Occluder[], limits: VisionLimits): Sighting[] {
  const sightings: Sighting[] = [];
  const maxIncidence = Math.cos(radians(limits.maxIncidenceDegrees));
  for (const mount of cameras) {
    if (!mount.enabled) continue;
    const lens = cameraPose(pose, mount);
    const focalPixels = mount.imageWidth / (2 * Math.tan(radians(mount.hFov / 2)));
    for (const tag of tags) {
      const dx = tag.x - lens.x, dy = tag.y - lens.y, dz = tag.z - lens.z;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (distance >= limits.maxTagDistance || distance < 1e-6) continue;
      // Facing the camera at all, then squarely enough to decode.
      const normal = { x: Math.cos(radians(tag.yaw)), y: Math.sin(radians(tag.yaw)) };
      const facing = (-dx * normal.x - dy * normal.y) / distance;
      if (facing <= 0 || facing < maxIncidence) continue;
      if (focalPixels * tagSizeMeters * facing / distance < limits.minTagPixels) continue;
      // The whole tag has to land in the image, so the center is a cheap first look.
      if (!inView(inCameraFrame(lens, mount.pitch, tag), mount)) continue;
      if (!tagCorners(tag).every(corner => inView(inCameraFrame(lens, mount.pitch, corner), mount))) continue;
      if (occluders.some(box => blocks(box, lens, tag))) continue;
      sightings.push({ cameraId: mount.id, tagId: tag.id, distance, incidence: Math.acos(Math.min(1, facing)) * 180 / Math.PI,
        pixels: focalPixels * tagSizeMeters * facing / distance, from: { x: lens.x, y: lens.y }, to: { x: tag.x, y: tag.y } });
    }
  }
  return sightings;
}

/**
 * What the pose estimator would make of those sightings. Each camera reports its own MegaTag2 pose,
 * so the best camera's measurement sets the quality; a tag two cameras both see is still one tag.
 */
export function visionFix(pose: RobotPose, cameras: CameraMount[], tags: FieldTag[],
  occluders: Occluder[], limits: VisionLimits): VisionFix {
  const sightings = tagSightings(pose, cameras, tags, occluders, limits);
  const seen = new Set(sightings.map(sighting => sighting.tagId));
  const byCamera = new Map<string, Sighting[]>();
  for (const sighting of sightings) byCamera.set(sighting.cameraId, [...(byCamera.get(sighting.cameraId) ?? []), sighting]);
  let stdDev: number | null = null;
  let averageDistance = 0;
  for (const camera of byCamera.values()) {
    const average = camera.reduce((sum, sighting) => sum + sighting.distance, 0) / camera.length;
    if (average >= limits.maxTagDistance) continue;
    const value = Math.max(minPositionStdDev, limits.basePositionStdDev * average * average / camera.length);
    if (stdDev === null || value < stdDev) { stdDev = value; averageDistance = average; }
  }
  return { sightings, tagCount: seen.size, stdDev, averageDistance };
}

/** How good a fix is, for coloring. "blind" means the estimator would get nothing at all. */
export type VisionQuality = "good" | "fair" | "poor" | "blind";

/** Standard deviation in meters at the top of each band. */
export const qualityBands: { quality: Exclude<VisionQuality, "blind">; upTo: number }[] = [
  { quality: "good", upTo: 0.05 },
  { quality: "fair", upTo: 0.15 },
  { quality: "poor", upTo: Number.POSITIVE_INFINITY }
];

export function visionQuality(stdDev: number | null): VisionQuality {
  if (stdDev === null) return "blind";
  return qualityBands.find(band => stdDev <= band.upTo)!.quality;
}

/** A stretch of the replay with the same quality. */
export type VisionSpan = { start: number; end: number; quality: VisionQuality; tagCount: number; stdDev: number | null };

export type RouteVision = {
  spans: VisionSpan[];
  /** Seconds with no usable measurement at all. */
  blindSeconds: number;
  /** The longest single blind stretch, which is what actually lets the pose drift. */
  longestBlind: VisionSpan | null;
  /** Fixes at each sample, for the field overlay and the inspector. */
  samples: { t: number; fix: VisionFix }[];
};

/** Fixes are worked out this often along the replay; finer than a tag comes and goes in practice. */
export const sampleSeconds = 0.1;

/** Runs the replay's route past the tags, sampling every `sampleSeconds`. */
export function routeVision(replay: Replay, cameras: CameraMount[], tags: FieldTag[],
  occluders: Occluder[], limits: VisionLimits): RouteVision {
  const samples: { t: number; fix: VisionFix }[] = [];
  const spans: VisionSpan[] = [];
  if (replay.frames.length === 0 || cameras.every(camera => !camera.enabled) || tags.length === 0) {
    return { spans, blindSeconds: 0, longestBlind: null, samples };
  }
  const framePeriod = replay.frames.length > 1 ? replay.frames[1].t - replay.frames[0].t : sampleSeconds;
  const step = Math.max(1, Math.round(sampleSeconds / Math.max(framePeriod, 1e-6)));
  for (let index = 0; index < replay.frames.length; index += step) {
    const frame = replay.frames[index];
    const fix = visionFix(frame, cameras, tags, occluders, limits);
    samples.push({ t: frame.t, fix });
    const quality = visionQuality(fix.stdDev);
    const last = spans.at(-1);
    if (last && last.quality === quality) {
      last.end = frame.t;
      last.tagCount = Math.min(last.tagCount, fix.tagCount);
      if (fix.stdDev !== null) last.stdDev = Math.max(last.stdDev ?? 0, fix.stdDev);
    } else {
      spans.push({ start: last ? last.end : 0, end: frame.t, quality, tagCount: fix.tagCount, stdDev: fix.stdDev });
    }
  }
  const last = spans.at(-1);
  if (last) last.end = replay.duration;
  const blind = spans.filter(span => span.quality === "blind");
  return {
    spans,
    blindSeconds: blind.reduce((sum, span) => sum + span.end - span.start, 0),
    longestBlind: blind.reduce<VisionSpan | null>((worst, span) =>
      !worst || span.end - span.start > worst.end - worst.start ? span : worst, null),
    samples
  };
}

/** The sampled fix nearest a time, for the field overlay. */
export function fixAt(vision: RouteVision, t: number) {
  if (vision.samples.length === 0) return undefined;
  const index = Math.min(vision.samples.length - 1, Math.max(0, Math.round(t / sampleSeconds)));
  return vision.samples[index];
}
