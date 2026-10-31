/**
 * Simplified 2026 REBUILT field (welded perimeter) in the blue-origin frame: +x from the blue alliance
 * wall, +y from the scoring table guardrail. All numbers are inches from FIRST's 2026 Game Manual
 * section 5, Field Dimension Drawings FE-2026 rev B and element drawings GE-26500 (tower);
 * `npm run check:fields` checks them against the WPILib AprilTag layout. Red elements are the blue ones
 * turned 180° about the field center.
 */
export type DrawingElement = "hub" | "hubOpening" | "bump" | "trench" | "trenchPost" | "trenchBar" | "tower" | "towerUpright" | "towerRung"
  | "depot" | "outpost" | "startingLine" | "centerLine" | "fuel";
/** An axis-aligned box in meters; `hubOpening` is the hexagon inscribed in its box. */
export type DrawingRect = { element: DrawingElement; alliance: "blue" | "red" | null; x: number; y: number; length: number; width: number; label?: string };

const inch = 0.0254;
const fieldLength = 651.22; // FE-2026 sheet 3, diamond plate to diamond plate
const fieldWidth = 317.69; // FE-2026 sheet 3
const centerY = fieldWidth / 2;

const hubCenterX = 182.11; // FE-2026 sheet 3, alliance wall to hub center
const hubSize = 47; // Manual 5.4, 47 in × 47 in
const hubOpeningFlats = 41.7; // Manual 5.4 Figure 5-7, regular hexagon across its flats, which face the guardrails
const bumpDepth = 44.4; // Manual 5.5 and FE-2026 sheet 3
const bumpWidth = 73; // Manual 5.5 and FE-2026 sheet 4, one either side of the hub
const trenchDepth = 47; // Manual 5.6 and FE-2026 sheet 3, guardrail to bump
const trenchPostWidth = 12; // FE-2026 sheet 4, solid support beside the bump; the rest is the open lane
const trenchBarFaces = [180.64, 183.59]; // FE-2026 sheet 11, faces of the AprilTags mounted on either side of the trench arm
const startingLineFar = 158.61; // FE-2026 sheet 3: 156.61 to the tape plus 2.00 of tape, against the hub
const tapeWidth = 2; // Manual 5.3
const towerCenterOffset = 11.38; // FE-2026 sheet 3, field center line to tower center (toward the scoring table)
const towerWidth = 49.25; // Manual 5.8
const towerDepth = 45; // Manual 5.8
const uprightFront = startingLineFar - 115.05; // FE-2026 sheet 3, hub face to the front of the uprights (GE-26500: 40.000 + 3.510)
const uprightDepth = 3.51; // GE-26500 sheet 2
const uprightThickness = 1.5; // Manual 5.8 and GE-26500 sheet 2
const uprightGap = 32.25; // Manual 5.8 and GE-26500 sheet 2, between the uprights
const rungLength = 47; // GE-26500 sheet 2, rung tip to rung tip
const rungDiameter = 1.66; // Manual 5.8, 1-1/4 in Sch 40 pipe, through the middle of the uprights
const depotCenterOffset = 75.93; // FE-2026 sheet 3, field center line to depot center (away from the scoring table)
const depotWidth = 42; // Manual 5.7 and FE-2026 sheet 3
const depotDepth = 27; // Manual 5.7 and FE-2026 sheet 3
const outpostSpan = 49.84; // FE-2026 sheet 3, scoring table guardrail to the outpost's end of the alliance wall
const fuelHalfLength = 35.95; // FE-2026 sheet 3, neutral zone FUEL either side of the center line
const fuelHalfWidth = 90.95; // FE-2026 sheet 3

const rect = (element: DrawingElement, alliance: DrawingRect["alliance"], x: number, y: number, length: number, width: number, label?: string): DrawingRect =>
  ({ element, alliance, x: x * inch, y: y * inch, length: length * inch, width: width * inch, label });

const hubEdge = centerY - hubSize / 2;
const trenchSpan = hubEdge - bumpWidth; // guardrail to bump
const trenchLane = trenchSpan - trenchPostWidth;
const trenchX = hubCenterX - trenchDepth / 2;
const bumpX = hubCenterX - bumpDepth / 2;
const barX = trenchBarFaces[0], barDepth = trenchBarFaces[1] - trenchBarFaces[0];
const hexCorners = hubOpeningFlats * 2 / Math.sqrt(3);
const towerY = centerY - towerCenterOffset;
const uprightX = uprightFront - uprightDepth;
const blue: DrawingRect[] = [
  rect("startingLine", "blue", startingLineFar - tapeWidth, 0, tapeWidth, fieldWidth),
  rect("trench", "blue", trenchX, 0, trenchDepth, trenchLane),
  rect("trench", "blue", trenchX, fieldWidth - trenchLane, trenchDepth, trenchLane),
  rect("trenchBar", "blue", barX, 0, barDepth, trenchLane),
  rect("trenchBar", "blue", barX, fieldWidth - trenchLane, barDepth, trenchLane),
  // The bar and its tags run down the middle of the lane, so the post carries the label.
  rect("trenchPost", "blue", trenchX, trenchLane, trenchDepth, trenchPostWidth, "TRENCH"),
  rect("trenchPost", "blue", trenchX, fieldWidth - trenchSpan, trenchDepth, trenchPostWidth, "TRENCH"),
  rect("bump", "blue", bumpX, trenchSpan, bumpDepth, bumpWidth, "BUMP"),
  rect("bump", "blue", bumpX, centerY + hubSize / 2, bumpDepth, bumpWidth, "BUMP"),
  rect("hub", "blue", hubCenterX - hubSize / 2, hubEdge, hubSize, hubSize, "HUB"),
  rect("hubOpening", "blue", hubCenterX - hexCorners / 2, centerY - hubOpeningFlats / 2, hexCorners, hubOpeningFlats),
  rect("tower", "blue", 0, towerY - towerWidth / 2, towerDepth, towerWidth, "TOWER"),
  rect("towerRung", "blue", uprightX + uprightDepth / 2 - rungDiameter / 2, towerY - rungLength / 2, rungDiameter, rungLength),
  rect("towerUpright", "blue", uprightX, towerY - uprightGap / 2 - uprightThickness, uprightDepth, uprightThickness),
  rect("towerUpright", "blue", uprightX, towerY + uprightGap / 2, uprightDepth, uprightThickness),
  rect("depot", "blue", 0, centerY + depotCenterOffset - depotWidth / 2, depotDepth, depotWidth, "DEPOT"),
  rect("outpost", "blue", 0, 0, 0, outpostSpan, "OUTPOST")
];

const rotate = (shape: DrawingRect): DrawingRect => ({ ...shape, alliance: "red",
  x: fieldLength * inch - shape.x - shape.length, y: fieldWidth * inch - shape.y - shape.width });

export const rebuiltDrawing: DrawingRect[] = [
  rect("fuel", null, fieldLength / 2 - fuelHalfLength, centerY - fuelHalfWidth, fuelHalfLength * 2, fuelHalfWidth * 2, "FUEL"),
  rect("centerLine", null, fieldLength / 2 - tapeWidth / 2, 0, tapeWidth, fieldWidth),
  ...blue,
  ...blue.map(rotate)
];

export const rebuiltDrawingSize = { length: fieldLength * inch, width: fieldWidth * inch };
