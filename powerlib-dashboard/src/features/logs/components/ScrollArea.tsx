import type { ReactNode } from "react";
import { Box } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";

type ScrollAreaProps = {
  children: ReactNode;
  sx?: SxProps<Theme>;
};

/** Fills the space it's given and scrolls its own content, with a thin dark scrollbar that matches the theme. */
export function ScrollArea({ children, sx }: ScrollAreaProps) {
  return (
    <Box sx={[{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", pr: 0.5, scrollbarWidth: "thin",
      scrollbarColor: "rgba(250, 250, 250, 0.2) transparent" }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {children}
    </Box>
  );
}
