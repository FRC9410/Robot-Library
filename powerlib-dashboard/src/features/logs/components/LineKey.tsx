import { Box, ButtonBase, Typography } from "@mui/material";

type LineKeyProps = {
  /** The main line's entry (e.g. "Avg"), shown first; selecting it clears `focus`. */
  main: { label: string; color: string };
  entries: { key: string; label: string; title: string; color: string }[];
  focus: string | null;
  onFocus: (key: string | null) => void;
};

/** A graph's key: one entry per line, in the lines' colors. Clicking an entry makes that line the bold one. */
export function LineKey({ main, entries, focus, onFocus }: LineKeyProps) {
  const item = (key: string | null, label: string, title: string, color: string) => {
    const selected = focus === key;
    return (
      <ButtonBase key={key ?? "main"} onClick={() => onFocus(key)} title={title} aria-pressed={selected}
        sx={{ px: 0.75, py: 0.125, borderRadius: 1, gap: 0.5, border: 1, borderColor: selected ? color : "transparent",
          bgcolor: selected ? "rgba(255,255,255,0.06)" : "transparent", opacity: selected || focus === null ? 1 : 0.6 }}>
        <Box component="span" sx={{ width: 10, height: 3, borderRadius: 1, bgcolor: color }} />
        <Typography variant="caption" sx={{ fontSize: 11, fontWeight: selected ? 800 : 500, lineHeight: 1.4 }}>{label}</Typography>
      </ButtonBase>
    );
  };
  return (
    <Box role="group" aria-label="Lines on this graph; pick one to make it bold" sx={{ display: "flex", flexWrap: "wrap", gap: 0.25, pl: "38px" }}>
      {item(null, main.label, `${main.label}: the bold line`, main.color)}
      {entries.map(entry => item(entry.key, entry.label, entry.title, entry.color))}
    </Box>
  );
}
