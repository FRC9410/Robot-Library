import type { MouseEvent, ReactNode } from "react";
import { IconButton, Tooltip } from "@mui/material";
import type { IconButtonProps, TooltipProps } from "@mui/material";

type TooltipIconButtonProps = {
  /** Shown on hover; also the button's accessible name unless `label` is set. */
  title: ReactNode;
  label?: string;
  disabled?: boolean;
  size?: IconButtonProps["size"];
  color?: IconButtonProps["color"];
  placement?: TooltipProps["placement"];
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  /** The icon. */
  children: ReactNode;
};

/** An icon button with a tooltip that still shows while the button is disabled. */
export function TooltipIconButton({ title, label, disabled = false, size = "small", color, placement, onClick, children }: TooltipIconButtonProps) {
  return <Tooltip title={title} placement={placement}>
    <span>
      <IconButton size={size} color={color} disabled={disabled} onClick={onClick}
        aria-label={label ?? (typeof title === "string" ? title : undefined)}>
        {children}
      </IconButton>
    </span>
  </Tooltip>;
}
