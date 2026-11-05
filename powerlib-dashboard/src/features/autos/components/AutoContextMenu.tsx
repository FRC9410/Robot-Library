import { Checkbox, Divider, ListItemIcon, ListItemText, Menu, MenuItem } from "@mui/material";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import SwapVertIcon from "@mui/icons-material/SwapVert";
import type { AutoRoutine, Symmetry } from "../autoModel";
import type { AutoMenuAnchor } from "../types";

type AutoContextMenuProps = {
  menu: AutoMenuAnchor | null;
  auto: AutoRoutine | null;
  onClose: () => void;
  onDuplicate: (id: string) => void;
  onFlip: (id: string, flips: Symmetry) => void;
  onDelete: (id: string) => void;
  onDefault: (id: string, checked: boolean) => void;
  onToggleClear: (id: string) => void;
};

/** Right-click menu for an auto in the list. */
export function AutoContextMenu({ menu, auto, onClose, onDuplicate, onFlip, onDelete, onDefault, onToggleClear }: AutoContextMenuProps) {
  const run = (action: (id: string) => void) => () => { if (menu) action(menu.id); onClose(); };
  return <Menu open={menu !== null && auto !== null} onClose={onClose} anchorReference="anchorPosition"
    anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined} slotProps={{ list: { dense: true } }}>
    <MenuItem onClick={run(onDuplicate)}>
      <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon><ListItemText>Duplicate</ListItemText>
    </MenuItem>
    <MenuItem onClick={run(id => onFlip(id, { flipX: true, flipY: false }))}>
      <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon><ListItemText>Flip points across center line</ListItemText>
    </MenuItem>
    <MenuItem onClick={run(id => onFlip(id, { flipX: false, flipY: true }))}>
      <ListItemIcon><SwapVertIcon fontSize="small" /></ListItemIcon><ListItemText>Flip points top to bottom</ListItemText>
    </MenuItem>
    <Divider />
    <MenuItem onClick={run(id => onDefault(id, !auto?.isDefault))}>
      <ListItemIcon>{auto?.isDefault ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}</ListItemIcon>
      <ListItemText>{auto?.isDefault ? "Remove as default" : "Make default"}</ListItemText>
    </MenuItem>
    <MenuItem onClick={run(onToggleClear)}>
      <ListItemIcon><Checkbox size="small" checked={auto?.clearRequestsAtEnd ?? false} sx={{ p: 0 }} /></ListItemIcon>
      <ListItemText>Clear state requests at the end</ListItemText>
    </MenuItem>
    <Divider />
    <MenuItem onClick={run(onDelete)} sx={{ color: "error.main" }}>
      <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon><ListItemText>Delete</ListItemText>
    </MenuItem>
  </Menu>;
}
