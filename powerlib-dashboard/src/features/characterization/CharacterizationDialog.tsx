import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, LinearProgress, Stack, Typography } from "@mui/material";
import type { GeneratedSubsystem } from "../subsystems/types";
import { useCharacterization } from "./useCharacterization";
import { CharacterizationSettings } from "./CharacterizationSettings";
import { CharacterizationResults } from "./CharacterizationResults";
type CharacterizationDialogProps={open:boolean;onClose:()=>void;subsystems:GeneratedSubsystem[]};
export function CharacterizationDialog({open,onClose,subsystems}:CharacterizationDialogProps){
  const run=useCharacterization(subsystems);
  const valid=Number.isFinite(run.settings.duration+run.settings.ramp+run.settings.step+run.settings.settle)&&run.settings.duration>=.5&&run.settings.duration<=10&&run.settings.ramp>=.1&&run.settings.ramp<=2&&run.settings.step>=.1&&run.settings.step<=6&&run.settings.settle>=.2&&run.settings.settle<=10&&[1,3,5,7,9].includes(run.settings.medianWindow);
  function close(){if(!run.busy){run.reset();onClose();}}
  return <Dialog open={open} onClose={close} maxWidth="md" fullWidth><DialogTitle>Characterize Subsystems</DialogTitle><DialogContent dividers><Stack spacing={2}>
    <Typography>Select subsystems to run slow forward/reverse and voltage-step forward/reverse tests. Drivetrain runs both drive and steering motors.</Typography>
    <Stack>{run.options.map(option=><FormControlLabel key={option.id} control={<Checkbox disabled={run.busy} checked={run.picked.includes(option.id)} onChange={event=>run.setPicked(event.target.checked?[...run.picked,option.id]:run.picked.filter(id=>id!==option.id))}/>} label={`${option.name} (${option.kind})`}/>)}</Stack>
    <CharacterizationSettings value={run.settings} disabled={run.busy} onChange={run.setSettings}/>
    <Alert severity="warning">The robot will move. On hardware or in Sim with DS, open FRC Driver Station on this Windows computer, select Test mode and start disabled. Clear mechanism travel and allow drivetrain movement. Disabling during a test or E-stopping in Driver Station cancels the sequence.</Alert>
    {run.robot&&<Typography variant="body2">Enable/disable control: {run.controlMode==="driver-station"?`FRC Driver Station${run.robot.simulation?" (simulation)":""}`:run.controlMode==="simulation"?"Internal simulation":"Unavailable — rebuild and restart simulation with current PowerLib."}</Typography>}
    <FormControlLabel control={<Checkbox checked={run.ready} disabled={run.busy} onChange={event=>run.setReady(event.target.checked)}/>} label="The robot and test area are ready for automatic enable/disable and characterization."/>
    {(!run.connected||!run.supported)&&<Alert severity="info">Connect to a robot or simulation built with current PowerLib characterization support.</Alert>}
    {run.controlMode==="driver-station"&&run.robot&&(!run.robot.test||run.robot.enabled)&&<Alert severity="info">Set the FRC Driver Station to Test mode and Disabled before starting.</Alert>}
    {run.error&&<Alert severity="error">{run.error}</Alert>}{run.busy&&<LinearProgress/>}{run.progress&&<Typography role="status">{run.progress}</Typography>}
    {run.report&&<CharacterizationResults report={run.report}/>}
  </Stack></DialogContent><DialogActions>{run.busy?<Button color="error" onClick={run.stop}>Stop characterization</Button>:<><Button onClick={close}>Close</Button><Button variant="contained" onClick={()=>void run.start()} disabled={!run.ready||!run.picked.length||!run.connected||!run.supported||!valid||!run.robot||!run.controlMode||run.robot.enabled||run.robot.fms||run.robot.estop||(run.controlMode==="driver-station"&&!run.robot.test)}>Start characterization</Button></>}</DialogActions></Dialog>;
}
