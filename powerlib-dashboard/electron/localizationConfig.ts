export type LocalizationConfig = {
  sourceRevision?: string;
  position: { targetAreaThreshold: number; maxTargetDistanceMeters: number };
  heading: { maxTagDistanceMeters: number; singleTagMaxDistanceMeters: number };
};
export const defaultLocalizationConfig: LocalizationConfig = {
  position: { targetAreaThreshold: 0, maxTargetDistanceMeters: 6.25 },
  heading: { maxTagDistanceMeters: 4, singleTagMaxDistanceMeters: 2 }
};

export function validateLocalizationConfig(value: unknown): asserts value is LocalizationConfig {
  if (!value || typeof value !== "object") throw Error("Invalid localization configuration.");
  const config = value as LocalizationConfig;
  const area = config.position?.targetAreaThreshold;
  if (!Number.isFinite(area) || area < 0 || area > 100) throw Error("Target area threshold must be from 0 to 100 percent.");
  for (const distance of [config.position?.maxTargetDistanceMeters, config.heading?.maxTagDistanceMeters, config.heading?.singleTagMaxDistanceMeters]) {
    if (!Number.isFinite(distance) || distance <= 0) throw Error("Localization distances must be positive finite numbers.");
  }
}

export const localizationVariableMappings = {
  "Position/TargetAreaThreshold": { section: "position", field: "targetAreaThreshold", label: "Target area threshold (%)" },
  "Position/MaxTargetDistanceMeters": { section: "position", field: "maxTargetDistanceMeters", label: "Maximum target distance (m)" },
  "Heading/MaxTagDistanceMeters": { section: "heading", field: "maxTagDistanceMeters", label: "Heading max tag distance (m)" },
  "Heading/SingleTagMaxDistanceMeters": { section: "heading", field: "singleTagMaxDistanceMeters", label: "Single-tag heading max distance (m)" }
} as const;

export const localizationConstantNames = new Set([
  "POSITION_TARGET_AREA_THRESHOLD", "POSITION_MAX_TARGET_DISTANCE_METERS",
  "HEADING_MAX_TAG_DISTANCE_METERS", "HEADING_SINGLE_TAG_MAX_DISTANCE_METERS"
]);
