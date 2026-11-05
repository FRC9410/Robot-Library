import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import type { PreMatchCheck } from "./preMatch";

const icons = { ok: <CheckCircleOutlineIcon />, warning: <WarningAmberIcon />, info: <InfoOutlinedIcon /> };

type PreMatchListProps = {
  checks: PreMatchCheck[];
};

/** The pre-match checks on the Drive tab, each with an ok, warning or info icon. */
export function PreMatchList({ checks }: PreMatchListProps) {
  return <ul className="drive-prematch" aria-label="Pre-match checks">
    {checks.map(check => <li key={check.id} className={check.status}>{icons[check.status]}<span>{check.text}</span></li>)}
  </ul>;
}
