import { useState } from "react";
import type { Ref } from "react";
import { Box, IconButton, List, ListItemButton, ListItemIcon, ListItemText, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import StraightenIcon from "@mui/icons-material/Straighten";
import type { GeneratedSubsystem, SubsystemDocumentState } from "../subsystems/types";
import { FieldSettings } from "./FieldSettings";
import { SubsystemSettings } from "./SubsystemSettings";

export function ConfigSettingsView({ document, onRefresh, onCreate, onEdit, onClose, titleId, titleRef }: {
  document: SubsystemDocumentState;
  onRefresh: () => void;
  onCreate: () => void;
  onEdit: (subsystem: GeneratedSubsystem, index: number) => void;
  onClose: () => void;
  titleId: string;
  titleRef: Ref<HTMLHeadingElement>;
}) {
  const [category, setCategory] = useState<"subsystems" | "field">("subsystems");
  return <>
    <Box className="config-header">
      <SettingsOutlinedIcon color="primary" />
      <Typography id={titleId} component="h2" variant="h6" ref={titleRef} tabIndex={-1}>Config</Typography>
      <IconButton aria-label="Close Config" onClick={onClose}><CloseIcon /></IconButton>
    </Box>
    <Box className="config-settings">
      <Box component="nav" aria-label="Configuration categories" className="config-nav">
        <Typography variant="overline" color="text.secondary">Configuration</Typography>
        <List>
          <ListItemButton selected={category === "subsystems"} aria-current={category === "subsystems" ? "page" : undefined} onClick={() => setCategory("subsystems")}><ListItemIcon><LayersOutlinedIcon /></ListItemIcon><ListItemText primary="Subsystems" /></ListItemButton>
          <ListItemButton selected={category === "field"} aria-current={category === "field" ? "page" : undefined} onClick={() => setCategory("field")}><ListItemIcon><StraightenIcon /></ListItemIcon><ListItemText primary="Field" /></ListItemButton>
        </List>
      </Box>
      {category === "field" ? <FieldSettings /> : <SubsystemSettings document={document} onRefresh={onRefresh} onCreate={onCreate} onEdit={onEdit} />}
    </Box>
  </>;
}
