import { Checkbox, Stack, Typography } from "@mui/material";
import { formatBytes, savedLogWhen } from "../logLibraryModel";
import type { SavedLog } from "../logLibraryModel";

type RobotLogRowProps = {
  log: SavedLog;
  checked: boolean;
  downloaded: boolean;
  disabled: boolean;
  onToggle: (log: SavedLog) => void;
};

/** One run on the robot: a checkbox, its name, whether it's already on this laptop, when it ran and its size. */
export function RobotLogRow({ log, checked, downloaded, disabled, onToggle }: RobotLogRowProps) {
  return (
    <Stack component="label" direction="row" sx={{ alignItems: "center", gap: 1, pl: 0.5, pr: 1.5, py: 0.25, borderTop: 1, borderColor: "divider",
      "&:first-of-type": { borderTop: 0 }, cursor: disabled ? "default" : "pointer", bgcolor: checked ? "rgba(250, 204, 21, 0.08)" : "transparent",
      "&:hover": { bgcolor: disabled ? undefined : "action.hover" } }}>
      <Checkbox size="small" checked={checked} disabled={disabled} onChange={() => onToggle(log)} />
      <Typography variant="body2" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{log.name}</Typography>
      <Typography variant="caption" color={downloaded ? "success.main" : "text.secondary"} sx={{ width: 80, textAlign: "right" }}>
        {downloaded ? "Downloaded" : "On robot"}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ width: 84, textAlign: "right" }}>{savedLogWhen(log)}</Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ width: 56, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatBytes(log.bytes)}
      </Typography>
    </Stack>
  );
}
