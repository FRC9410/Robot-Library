import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";

type LogStatusBarProps = {
  name: string;
  converted: boolean;
  details: string;
  canPercent?: number;
  loading: boolean;
  onOpen: () => void;
};

/** A thin strip under the tab: open another log, which file is open, what's in it, and CAN use at the current time. */
export function LogStatusBar({ name, converted, details, canPercent, loading, onOpen }: LogStatusBarProps) {
  return (
    // Negative margins cancel the page gutters so the bar runs edge to edge along the bottom of the window.
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexShrink: 0, minHeight: 30, py: 0.5, mx: { xs: -2, sm: -3 }, px: { xs: 2, sm: 3 },
      borderTop: 1, borderColor: "divider", bgcolor: "background.paper" }}>
      <Button size="small" startIcon={<FolderOpenIcon />} onClick={onOpen} disabled={loading} sx={{ py: 0 }}>Open log</Button>
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
