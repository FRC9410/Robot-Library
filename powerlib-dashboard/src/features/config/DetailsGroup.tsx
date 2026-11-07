import {Box,Typography} from "@mui/material";
import {label,valueText} from "./configDetailsModel";
export function DetailsGroup({ title, rows }: { title: string; rows: [string, unknown][] }) {
  return <Box className="config-detail-group">
    <Typography component="h4" variant="subtitle2">{title}</Typography>
    <Box component="dl">
      {rows.map(([key, value]) => <Box key={key} className="config-detail-row">
        <Typography component="dt" variant="body2" color="text.secondary">{label(key)}</Typography>
        <Typography component="dd" variant="body2">{valueText(value)}</Typography>
      </Box>)}
    </Box>
  </Box>;
}
