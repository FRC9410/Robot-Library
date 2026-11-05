import AddLocationIcon from "@mui/icons-material/AddLocationAlt";
import DeleteIcon from "@mui/icons-material/DeleteOutlined";
import type { NamedPoint } from "../autoModel";
import { TooltipIconButton } from "./TooltipIconButton";

type PointListItemProps = {
  point: NamedPoint;
  /** Drive steps, in every auto, that drive to or face this point. */
  uses: number;
  /** A drive step can be added to the auto on the field (not its mirrored copy). */
  canAdd: boolean;
  onAdd: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
};

/** A named point: its name (edit in place), where it is and how many steps use it. Actions show on hover. */
export function PointListItem({ point, uses, canAdd, onAdd, onRename, onDelete }: PointListItemProps) {
  return <li className="ab-point">
    <span className="ab-point-dot" />
    <span className="ab-point-text">
      <input className="ab-point-name" value={point.name} aria-label="Point name" spellCheck={false} onChange={event => onRename(event.target.value)} />
      <span className="ab-auto-meta">{point.x.toFixed(2)}, {point.y.toFixed(2)} m · {uses === 0 ? "unused" : `${uses} step${uses === 1 ? "" : "s"}`}</span>
    </span>
    <span className="ab-point-actions">
      <TooltipIconButton title={canAdd ? "Drive here in this auto" : "Pick an auto (not the mirrored copy) to drive here"} label={`Drive to ${point.name}`}
        disabled={!canAdd} onClick={onAdd}><AddLocationIcon fontSize="small" /></TooltipIconButton>
      <TooltipIconButton title="Delete point (linked steps keep their spot)" label={`Delete ${point.name}`} onClick={onDelete}>
        <DeleteIcon fontSize="small" />
      </TooltipIconButton>
    </span>
  </li>;
}
