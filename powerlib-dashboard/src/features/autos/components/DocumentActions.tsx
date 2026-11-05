import RedoIcon from "@mui/icons-material/Redo";
import RefreshIcon from "@mui/icons-material/Refresh";
import UndoIcon from "@mui/icons-material/Undo";
import type { SaveState } from "../types";
import { SaveStatus } from "./SaveStatus";
import { TooltipIconButton } from "./TooltipIconButton";

type DocumentActionsProps = {
  saveState: SaveState;
  dirty: boolean;
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** Reloads the autos from the robot project. */
  onReload: () => void;
};

/** Save state, undo, redo and reload, for every auto in the project. */
export function DocumentActions({ saveState, dirty, canSave, canUndo, canRedo, onUndo, onRedo, onReload }: DocumentActionsProps) {
  return <div className="ab-document-actions">
    <SaveStatus state={saveState} dirty={dirty} canSave={canSave} />
    <TooltipIconButton title="Undo (Ctrl+Z)" label="Undo" disabled={!canUndo} onClick={onUndo}><UndoIcon fontSize="small" /></TooltipIconButton>
    <TooltipIconButton title="Redo (Ctrl+Y)" label="Redo" disabled={!canRedo} onClick={onRedo}><RedoIcon fontSize="small" /></TooltipIconButton>
    <TooltipIconButton title="Reload autos from the robot project" label="Reload autos" onClick={onReload}><RefreshIcon fontSize="small" /></TooltipIconButton>
  </div>;
}
