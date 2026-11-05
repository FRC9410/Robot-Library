import { useState } from "react";
import { Button, Chip, CircularProgress, Tooltip, Typography } from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import type { AutoActions } from "../autoActions";
import type { AutoDocument, AutoIssue } from "../autoModel";
import type { PointActions } from "../pointActions";
import type { AutoMenuAnchor } from "../types";
import { AutoContextMenu } from "./AutoContextMenu";
import { AutoList } from "./AutoList";
import { Pane } from "./Pane";
import { PaneHeader } from "./PaneHeader";
import { PointList } from "./PointList";

type AutoListPaneProps = {
  collapsed: boolean;
  loading: boolean;
  document: AutoDocument;
  selectedAutoId: string | null;
  issues: AutoIssue[];
  /** Replay length of each auto, by id. */
  durations: Map<string, number>;
  /** A named point can be added to the auto on the field (not its mirrored copy). */
  canAddPoint: boolean;
  onSelect: (id: string) => void;
  autos: AutoActions;
  points: PointActions;
};

/** The left column: the robot project's autos and the named points they share. */
export function AutoListPane({ collapsed, loading, document, selectedAutoId, issues, durations, canAddPoint, onSelect, autos, points }: AutoListPaneProps) {
  const [menu, setMenu] = useState<AutoMenuAnchor | null>(null);
  const errorCount = issues.filter(issue => issue.severity === "error").length;
  return <Pane collapsed={collapsed} label="Autos">
    <PaneHeader title="Autos" count={loading ? undefined : document.autos.length}>
      {errorCount > 0 && <Tooltip title="File → Update Code writes the autos into robot code once these are fixed. The autos with problems have a red count.">
        <Chip size="small" color="error" variant="outlined" label={`${errorCount} to fix`} />
      </Tooltip>}
      <Button size="small" variant="contained" startIcon={<AddIcon />} onClick={autos.create}>New</Button>
    </PaneHeader>
    <div className="ab-pane-body flush">
      {loading && <CircularProgress size={22} sx={{ display: "block", m: "16px auto" }} />}
      {!loading && document.autos.length === 0 && <div className="ab-empty">
        <Typography variant="body2">No autos yet</Typography>
        <Typography variant="caption" color="text.secondary">Create one, then click the field to place where the robot drives.</Typography>
      </div>}
      <AutoList autos={document.autos} selectedId={selectedAutoId} issues={issues} durations={durations} onSelect={onSelect}
        onMenu={(id, x, y) => { if (id !== selectedAutoId) onSelect(id); setMenu({ id, x, y }); }} />
      <AutoContextMenu menu={menu} auto={document.autos.find(auto => auto.id === menu?.id) ?? null} onClose={() => setMenu(null)}
        onDuplicate={autos.duplicate} onFlip={autos.flip} onDelete={autos.remove} onDefault={autos.setDefault} onToggleClear={autos.toggleClearRequests} />
      {!loading && <PointList points={document.points} autos={document.autos} canAdd={canAddPoint}
        onAdd={points.driveTo} onRename={points.rename} onDelete={points.remove} />}
    </div>
  </Pane>;
}
