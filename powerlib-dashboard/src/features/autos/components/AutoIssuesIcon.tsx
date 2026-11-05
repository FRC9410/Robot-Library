import { Tooltip } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import type { AutoIssue } from "../autoModel";
import { hasErrors } from "../autoModel";

type AutoIssuesIconProps = {
  /** Problems with the auto itself, not one of its steps. */
  issues: AutoIssue[];
};

/** A warning beside the auto's name; hover to read the problems. */
export function AutoIssuesIcon({ issues }: AutoIssuesIconProps) {
  if (issues.length === 0) return null;
  return <Tooltip title={<>{issues.map(issue => <div key={issue.message}>{issue.message}</div>)}</>}>
    <ErrorOutlineIcon color={hasErrors(issues) ? "error" : "warning"} aria-label="Problems with this auto" />
  </Tooltip>;
}
