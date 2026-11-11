import { useState } from "react";
import { Pagination, Stack, Table, TableBody, TableCell, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { TestQuality } from "../../../electron/characterization/types";

type CharacterizationTestDataProps = { quality: TestQuality[] };
const rowsPerPage = 6;

export function CharacterizationTestData({ quality }: CharacterizationTestDataProps) {
  const [page, setPage] = useState(1);
  if (!quality.length) return <Typography variant="body2">No test data was collected for this subsystem.</Typography>;
  const first = (page - 1) * rowsPerPage;
  const pages = Math.ceil(quality.length / rowsPerPage);
  const multipleMotors = new Set(quality.map(test => test.motor)).size > 1;
  return (
    <Stack spacing={1}>
      <Table size="small" aria-label="Characterization test data">
        <TableHead>
          <TableRow>
            <TableCell>Test</TableCell>
            <TableCell align="right">Recorded (s)</TableCell>
            <TableCell align="right">Usable motion (s)</TableCell>
            <TableCell align="right">Usable samples</TableCell>
            <TableCell align="right">Peak speed (rot/s)</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {quality.slice(first, first + rowsPerPage).map(test => (
            <TableRow key={`${test.phase}/${test.motor}`}>
              <TableCell>
                <Stack direction="row" spacing={.75} sx={{ alignItems: "center" }}>
                  <Typography variant="body2" sx={{ textTransform: "capitalize" }}>
                    {test.phase.replaceAll("-", " ")}{multipleMotors ? ` / ${test.motor}` : ""}
                  </Typography>
                  {test.warnings.length > 0 && (
                    <Tooltip title={test.warnings.join(" ")}>
                      <WarningAmberOutlinedIcon fontSize="small" color="warning" tabIndex={0} aria-label={test.warnings.join(" ")} />
                    </Tooltip>
                  )}
                </Stack>
              </TableCell>
              <TableCell align="right">{test.recordedSeconds.toFixed(2)}</TableCell>
              <TableCell align="right">{test.motionSeconds.toFixed(2)}</TableCell>
              <TableCell align="right">{test.usableSamples}</TableCell>
              <TableCell align="right">{test.peakVelocity.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {pages > 1 && <Pagination size="small" count={pages} page={page} onChange={(_event, next) => setPage(next)} aria-label="Test data pages" />}
    </Stack>
  );
}
