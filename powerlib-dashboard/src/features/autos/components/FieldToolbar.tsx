import KeyboardIcon from "@mui/icons-material/Keyboard";
import VideocamIcon from "@mui/icons-material/Videocam";
import type { ActualRun } from "../autoActual";
import type { AutoRoutine } from "../autoModel";
import type { AutoView } from "../types";
import { LastRunChip } from "./LastRunChip";
import { MirrorViewToggle } from "./MirrorViewToggle";
import { PaneHeader } from "./PaneHeader";
import { PointAtRobotButton } from "./PointAtRobotButton";
import { TagViewToggle } from "./TagViewToggle";
import { TooltipIconButton } from "./TooltipIconButton";
import { ViewToggle } from "./ViewToggle";

type FieldToolbarProps = {
  view: AutoView;
  auto: AutoRoutine | null;
  /** The auto's mirrored copy, when it has symmetry. */
  mirror: AutoRoutine | null;
  showingMirror: boolean;
  run?: ActualRun;
  recording: boolean;
  showRun: boolean;
  robotConnected: boolean;
  showTags: boolean;
  tagsAvailable: boolean;
  onView: (view: AutoView) => void;
  onShowMirror: (showMirror: boolean) => void;
  onToggleRun: () => void;
  onClearRun: (autoName: string) => void;
  onPointAtRobot: () => void;
  onToggleTags: () => void;
  onOpenCameras: () => void;
  onOpenShortcuts: () => void;
};

/** Above the field: field or code, which copy to show, the robot's last run, and the field tools. */
export function FieldToolbar({ view, auto, mirror, showingMirror, run, recording, showRun, robotConnected, showTags, tagsAvailable, onView,
  onShowMirror, onToggleRun, onClearRun, onPointAtRobot, onToggleTags, onOpenCameras, onOpenShortcuts }: FieldToolbarProps) {
  const field = view === "field";
  return <PaneHeader dense>
    <ViewToggle value={view} onChange={onView} />
    {mirror && field && <MirrorViewToggle originalLabel={auto?.alliance ?? "Original"} mirrorLabel={mirror.alliance ? `${mirror.alliance} copy` : "Mirrored copy"}
      showingMirror={showingMirror} onChange={onShowMirror} />}
    <span className="ab-toolbar-spacer" />
    {field && run && <LastRunChip run={run} recording={recording} shown={showRun} onToggle={onToggleRun} onClear={() => onClearRun(run.autoName)} />}
    {field && <PointAtRobotButton robotConnected={robotConnected} disabled={!auto || !robotConnected} onClick={onPointAtRobot} />}
    {field && <TagViewToggle selected={showTags} available={tagsAvailable} onToggle={onToggleTags} />}
    {showTags && <TooltipIconButton title="Where each Limelight sits on the robot" label="Cameras" onClick={onOpenCameras}>
      <VideocamIcon fontSize="small" />
    </TooltipIconButton>}
    <TooltipIconButton title="Keyboard shortcuts (?)" label="Keyboard shortcuts" onClick={onOpenShortcuts}><KeyboardIcon fontSize="small" /></TooltipIconButton>
  </PaneHeader>;
}
