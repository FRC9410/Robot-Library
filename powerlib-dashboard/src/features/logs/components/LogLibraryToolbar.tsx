import { Box, Chip, IconButton, InputAdornment, Stack, TextField, Tooltip, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import type { ReactNode } from "react";
import type { LogFilter } from "../logLibraryModel";

type LogLibraryToolbarProps = {
  filter: LogFilter;
  search: string;
  listing: boolean;
  onFilter: (filter: LogFilter) => void;
  onSearch: (search: string) => void;
  onRefresh: () => void;
  /** Extra controls on the right, like the drawer's close button. */
  action?: ReactNode;
};

const filters: { value: LogFilter; label: string }[] = [
  { value: "matches", label: "Matches" },
  { value: "practice", label: "Practice" },
  { value: "all", label: "All" }
];

/** Two rows: the title with refresh and `action` (the close button) on the right, then the filter and search. */
export function LogLibraryToolbar({ filter, search, listing, onFilter, onSearch, onRefresh, action }: LogLibraryToolbarProps) {
  return (
    <Stack spacing={1} sx={{ flexShrink: 0 }}>
      <Stack direction="row" sx={{ alignItems: "center", gap: 0.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800, flex: 1 }}>Robot logs</Typography>
        <Tooltip title="Look for new logs">
          <span><IconButton size="small" onClick={onRefresh} disabled={listing} aria-label="Look for new logs"><RefreshIcon fontSize="small" /></IconButton></span>
        </Tooltip>
        {action}
      </Stack>
      <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
        {filters.map(item => (
          <Chip key={item.value} size="small" label={item.label} onClick={() => onFilter(item.value)}
            color={item.value === filter ? "primary" : "default"} variant={item.value === filter ? "filled" : "outlined"} />
        ))}
        <Box sx={{ flex: 1 }} />
        <TextField size="small" placeholder="Search" value={search} onChange={event => onSearch(event.target.value)}
          sx={{ width: 200, "& input": { py: 0.6, fontSize: 13 } }}
          slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> } }} />
      </Stack>
    </Stack>
  );
}
