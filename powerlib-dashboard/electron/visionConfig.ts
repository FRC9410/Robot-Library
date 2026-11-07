/** Shared validation for the renderer and project file bridge. */
export type LimelightConfig = { name: string };
export type VisionCameraSettings = { fovDegrees: number; imageWidth: number; imageHeight: number };
export type VisionConfig = VisionCameraSettings & { limelights: LimelightConfig[] };
export const defaultLimelightSettings = { fovDegrees: 60, imageWidth: 320, imageHeight: 240 };

export function validateVisionConfig(value: unknown): asserts value is VisionConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as VisionConfig).limelights)) throw Error("Vision must contain a Limelight list.");
  const names = new Set<string>();
  for (const camera of (value as VisionConfig).limelights) {
    if (!camera || typeof camera.name !== "string" || !/^limelight-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(camera.name)) {
      throw Error("Use limelight- followed by lowercase letters, numbers, or hyphen-separated words.");
    }
    if (names.has(camera.name)) throw Error(`A camera named ${camera.name} already exists.`);
    names.add(camera.name);
  }
  const settings = value as VisionConfig;
  if (!Number.isFinite(settings.fovDegrees) || settings.fovDegrees <= 0 || settings.fovDegrees >= 180) throw Error("FOV must be greater than 0 and less than 180 degrees.");
  for (const dimension of [settings.imageWidth, settings.imageHeight]) {
    if (!Number.isSafeInteger(dimension) || dimension <= 0 || dimension > 2147483647) throw Error("Image width and height must be positive whole numbers within the Java integer range.");
  }
}

/** Older per-camera settings become shared values, using the first camera as the fallback. */
export function normalizeVisionConfig(value: unknown): VisionConfig {
  if (!value || typeof value !== "object" || !Array.isArray((value as VisionConfig).limelights)) throw Error("Vision must contain a Limelight list.");
  const stored = value as VisionConfig;
  const first = stored.limelights[0] as (LimelightConfig & Partial<VisionCameraSettings>) | undefined;
  const vision = { ...stored,
    fovDegrees: stored.fovDegrees ?? first?.fovDegrees ?? defaultLimelightSettings.fovDegrees,
    imageWidth: stored.imageWidth ?? first?.imageWidth ?? defaultLimelightSettings.imageWidth,
    imageHeight: stored.imageHeight ?? first?.imageHeight ?? defaultLimelightSettings.imageHeight,
    limelights: stored.limelights.map(camera => ({ name: camera?.name })) };
  validateVisionConfig(vision);
  return vision;
}
