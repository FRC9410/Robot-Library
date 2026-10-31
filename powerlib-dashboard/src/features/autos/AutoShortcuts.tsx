import { Dialog, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

/** Keyboard shortcuts in the Auto Builder; editing shortcuts are ignored while typing in a field. */
export const autoShortcuts: { group: string; keys: string[]; action: string }[] = [
  { group: "Editing", keys: ["Ctrl+Z"], action: "Undo" },
  { group: "Editing", keys: ["Ctrl+Y", "Ctrl+Shift+Z"], action: "Redo" },
  { group: "Editing", keys: ["Ctrl+S"], action: "Save" },
  { group: "Steps", keys: ["1", "2", "3", "4"], action: "Add drive, request state, wait for state, or wait after the selected step" },
  { group: "Steps", keys: ["Ctrl+C", "Ctrl+V"], action: "Copy the selected step; paste it after the selected step, in any auto" },
  { group: "Steps", keys: ["Ctrl+D"], action: "Duplicate the selected step" },
  { group: "Steps", keys: ["Delete"], action: "Delete the selected step" },
  { group: "Steps", keys: ["[", "]"], action: "Select the previous or next step" },
  { group: "Steps", keys: ["Alt+↑", "Alt+↓"], action: "Move the selected step earlier or later" },
  { group: "Steps", keys: ["Esc"], action: "Deselect the step" },
  { group: "Drive points", keys: ["Arrow keys"], action: "Nudge the selected point 5 cm (Shift: 25 cm)" },
  { group: "Drive points", keys: ["Q", "E"], action: "Turn the selected point 15° left or right (Shift: 1°)" },
  { group: "Replay", keys: ["Space"], action: "Play or pause the replay" },
  { group: "Help", keys: ["?"], action: "Show these shortcuts" }
];

export function ShortcutsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const groups = [...new Set(autoShortcuts.map(shortcut => shortcut.group))];
  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle sx={{ display: "flex", alignItems: "center" }}>
      <span style={{ flex: 1 }}>Auto Builder shortcuts</span>
      <IconButton aria-label="Close" onClick={onClose}><CloseIcon /></IconButton>
    </DialogTitle>
    <DialogContent>
      {groups.map(group => <section key={group} className="ab-shortcut-group">
        <Typography variant="overline" color="text.secondary">{group}</Typography>
        {autoShortcuts.filter(shortcut => shortcut.group === group).map(shortcut => <div key={shortcut.action} className="ab-shortcut">
          <span className="ab-shortcut-keys">{shortcut.keys.map(key => <kbd key={key}>{key}</kbd>)}</span>
          <Typography variant="body2">{shortcut.action}</Typography>
        </div>)}
      </section>)}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Right-click an auto in the list to duplicate, flip or delete it.</Typography>
    </DialogContent>
  </Dialog>;
}
