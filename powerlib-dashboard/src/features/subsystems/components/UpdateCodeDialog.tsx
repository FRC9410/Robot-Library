import { CircularProgress, Dialog, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

type UpdateCodeDialogProps = {
  open: boolean;
};

export function UpdateCodeDialog({ open }: UpdateCodeDialogProps) {
  return (
    <Dialog open={open}>
      <DialogTitle>Updating Code</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 360, py: 1 }}>
          <CircularProgress size={28} />
          <Typography>Please wait, code is updating.</Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
