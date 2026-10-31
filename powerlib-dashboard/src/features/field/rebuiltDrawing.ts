/**
 * Simplified 2026 REBUILT field (welded perimeter) in the blue-origin frame: +x from the blue alliance
 * wall, +y from the scoring table guardrail. All numbers are inches from FIRST's 2026 Game Manual
 * section 5 and Field Dimension Drawings FE-2026 rev B; `npm run check:fields` checks them against the
 * WPILib AprilTag layout. Red elements are the blue ones turned 180° about the field center.
 */
export type DrawingElement = "hub" | "bump" | "trench" | "tower" | "depot" | "outpost" | "startingLine" | "centerLine" | "fuel";
export type DrawingRect = { element: DrawingElement; alliance: "blue" | "red" | null; x: number; y: number; length: number; width: number };

const inch = 0.0254;
const fieldLength = 651.22; // FE-2026 sheet 3, diamond plate to diamond plate
const fieldWidth = 317.69; // FE-2026 sheet 3
const centerY = fieldWidth / 2;

const hubCenterX = 182.11; // FE-2026 sheet 3, alliance wall to hub center
const hubSize = 47; // Manual 5.4, 47 in × 47 in
const bumpDepth = 44.4; // Manual 5.5 and FE-2026 sheet 3
const bumpWidth = 73; // Manual 5.5 and FE-2026 sheet 4, one either side of the hub
const trenchDepth = 47; // Manual 5.6 and FE-2026 sheet 3, guardrail to bump
const startingLineFar = 158.61; // FE-2026 sheet 3: 156.61 to the tape plus 2.00 of tape, against the hub
const tapeWidth = 2; // Manual 5.3
const towerCenterOffset = 11.38; // FE-2026 sheet 3, field center line to tower center (toward the scoring table)
const towerWidth = 49.25; // Manual 5.8
const towerDepth = 45; // Manual 5.8
const depotCenterOffset = 75.93; // FE-2026 sheet 3, field center line to depot center (away from the scoring table)
const depotWidth = 42; // Manual 5.7 and FE-2026 sheet 3
const depotDepth = 27; // Manual 5.7 and FE-2026 sheet 3
const outpostSpan = 49.84; // FE-2026 sheet 3, scoring table guardrail to the outpost's end of the alliance wall
const fuelHalfLength = 35.95; // FE-2026 sheet 3, neutral zone FUEL either side of the center line
const fuelHalfWidth = 90.95; // FE-2026 sheet 3

const rect = (element: DrawingElement, alliance: DrawingRect["alliance"], x: number, y: number, length: number, width: number): DrawingRect =>
  ({ element, alliance, x: x * inch, y: y * inch, length: length * inch, width: width * inch });

const hubEdge = centerY - hubSize / 2;
const blue: DrawingRect[] = [
  rect("startingLine", "blue", startingLineFar - tapeWidth, 0, tapeWidth, fieldWidth),
  rect("trench", "blue", hubCenterX - trenchDepth / 2, 0, trenchDepth, hubEdge - bumpWidth),
  rect("trench", "blue", hubCenterX - trenchDepth / 2, centerY + hubSize / 2 + bumpWidth, trenchDepth, hubEdge - bumpWidth),
  rect("bump", "blue", hubCenterX - bumpDepth / 2, hubEdge - bumpWidth, bumpDepth, bumpWidth),
  rect("bump", "blue", hubCenterX - bumpDepth / 2, centerY + hubSize / 2, bumpDepth, bumpWidth),
  rect("hub", "blue", hubCenterX - hubSize / 2, hubEdge, hubSize, hubSize),
  rect("tower", "blue", 0, centerY - towerCenterOffset - towerWidth / 2, towerDepth, towerWidth),
  rect("depot", "blue", 0, centerY + depotCenterOffset - depotWidth / 2, depotDepth, depotWidth),
  rect("outpost", "blue", 0, 0, 0, outpostSpan)
];

const rotate = (shape: DrawingRect): DrawingRect => ({ ...shape, alliance: "red",
  x: fieldLength * inch - shape.x - shape.length, y: fieldWidth * inch - shape.y - shape.width });

export const rebuiltDrawing: DrawingRect[] = [
  rect("fuel", null, fieldLength / 2 - fuelHalfLength, centerY - fuelHalfWidth, fuelHalfLength * 2, fuelHalfWidth * 2),
  rect("centerLine", null, fieldLength / 2 - tapeWidth / 2, 0, tapeWidth, fieldWidth),
  ...blue,
  ...blue.map(rotate)
];

export const rebuiltDrawingSize = { length: fieldLength * inch, width: fieldWidth * inch };
