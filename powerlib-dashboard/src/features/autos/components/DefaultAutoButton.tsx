import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { TooltipIconButton } from "./TooltipIconButton";

type DefaultAutoButtonProps = {
  isDefault: boolean;
  onChange: (isDefault: boolean) => void;
};

/** A star that makes the auto the one the robot picks when it starts. */
export function DefaultAutoButton({ isDefault, onChange }: DefaultAutoButtonProps) {
  return <TooltipIconButton title={isDefault ? "Default auto (selected when the robot starts)" : "Make this the default auto"} label="Default auto"
    size="medium" color={isDefault ? "primary" : "default"} onClick={() => onChange(!isDefault)}>
    {isDefault ? <StarIcon /> : <StarBorderIcon />}
  </TooltipIconButton>;
}
