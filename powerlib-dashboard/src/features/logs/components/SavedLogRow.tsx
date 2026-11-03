import { ButtonBase, Typography } from "@mui/material";
import { formatBytes, savedLogWhen } from "../logLibraryModel";
import type { SavedLog } from "../logLibraryModel";

type SavedLogRowProps = {
  log: SavedLog;
  /** "open" is on screen now; "kept" is still in memory and opens instantly. */
  status?: "open" | "kept";
  disabled: boolean;
  onOpen: (log: SavedLog) => void;
};

/** One run in the logs list: its name, whether it's open or loaded, when it ran, and its size. Clicking it opens the log. */
export function SavedLogRow({ log, status, disabled, onOpen }: SavedLogRowProps) {
  return (
    <ButtonBase onClick={() => onOpen(log)} disabled={disabled} title={log.files.join("\n")}
      sx={{ width: "100%", justifyContent: "flex-start", gap: 1, px: 1.5, py: 0.9, textAlign: "left", borderTop: 1, borderColor: "divider",
        "&:first-of-type": { borderTop: 0 }, bgcolor: status === "open" ? "rgba(250, 204, 21, 0.08)" : "transparent",
        "&:hover": { bgcolor: "action.hover" } }}>
      <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{log.name}</Typography>
      <Typography variant="caption" color={status === "open" ? "primary" : "text.secondary"} sx={{ width: 52, textAlign: "right" }}>
        {status === "open" ? "Open" : status === "kept" ? "Loaded" : ""}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ width: 84, textAlign: "right" }}>{savedLogWhen(log)}</Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ width: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatBytes(log.bytes)}
      </Typography>
    </ButtonBase>
  );
}
