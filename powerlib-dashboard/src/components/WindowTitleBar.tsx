import ElectricBoltIcon from "@mui/icons-material/ElectricBolt";
import { Box, Button, Typography } from "@mui/material";

const menus = ["File", "Edit", "View", "Window", "Help"];

export function WindowTitleBar() {
  return <Box className="window-titlebar">
    {window.powerlib?.platform !== "darwin" && window.powerlib?.showAppMenu && <Box className="window-titlebar-menus" role="menubar" aria-label="Application menu">
      {menus.map(label => <Button key={label} role="menuitem" aria-haspopup="menu" onClick={event => {
        const bounds = event.currentTarget.getBoundingClientRect();
        void window.powerlib?.showAppMenu(label.toLowerCase(), { x: Math.round(bounds.left), y: Math.round(bounds.bottom) });
      }}>{label}</Button>)}
    </Box>}
    <Box className="window-titlebar-brand">
      <ElectricBoltIcon color="primary" />
      <Typography component="span" className="window-titlebar-name">Power Tool</Typography>
      <Typography component="span" className="window-titlebar-team">powered by Team 9410</Typography>
    </Box>
  </Box>;
}
