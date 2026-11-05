import { Dialog, DialogContent, Typography } from "@mui/material";
import { autoShortcuts } from "../autoShortcuts";
import { DialogTitleBar } from "./DialogTitleBar";
import { ShortcutRow } from "./ShortcutRow";

type ShortcutsDialogProps = {
  open: boolean;
  onClose: () => void;
};

/** Every Auto Builder keyboard shortcut, grouped. */
export function ShortcutsDialog({ open, onClose }: ShortcutsDialogProps) {
  const groups = [...new Set(autoShortcuts.map(shortcut => shortcut.group))];
  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitleBar onClose={onClose}>Auto Builder shortcuts</DialogTitleBar>
    <DialogContent>
      {groups.map(group => <section key={group} className="ab-shortcut-group">
        <Typography variant="overline" color="text.secondary">{group}</Typography>
        {autoShortcuts.filter(shortcut => shortcut.group === group).map(shortcut =>
          <ShortcutRow key={shortcut.action} keys={shortcut.keys} action={shortcut.action} />)}
      </section>)}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Right-click an auto in the list to duplicate, flip or delete it.</Typography>
    </DialogContent>
  </Dialog>;
}
