import { Typography } from "@mui/material";

type ShortcutRowProps = {
  keys: string[];
  action: string;
};

/** One shortcut: its keys and what they do. */
export function ShortcutRow({ keys, action }: ShortcutRowProps) {
  return <div className="ab-shortcut">
    <span className="ab-shortcut-keys">{keys.map(key => <kbd key={key}>{key}</kbd>)}</span>
    <Typography variant="body2">{action}</Typography>
  </div>;
}
