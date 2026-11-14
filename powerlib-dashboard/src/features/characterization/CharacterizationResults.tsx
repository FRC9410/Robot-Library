import { useState } from "react";
import { Alert, Box, Button, MenuItem, Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tooltip, Typography } from "@mui/material";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import type { Gain, Report } from "../../../electron/characterization/types";
import { positionStops, resolveTargetLimits } from "../../../electron/characterization/limits";
import { CharacterizationTestData } from "./CharacterizationTestData";

type CharacterizationResultsProps = { report: Report };
type ResultRow = { id: string; name: string; error: string } | { id: string; name: string; gain: Gain };

const format = (value: number) => Number.isFinite(value) ? value.toPrecision(6) : "Unavailable";

export function CharacterizationResults({ report }: CharacterizationResultsProps) {
  const [targetId, setTargetId] = useState(report.targets[0].id);
  const [showTestData, setShowTestData] = useState(false);
  const rows = report.results.flatMap<ResultRow>(result => result.error
    ? [{ id: result.target.id, name: result.target.name, error: result.error }]
    : result.gains.map(gain => ({ id: `${result.target.id}/${gain.name}`, name: `${result.target.name} / ${gain.name}`, gain })));
  const target = report.targets.find(item => item.id === targetId) ?? report.targets[0];
  const { duration, ramp, rampLimit, step } = resolveTargetLimits(report.settings, target);
  const { settle, medianWindow, positionTest } = report.settings;
  const stops = positionTest && positionStops(positionTest);
  const runSettings = [
    ["Test duration", `${duration} s`],
    ["Ramp", `${ramp} V/s`],
    ["Ramp ceiling", `${rampLimit} V`],
    ["Dynamic step", `${step} V`],
    ["Disabled gap", `${settle} s`],
    ["Median window", `${medianWindow} ${medianWindow === 1 ? "sample" : "samples"}`]
  ];

  return (
    <Stack spacing={1} sx={{ minHeight: 0 }}>
      {report.storageWarning && <Alert severity="warning">{report.storageWarning}</Alert>}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="subtitle2" id="characterization-run-settings">Run settings</Typography>
        {report.targets.length > 1 && (
          <Select size="small" value={target.id} inputProps={{ "aria-label": "Report subsystem" }}
            onChange={event => setTargetId(event.target.value)} sx={{ maxWidth: "40%" }}>
            {report.targets.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
          </Select>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
          {target.kind === "velocityTorque" ? "Voltage-driven test · Measured torque current fit" : "Voltage-driven test · Measured voltage fit"}
        </Typography>
        <Button size="small" onClick={() => setShowTestData(current => !current)}>
          {showTestData ? "Show gains" : "Show test data"}
        </Button>
      </Stack>
      <Box component="dl" aria-labelledby="characterization-run-settings"
        sx={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 1.5, m: 0, px: 1.5, py: 1, bgcolor: "action.hover", borderRadius: 1 }}>
        {runSettings.map(([label, value]) => (
          <Box key={label}>
            <Typography component="dt" variant="caption" color="text.secondary">{label}</Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0 }}>{value}</Typography>
          </Box>
        ))}
      </Box>
      {positionTest && stops && <Typography variant="body2">
        {positionTest.model === "arm" ? "Arm" : "Elevator"} · Window {positionTest.lower} to {positionTest.upper} rot · Stops {stops.lowerStop} and {stops.upperStop} rot · Speed cutoff {positionTest.speedLimit} rot/s
        {positionTest.model === "arm" && ` · Horizontal ${positionTest.horizontal} rot`}
      </Typography>}
      {showTestData ? <CharacterizationTestData key={target.id} quality={report.results.find(result => result.target.id === target.id)?.testQuality ?? []} />
        : rows.length > 0 ? (
        <TableContainer role="region" aria-label="Scrollable gains table" tabIndex={0} sx={{ maxHeight: 280, minHeight: 0, overflowY: "auto" }}>
          <Table size="small" stickyHeader aria-label="Characterization results" sx={{ tableLayout: "fixed", "& .MuiTableCell-stickyHeader": { bgcolor: "background.paper" } }}>
            <TableHead>
              <TableRow>
                {["Subsystem / motor", "Output", "kS", "kV", "kA", ...(positionTest ? ["kG"] : []), "R²"].map((label, index) => (
                  <TableCell key={label} sx={{ width: index === 0 ? "36%" : undefined }}>{label}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Stack direction="row" spacing={.75} sx={{ alignItems: "center" }}>
                      <Typography variant="body2" noWrap title={row.name}>{row.name}</Typography>
                      {"gain" in row && row.gain.warnings.length > 0 && (
                        <Tooltip title={row.gain.warnings.join(" ")}>
                          <WarningAmberOutlinedIcon fontSize="small" color="warning" tabIndex={0}
                            aria-label={row.gain.warnings.join(" ")} />
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                  {"error" in row ? (
                    <TableCell colSpan={positionTest ? 6 : 5}><Typography variant="body2" noWrap title={row.error}>{row.error}</Typography></TableCell>
                  ) : (
                    <>
                      <TableCell>{row.gain.outputUnit}</TableCell>
                      <TableCell>{format(row.gain.kS)}</TableCell>
                      <TableCell>{format(row.gain.kV)}</TableCell>
                      <TableCell>{format(row.gain.kA)}</TableCell>
                      {positionTest && <TableCell>{format(row.gain.kG ?? NaN)}</TableCell>}
                      <TableCell>{row.gain.rSquared.toFixed(3)}</TableCell>
                    </>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      ) : <Typography variant="body2">No gains were calculated for this run.</Typography>}
      <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
        <Typography variant="body2" noWrap title={report.path} sx={{ flex: 1 }}>Saved report: {report.path}</Typography>
        <Button size="small" onClick={() => void navigator.clipboard.writeText(report.path)} sx={{ flexShrink: 0 }}>Copy report path</Button>
      </Stack>
    </Stack>
  );
}
