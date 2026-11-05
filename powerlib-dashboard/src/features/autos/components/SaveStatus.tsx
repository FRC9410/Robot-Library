import { Tooltip, Typography } from "@mui/material";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import type { SaveState } from "../types";

type SaveStatusProps = {
  state: SaveState;
  /** Edits are waiting for the autosave. */
  dirty: boolean;
  /** Power Tool can save (it isn't open in a plain browser). */
  canSave: boolean;
};

/** Whether the autos are saved to the robot project. */
export function SaveStatus({ state, dirty, canSave }: SaveStatusProps) {
  return <Tooltip title={canSave ? "Autos save as you edit. File → Update Code writes them into robot code." : "Open in Power Tool to save autos"}>
    <Typography variant="caption" color={state === "error" ? "error" : "text.secondary"}
      sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 58, mr: 0.5, whiteSpace: "nowrap" }}>
      {state === "error" ? "Not saved" : dirty || state === "saving" ? "Saving…" : <><CloudDoneIcon sx={{ fontSize: 14 }} />Saved</>}
    </Typography>
  </Tooltip>;
}
