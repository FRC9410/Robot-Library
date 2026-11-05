// Keyboard shortcuts in the Auto Builder, for the help dialog; autoKeys.ts handles them.
// Editing shortcuts are ignored while typing in a field.
export const autoShortcuts: { group: string; keys: string[]; action: string }[] = [
  { group: "Editing", keys: ["Ctrl+Z"], action: "Undo" },
  { group: "Editing", keys: ["Ctrl+Y", "Ctrl+Shift+Z"], action: "Redo" },
  { group: "Editing", keys: ["Ctrl+S"], action: "Save" },
  { group: "Selecting", keys: ["Shift+click"], action: "Add or remove a robot or step from the selection" },
  { group: "Selecting", keys: ["Drag on the field"], action: "Box-select robots (Shift adds to the selection)" },
  { group: "Selecting", keys: ["Ctrl+A"], action: "Select every step in the auto" },
  { group: "Selecting", keys: ["[", "]"], action: "Select the previous or next step" },
  { group: "Selecting", keys: ["Esc"], action: "Clear the selection" },
  { group: "Steps", keys: ["1", "2", "3", "4", "5"], action: "Add drive, request state, wait for state, wait, or branch after the selection" },
  { group: "Steps", keys: ["Ctrl+C", "Ctrl+V"], action: "Copy the selected steps; paste them after the selection, in any auto" },
  { group: "Steps", keys: ["Ctrl+D"], action: "Duplicate the selected steps" },
  { group: "Steps", keys: ["Delete"], action: "Delete the selected steps" },
  { group: "Steps", keys: ["Alt+↑", "Alt+↓"], action: "Move the selected steps earlier or later" },
  { group: "Drive points", keys: ["Drag"], action: "Move the selection; snaps to other points' X or Y and to 45° lines from neighbors" },
  { group: "Drive points", keys: ["Drag the handle"], action: "Aim; snaps to 45°/90°, the path direction and neighbors' headings (Shift: 15° steps)" },
  { group: "Drive points", keys: ["Hold Ctrl"], action: "Turn snapping off while dragging" },
  { group: "Drive points", keys: ["Arrow keys"], action: "Nudge the selected points 5 cm (Shift: 25 cm)" },
  { group: "Drive points", keys: ["Q", "E"], action: "Turn the selected points 15° left or right (Shift: 1°)" },
  { group: "Replay", keys: ["Space"], action: "Play or pause the replay" },
  { group: "Help", keys: ["?"], action: "Show these shortcuts" }
];
