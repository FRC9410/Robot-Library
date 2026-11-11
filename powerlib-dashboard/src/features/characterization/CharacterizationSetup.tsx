import { useState } from "react";
import type { ReactNode } from "react";
import { Alert, Box, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Pagination, Select, Stack, Typography } from "@mui/material";
import type { CharacterizationSubsystemType, useCharacterization } from "./useCharacterization";
import { PositionCrawlSetup } from "./PositionCrawlSetup";
import { CharacterizationSettings } from "./CharacterizationSettings";

type CharacterizationSetupProps = {
  run: Pick<ReturnType<typeof useCharacterization>,
    "subsystemType" | "changeSubsystemType" | "options" | "picked" | "setPicked" | "settings" | "setSettings" | "ready" | "setReady" | "robot" | "connected" | "supported" | "controlMode" | "startPosition">;
  control: string;
  errorNotice: ReactNode;
  drivetrain: boolean;
};

const targetsPerPage = 6;

export function CharacterizationSetup({ run, control, errorNotice, drivetrain }: CharacterizationSetupProps) {
  const [page, setPage] = useState(1);
  const pages = Math.max(1, Math.ceil(run.options.length / targetsPerPage));
  const currentPage = Math.min(page, pages);
  const first = (currentPage - 1) * targetsPerPage;
  const needsTestMode = run.controlMode === "driver-station" && run.robot && (!run.robot.test || run.robot.enabled);
  const guidance = !run.connected || !run.supported ? "Connect to a robot or simulation built with current PowerLib characterization support."
    : needsTestMode ? "Set the FRC Driver Station to Test mode and Disabled before starting." : null;

  const subsystemTypePicker = (
    <FormControl fullWidth size="small">
      <InputLabel id="characterization-subsystem-type">Subsystem types</InputLabel>
      <Select labelId="characterization-subsystem-type" label="Subsystem types" value={run.subsystemType}
        inputProps={{ "aria-label": "Subsystem types" }}
        onChange={event => { setPage(1); run.changeSubsystemType(event.target.value as CharacterizationSubsystemType); }}>
        <MenuItem value="allVelocity">All velocity subsystems</MenuItem>
        <MenuItem value="velocity">Velocity</MenuItem>
        <MenuItem value="velocityTorque">Velocity torque</MenuItem>
        <MenuItem value="drivetrain">Drivetrain</MenuItem>
        <MenuItem value="positionCrawl">Arms &amp; elevators</MenuItem>
      </Select>
    </FormControl>
  );

  if (run.subsystemType === "positionCrawl") return (
    <Stack spacing={1.5}>
      <Alert severity="warning">Clear the travel area. Crawl and SysId remove motor output at the test limits. Verify the mechanism can stop safely with output removed.</Alert>
      <Box sx={{ maxWidth: 360 }}>{subsystemTypePicker}</Box>
      <PositionCrawlSetup onStart={run.startPosition} />
      {errorNotice}
    </Stack>
  );

  return (
    <Stack spacing={1.5}>
      <Alert severity="warning">
        {drivetrain
          ? "Start disabled and clear the drive path and steering modules. You enable and disable each drive test. Steering enables and disables automatically on its own or after all selected drive tests."
          : "The robot will move. Clear each mechanism’s travel. On hardware or in Sim with DS, open FRC Driver Station on this computer in Test mode and Disabled. Disabling during a test or E-stopping cancels the sequence."}
      </Alert>
      <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 3 }}>
        <Stack spacing={1.5}>
          {subsystemTypePicker}
          {run.options.length === 0 && <Typography variant="body2">{drivetrain ? "No drivetrain tests are available." : "No velocity subsystems are configured."}</Typography>}
          <Stack>
            {run.options.slice(first, first + targetsPerPage).map(option => (
              <FormControlLabel key={option.id} sx={{ minWidth: 0, mr: 0 }}
                control={<Checkbox size="small" sx={{ py: .5 }} checked={run.picked.includes(option.id)}
                  onChange={event => run.setPicked(event.target.checked ? [...run.picked, option.id] : run.picked.filter(id => id !== option.id))} />}
                label={<Typography variant="body2" noWrap title={option.name}>{option.name}{drivetrain ? "" : ` (${option.kind})`}</Typography>}
                slotProps={{ typography: { sx: { minWidth: 0 } } }}
              />
            ))}
          </Stack>
          {pages > 1 && <Pagination size="small" count={pages} page={currentPage} onChange={(_event, next) => setPage(next)} aria-label="Subsystem pages" />}
          {run.robot && <Typography variant="body2">Enable/disable control: {control}</Typography>}
          {errorNotice || (guidance && <Alert severity="info">{guidance}</Alert>)}
        </Stack>
        <Stack spacing={1}>
          <CharacterizationSettings value={run.settings} onChange={run.setSettings} />
          <FormControlLabel control={<Checkbox size="small" sx={{ py: .5 }} checked={run.ready} onChange={event => run.setReady(event.target.checked)} />}
            label={drivetrain ? "The robot is disabled and the test area is clear." : "The robot and test area are ready for automatic enable/disable and characterization."} />
        </Stack>
      </Box>
    </Stack>
  );
}
