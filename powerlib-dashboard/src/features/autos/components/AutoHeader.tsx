import type { ReactNode } from "react";
import { Typography } from "@mui/material";
import type { Alliance, AutoIssue, AutoRoutine, Symmetry } from "../autoModel";
import { AllianceToggle } from "./AllianceToggle";
import { AutoIssuesIcon } from "./AutoIssuesIcon";
import { AutoNameField } from "./AutoNameField";
import { DefaultAutoButton } from "./DefaultAutoButton";
import { SymmetryToggle } from "./SymmetryToggle";

type AutoHeaderProps = {
  auto: AutoRoutine | null;
  /** Problems with the auto itself, not one of its steps. */
  issues: AutoIssue[];
  onRename: (name: string) => void;
  onAlliance: (alliance: Alliance | null) => void;
  onSymmetry: (symmetry: Symmetry) => void;
  onDefault: (isDefault: boolean) => void;
  /** Actions for the whole project at the right, such as save state and undo. */
  actions: ReactNode;
};

/** The selected auto's name and settings, with the project's save state and undo at the right. */
export function AutoHeader({ auto, issues, onRename, onAlliance, onSymmetry, onDefault, actions }: AutoHeaderProps) {
  return <div className="ab-auto-header">
    {auto ? <>
      <span className={`ab-alliance-dot ${auto.alliance ?? ""}`} />
      <AutoNameField value={auto.name} error={issues.some(issue => /name|None/.test(issue.message))} onChange={onRename} />
      <AutoIssuesIcon issues={issues} />
      <div className="ab-auto-settings">
        <AllianceToggle value={auto.alliance} onChange={onAlliance} />
        <SymmetryToggle value={auto.symmetry} onChange={onSymmetry} />
        <DefaultAutoButton isDefault={auto.isDefault} onChange={onDefault} />
      </div>
    </> : <Typography color="text.secondary" variant="body2" sx={{ flex: 1 }}>Create or pick an auto on the left.</Typography>}
    {actions}
  </div>;
}
