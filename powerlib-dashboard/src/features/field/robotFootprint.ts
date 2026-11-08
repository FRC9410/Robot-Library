export type BumperDimensions = { lengthInches: number; widthInches: number };
export const defaultBumperDimensions: BumperDimensions = { lengthInches: 32, widthInches: 32 };

export function validBumperDimensions(value: BumperDimensions) {
  return Number.isFinite(value.lengthInches) && value.lengthInches > 0 && Number.isFinite(value.widthInches) && value.widthInches > 0;
}

/** The outside bumper rectangle, centered on the robot, in the caller's SVG units. */
export function bumperRectangle(value: BumperDimensions, scale = 1) {
  const lengthMeters = value.lengthInches * .0254, widthMeters = value.widthInches * .0254;
  return { x: -lengthMeters * scale / 2, y: -widthMeters * scale / 2, width: lengthMeters * scale, height: widthMeters * scale,
    lengthMeters, widthMeters };
}
