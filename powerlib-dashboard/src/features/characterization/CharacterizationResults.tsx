import { Alert, Stack, Table, TableBody, TableCell, TableHead, TableRow, Typography } from "@mui/material";
import type { Report } from "../../../electron/characterization/types";
type CharacterizationResultsProps={report:Report};
const format=(value:number)=>Number.isFinite(value)?value.toPrecision(6):"Unavailable";
export function CharacterizationResults({report}:CharacterizationResultsProps){
  return <Stack spacing={1}>{report.simulation&&<Alert severity="info">Simulation results describe the simulation model; characterize the physical mechanism before using hardware gains.</Alert>}
    {report.storageWarning&&<Alert severity="warning">{report.storageWarning}</Alert>}
    <Table size="small" aria-label="Characterization results"><TableHead><TableRow>{["Subsystem / motor","Output","kS","kV","kA","R²"].map(label=><TableCell key={label}>{label}</TableCell>)}</TableRow></TableHead>
      <TableBody>{report.results.map(result=>result.error?<TableRow key={result.target.id}><TableCell>{result.target.name}</TableCell><TableCell colSpan={5}>{result.error}</TableCell></TableRow>:
        result.gains.map(gain=><TableRow key={result.target.id+gain.name}><TableCell>{result.target.name} / {gain.name}</TableCell><TableCell>{gain.outputUnit}</TableCell>
          <TableCell>{format(gain.kS)}</TableCell><TableCell>{format(gain.kV)}</TableCell><TableCell>{format(gain.kA)}</TableCell><TableCell>{gain.rSquared.toFixed(3)}</TableCell></TableRow>))}</TableBody></Table>
    <Typography variant="caption">Velocity: rotations/s. Acceleration: rotations/s². Velocity-torque results use amps; other results use volts. Gains are reported, not automatically applied.</Typography>
    {report.results.flatMap(result=>result.gains.flatMap(gain=>gain.warnings.map(warning=><Alert severity="warning" key={result.target.id+gain.name+warning}>{result.target.name}: {warning}</Alert>)))}
    <Typography variant="body2" sx={{overflowWrap:"anywhere"}}>Saved report: {report.path}</Typography>
  </Stack>;
}
