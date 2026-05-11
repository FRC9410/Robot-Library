import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from "@mui/material";

type DeleteSubsystemDialogProps = {
  open: boolean;
  name?: string;
  saving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteSubsystemDialog({ open, name, saving, onCancel, onConfirm }: DeleteSubsystemDialogProps) {
  return (
    <Dialog open={open} onClose={onCancel}>
      <DialogTitle>Delete Subsystem?</DialogTitle>
      <DialogContent>
        <Typography>Delete {name ?? "this subsystem"}?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={onConfirm} disabled={saving}>
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
}
