export type AutoSelectMode = boolean | "range";

/** Shift selects an inclusive range in step order; Ctrl toggles one item. */
export function selectAutoSteps(order: string[], current: string[], id: string, mode: AutoSelectMode = false, preserveGroup = false): string[] {
  const selected = current.filter(id => order.includes(id));
  const target = order.indexOf(id);
  if (target < 0) return selected;
  if (mode === "range") {
    const anchor = order.indexOf(selected.at(-1) ?? id);
    const range = order.slice(Math.min(anchor, target), Math.max(anchor, target) + 1);
    return [...selected.filter(id => !range.includes(id)), ...range.filter(candidate => candidate !== id), id];
  }
  if (mode) return selected.includes(id) ? selected.filter(candidate => candidate !== id) : [...selected, id];
  return preserveGroup && selected.includes(id) ? [...selected.filter(candidate => candidate !== id), id] : [id];
}
