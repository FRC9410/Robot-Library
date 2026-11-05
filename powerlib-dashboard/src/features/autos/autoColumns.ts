// Side column sizes in the Auto Builder: the autos list on the left and the steps on the right.

/** A closed column keeps its width for when it reopens. */
export type ColumnLayout = { left: number; right: number; leftOpen: boolean; rightOpen: boolean };
export type ColumnSide = "left" | "right";

export const columnStorageKey = "powerlib.autoBuilder.columns.v1";
export const defaultColumns: ColumnLayout = { left: 220, right: 340, leftOpen: true, rightOpen: true };
/** Below this window width (such as a 1280x720 laptop) the side columns start narrower so the field gets the room. */
const compactBelow = 1500;
const compactColumns: ColumnLayout = { ...defaultColumns, left: 196, right: 300 };

/** The columns before anyone resizes them, for a window this wide. */
export const defaultColumnsFor = (windowWidth: number) => windowWidth < compactBelow ? compactColumns : defaultColumns;
/** Dragging a column narrower than this closes it. */
export const closeColumnBelow = 110;
const limits: Record<ColumnSide, { min: number; max: number }> = { left: { min: 160, max: 420 }, right: { min: 260, max: 620 } };

/** A saved layout over the defaults for this window, keeping only saved values that have the right type. */
export function parseColumns(saved: string | null, windowWidth: number): ColumnLayout {
  const defaults = defaultColumnsFor(windowWidth);
  try {
    const value = JSON.parse(saved || "{}");
    return { ...defaults, ...Object.fromEntries(Object.entries(value).filter(([key, entry]) =>
      key in defaults && typeof entry === typeof defaults[key as keyof ColumnLayout])) };
  } catch {
    return defaults;
  }
}

export const columnOpen = (layout: ColumnLayout, side: ColumnSide) => side === "left" ? layout.leftOpen : layout.rightOpen;
export const columnWidth = (layout: ColumnLayout, side: ColumnSide) => side === "left" ? layout.left : layout.right;

export const withColumn = (layout: ColumnLayout, side: ColumnSide, open: boolean, width = columnWidth(layout, side)): ColumnLayout =>
  side === "left" ? { ...layout, leftOpen: open, left: width } : { ...layout, rightOpen: open, right: width };

/** The layout after dragging a column to `raw` pixels wide: closed below the threshold, else clamped. */
export const draggedColumn = (layout: ColumnLayout, side: ColumnSide, raw: number) => raw < closeColumnBelow
  ? withColumn(layout, side, false)
  : withColumn(layout, side, true, Math.round(Math.min(limits[side].max, Math.max(limits[side].min, raw))));

/** CSS grid columns: left column, handle, field, handle, right column. */
export const gridColumns = (layout: ColumnLayout) =>
  `${layout.leftOpen ? layout.left : 0}px 12px minmax(0, 1fr) 12px ${layout.rightOpen ? layout.right : 0}px`;
