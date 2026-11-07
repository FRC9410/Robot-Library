import { Box, Drawer, IconButton, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { NetworkTablesPanel } from "./NetworkTablesPanel";

export function NetworkTablesDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return <Drawer anchor="right" variant="persistent" open={open}
    slotProps={{ paper: { role: "complementary", "aria-label": "Network Tables",
      sx: { width: "min(720px, calc(100vw - 32px))", top: 92, height: "calc(100% - 92px)",
        boxSizing: "border-box", bgcolor: "#1b1d21", backgroundImage: "none", borderLeft: 1, borderColor: "divider", colorScheme: "dark" } } }}>
    <Box onKeyDown={event => { if (event.key === "Escape") { event.stopPropagation(); onClose(); } }}
      sx={{ height: "100%", minHeight: 0, display: "flex", flexDirection: "column" }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1, borderBottom: 1, borderColor: "divider" }}>
        <Typography component="h2" variant="h6" sx={{ flex: 1 }}>Network Tables</Typography>
        <IconButton aria-label="Close Network Tables" onClick={onClose}><CloseIcon /></IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, p: 1 }}>{open && <NetworkTablesPanel />}</Box>
    </Box>
  </Drawer>;
}
