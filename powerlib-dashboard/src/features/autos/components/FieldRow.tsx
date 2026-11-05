import type { ReactNode } from "react";
import { Stack } from "@mui/material";

type FieldRowProps = {
  /** Inputs or buttons laid out side by side. */
  children: ReactNode;
  /** Centers the items vertically, for rows that mix inputs and buttons. */
  center?: boolean;
};

/** Settings side by side, sharing the row's width. */
export function FieldRow({ children, center = false }: FieldRowProps) {
  return <Stack direction="row" spacing={1} sx={center ? { alignItems: "center" } : undefined}>{children}</Stack>;
}
