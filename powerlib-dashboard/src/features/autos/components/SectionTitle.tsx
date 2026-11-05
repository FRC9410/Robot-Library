import { Stack, Tooltip, Typography } from "@mui/material";
import type { TooltipProps } from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";

type SectionTitleProps = {
  title: string;
  /** The explanation, behind an info icon instead of on screen. */
  hint?: string;
  hintPlacement?: TooltipProps["placement"];
};

/** A small uppercase section title, with an info icon when there's more to say. */
export function SectionTitle({ title, hint, hintPlacement = "left" }: SectionTitleProps) {
  return <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
    <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>{title}</Typography>
    {hint && <Tooltip title={hint} placement={hintPlacement}>
      <InfoOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", cursor: "help" }} aria-label={hint} />
    </Tooltip>}
  </Stack>;
}
