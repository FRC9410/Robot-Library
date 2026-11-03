import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import ListIcon from "@mui/icons-material/FormatListBulleted";

type LogStatusBarProps = {
  name: string;
  converted: boolean;
  details: string;
  canPercent?: number;
  onShowLogs: () => void;
};

/** A thin strip under the tab: the logs list, which log is open, what's in it, and CAN use at the current time. */
export function LogStatusBar({ name, converted, details, canPercent, onShowLogs }: LogStatusBarProps) {
  return (
    // Negative margins cancel the page gutters so the bar runs edge to edge along the bottom of the window.
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexShrink: 0, minHeight: 30, py: 0.5, mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 },
      borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Button size="small" startIcon={<ListIcon />} onClick={onShowLogs} sx={{ py: 0 }}>Logs</Button>
      <Typography variant="caption" sx={{ fontWeight: 800 }} noWrap>{name}</Typography>
      {converted && <Chip size="small" variant="outlined" label="Converted from .hoot" sx={{ height: 20, fontSize: 11 }} />}
      <Typography variant="caption" color="text.secondary" noWrap>{details}</Typography>
      <Box sx={{ flex: 1 }} />
      {canPercent !== undefined && Number.isFinite(canPercent) && (
        <Typography variant="caption" color="text.secondary" sx={{ fontVariantNumeric: "tabular-nums" }}>CAN {canPercent.toFixed(0)}%</Typography>
      )}
    </Stack>
  );
}
