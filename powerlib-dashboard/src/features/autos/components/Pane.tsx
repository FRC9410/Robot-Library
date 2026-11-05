import type { ReactNode } from "react";

type PaneProps = {
  /** A hidden column keeps its place in the grid. */
  collapsed?: boolean;
  className?: string;
  label?: string;
  children: ReactNode;
};

/** A bordered card that fills its grid cell; its header and body are children. */
export function Pane({ collapsed = false, className, label, children }: PaneProps) {
  return <section className={["ab-pane", collapsed && "collapsed", className].filter(Boolean).join(" ")} aria-label={label}>
    {children}
  </section>;
}
