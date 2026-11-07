import { Box, Link, Stack, Typography } from "@mui/material";
import FolderOutlinedIcon from "@mui/icons-material/FolderOutlined";

type LogFolderBarProps = {
  folder: string;
  onChangeFolder: () => void;
  onOpenFile: () => void;
};

/** The bottom line of the logs list: which folder it reads, and the way out to any other file. */
export function LogFolderBar({ folder, onChangeFolder, onOpenFile }: LogFolderBarProps) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, flexShrink: 0, color: "text.secondary" }}>
      <FolderOutlinedIcon sx={{ fontSize: 16 }} />
      <Typography variant="caption" noWrap sx={{ fontFamily: "monospace", minWidth: 0 }} title={folder}>{folder || "No folder"}</Typography>
      <Link component="button" variant="caption" onClick={onChangeFolder} underline="hover">Change</Link>
      <Box sx={{ flex: 1 }} />
      <Link component="button" variant="caption" onClick={onOpenFile} underline="hover" sx={{ whiteSpace: "nowrap" }}>Open another file</Link>
    </Stack>
  );
}
