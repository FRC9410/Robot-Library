import type { SvgIconProps } from "@mui/material";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import FlagIcon from "@mui/icons-material/Flag";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import PlaylistAddCheckIcon from "@mui/icons-material/PlaylistAddCheck";
import RouteIcon from "@mui/icons-material/Route";
import type { AutoStepType } from "../autoModel";

const icons = {
  drive: RouteIcon,
  requestState: FlagIcon,
  waitForState: PlaylistAddCheckIcon,
  wait: HourglassEmptyIcon,
  branch: CallSplitIcon
} satisfies Record<AutoStepType, unknown>;

type StepIconProps = {
  type: AutoStepType;
  fontSize?: SvgIconProps["fontSize"];
};

/** The icon for a kind of step, the same in the step list, inspector and add-step menu. */
export function StepIcon({ type, fontSize = "small" }: StepIconProps) {
  const Icon = icons[type];
  return <Icon fontSize={fontSize} />;
}
