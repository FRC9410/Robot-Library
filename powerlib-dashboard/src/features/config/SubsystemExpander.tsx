import { useId, useState } from "react";
import { Alert, Box, Button, Collapse, Typography } from "@mui/material";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { GeneratedSubsystem } from "../subsystems/types";
import { getMotorIdsSummary } from "../subsystems/subsystemUtils";
import { SubsystemDetails } from "./SubsystemDetails";

export function SubsystemExpander({ subsystem, onEdit }: { subsystem: GeneratedSubsystem; onEdit: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const name = subsystem.name || subsystem.id || "Unnamed subsystem";
  return <Box component="section" className="config-expander">
    <Box className="config-expander-header">
      <Box component="button" type="button" aria-expanded={expanded} aria-controls={id} id={`${id}-heading`}
        onClick={() => setExpanded(current => !current)} className="config-expander-toggle">
        <ExpandMoreIcon sx={{ transform: expanded ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 150ms" }} />
        <Box sx={{ minWidth: 0, textAlign: "left" }}><Typography component="span" sx={{ display: "block", fontWeight: 650, overflowWrap: "anywhere" }}>{name}</Typography>
          <Typography component="span" variant="caption" color="text.secondary">{subsystem.type ?? "Unspecified type"} · {getMotorIdsSummary(subsystem)}</Typography></Box>
      </Box>
      <Button startIcon={<EditOutlinedIcon />} size="small" aria-label={`Edit ${name}`} disabled={!!subsystem.sourceError} onClick={onEdit}>Edit</Button>
    </Box>
    {subsystem.sourceError && <Alert severity="info">{subsystem.sourceError}</Alert>}
    <Collapse in={expanded} unmountOnExit><Box id={id} role="region" aria-labelledby={`${id}-heading`} className="config-expander-details"><SubsystemDetails subsystem={subsystem} /></Box></Collapse>
  </Box>;
}
