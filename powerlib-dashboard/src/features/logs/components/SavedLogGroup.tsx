import { useState } from "react";
import type { ReactNode } from "react";
import { Box, ButtonBase, Typography } from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { SavedLog, SavedLogGroup as Group } from "../logLibraryModel";

type SavedLogGroupProps = {
  group: Group;
  /** One row per log, so the logs list and the robot's list can draw rows their own way. */
  renderLog: (log: SavedLog) => ReactNode;
};

/** An event (or a week of shop runs) in a logs list: a header that folds, then its runs. */
export function SavedLogGroup({ group, renderLog }: SavedLogGroupProps) {
  const [folded, setFolded] = useState(false);
  const Chevron = folded ? ChevronRightIcon : ExpandMoreIcon;
  return (
    <Box sx={{ mb: 1.5 }}>
      <ButtonBase onClick={() => setFolded(value => !value)} sx={{ gap: 0.75, py: 0.5, borderRadius: 1 }}>
        <Chevron fontSize="small" sx={{ color: "text.secondary" }} />
        <Typography variant="body2" sx={{ fontWeight: 800 }}>{group.title}</Typography>
        <Typography variant="caption" color="text.secondary">{group.subtitle}</Typography>
      </ButtonBase>
      {!folded && (
        <Box sx={{ border: 1, borderColor: "divider", borderRadius: 1.5, overflow: "hidden", mt: 0.5 }}>
          {group.logs.map(renderLog)}
        </Box>
      )}
    </Box>
  );
}
