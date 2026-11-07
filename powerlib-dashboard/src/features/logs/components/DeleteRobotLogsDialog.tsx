import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

type DeleteRobotLogsDialogProps = {
  open: boolean;
  count: number;
  notDownloaded: number;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Asks before deleting runs from the robot, and warns when some of them aren't on this laptop yet. */
export function DeleteRobotLogsDialog({ open, count, notDownloaded, deleting, onCancel, onConfirm }: DeleteRobotLogsDialogProps) {
  const runs = count === 1 ? "this run" : `these ${count} runs`;
  return (
    <Dialog open={open} onClose={deleting ? undefined : onCancel}>
      <DialogTitle>Delete from the robot?</DialogTitle>
      <DialogContent>
        <Typography variant="body2">Delete {runs} from the robot? This can't be undone.</Typography>
        {notDownloaded > 0 && (
          <Alert severity="warning" sx={{ mt: 1.5 }}>
            {notDownloaded === count ? (count === 1 ? "It isn't" : "None are") : `${notDownloaded} of them aren't`} downloaded to this laptop yet.
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={deleting}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={deleting}>
          {deleting ? "Deleting…" : "Delete"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
