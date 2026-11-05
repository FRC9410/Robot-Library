import { Alert, Snackbar } from "@mui/material";
import type { AutoMessage } from "../types";

type AutoMessageSnackbarProps = {
  message: AutoMessage | null;
  onClose: () => void;
};

/** A short note in the corner after an action, such as a delete that can be undone. Errors stay longer. */
export function AutoMessageSnackbar({ message, onClose }: AutoMessageSnackbarProps) {
  return <Snackbar open={message !== null} autoHideDuration={message?.severity === "error" ? 9000 : 4000} onClose={onClose}
    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}>
    {message ? <Alert severity={message.severity} variant="filled" onClose={onClose}>{message.text}</Alert> : undefined}
  </Snackbar>;
}
