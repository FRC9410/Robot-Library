import { Alert, Button } from "@mui/material";
type TuningRecoveryNoticeProps = { count: number; disabled: boolean; error: string | null; path: string; onRestore: () => void };
export function TuningRecoveryNotice({ count, disabled, error, path, onRestore }: TuningRecoveryNoticeProps) {
  if (error) return <Alert severity="warning" sx={{ overflowWrap: "anywhere" }}>{error}</Alert>;
  return count ? <Alert severity="info" title={path} action={<Button color="inherit" disabled={disabled} onClick={onRestore}>Restore edits ({count})</Button>}>Saved tuning available.</Alert> : null;
}
