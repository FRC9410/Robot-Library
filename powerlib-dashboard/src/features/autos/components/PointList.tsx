import { Typography } from "@mui/material";
import type { AutoRoutine, NamedPoint } from "../autoModel";
import { pointUses } from "../autoEdits";
import { PointListItem } from "./PointListItem";
import { SectionTitle } from "./SectionTitle";

type PointListProps = {
  points: NamedPoint[];
  autos: AutoRoutine[];
  canAdd: boolean;
  onAdd: (pointId: string) => void;
  onRename: (pointId: string, name: string) => void;
  onDelete: (point: NamedPoint) => void;
};

/** Named points shared by every auto; moving one moves each step linked to it. */
export function PointList({ points, autos, canAdd, onAdd, onRename, onDelete }: PointListProps) {
  return <div className="ab-points">
    <div className="ab-points-title">
      <SectionTitle title={`Points${points.length ? ` (${points.length})` : ""}`} hintPlacement="right"
        hint="Save a drive step's pose as a named point, then reuse it in any auto. Moving a point moves every step linked to it." />
    </div>
    {points.length === 0
      ? <Typography variant="caption" color="text.secondary" className="ab-empty-note">Select a drive step and save it as a point to reuse it.</Typography>
      : <ul className="ab-point-list">
        {points.map(point => <PointListItem key={point.id} point={point} uses={pointUses(autos, point.id)} canAdd={canAdd}
          onAdd={() => onAdd(point.id)} onRename={name => onRename(point.id, name)} onDelete={() => onDelete(point)} />)}
      </ul>}
  </div>;
}
