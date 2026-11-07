import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle } from "@mui/material";

export function DeleteStateDialog({ name, saving, error, onCancel, onConfirm }: {
  name: string | null; saving: boolean; error: string; onCancel: () => void; onConfirm: () => void;
}) {
  return <Dialog open={name !== null} onClose={() => { if (!saving) onCancel(); }} maxWidth="xs" fullWidth
    aria-labelledby="delete-state-title" aria-describedby="delete-state-description">
    <DialogTitle id="delete-state-title">Delete {name}?</DialogTitle>
    <DialogContent>
      <DialogContentText id="delete-state-description">
        Update Code will delete this state's Java file, including your changes to execute().
        References in other robot code must be removed before generation can finish.
      </DialogContentText>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions>
      <Button disabled={saving} onClick={onCancel}>Cancel</Button>
      <Button color="error" variant="contained" disabled={saving} onClick={onConfirm}>{saving ? "Deleting…" : "Delete State"}</Button>
    </DialogActions>
  </Dialog>;
}
