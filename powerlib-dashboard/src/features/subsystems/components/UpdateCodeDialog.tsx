import { CircularProgress, Dialog, DialogContent, DialogTitle, Stack, Typography } from "@mui/material";

type UpdateCodeDialogProps = {
  open: boolean;
  title?: string;
  message?: string;
};

export function UpdateCodeDialog({ open, title = "Updating Code", message = "Please wait, code is updating." }: UpdateCodeDialogProps) {
  return (
    <Dialog open={open}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center", minWidth: 360, py: 1 }}>
          <CircularProgress size={28} />
          <Typography>{message}</Typography>
        </Stack>
      </DialogContent>
    </Dialog>
  );
}
