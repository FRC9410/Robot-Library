import type { ReactNode } from "react";
import { Typography } from "@mui/material";

type PaneHeaderProps = {
  /** A title at the left; leave it out for a toolbar that is all controls. */
  title?: ReactNode;
  /** Shown next to the title, such as a count. */
  count?: number;
  /** A shorter row, for toolbars under another header. */
  dense?: boolean;
  /** Actions at the right of the title, or the whole toolbar. */
  children?: ReactNode;
};

/** The top row of a pane: its title and actions, or a toolbar. */
export function PaneHeader({ title, count, dense = false, children }: PaneHeaderProps) {
  return <div className={`ab-pane-header${dense ? " dense" : ""}`}>
    {title !== undefined && <Typography component="h2" sx={{ display: "flex", flex: 1, alignItems: "baseline", gap: 0.75, minWidth: 0, fontWeight: 600 }}>
      {title}{count !== undefined && <span className="ab-pane-count">{count}</span>}
    </Typography>}
    {children}
  </div>;
}
