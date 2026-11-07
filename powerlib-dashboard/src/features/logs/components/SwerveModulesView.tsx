import { Box, Typography } from "@mui/material";
import { logColors } from "../logUtils";
import { moduleCorners, moduleErrorDegrees, moduleNames, modulesAt, offDegrees } from "../swerveModel";
import type { SwerveModules } from "../swerveModel";
import { WheelArrows } from "./WheelArrows";

type SwerveModulesViewProps = {
  swerve?: SwerveModules;
  time: number;
};

const inset = 0.42;
const labelColor = "rgba(250,250,250,0.7)";

/**
 * The robot from above with its front up: each wheel's arrow for the way it's rolling (solid) and the way it was
 * told to (dashed). A wheel more than `offDegrees` from its target turns red.
 */
export function SwerveModulesView({ swerve, time }: SwerveModulesViewProps) {
  if (!swerve) {
    return <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>No swerve module data in this log.</Typography>;
  }
  const states = modulesAt(swerve.states, time);
  const targets = modulesAt(swerve.targets, time);
  const errors = states?.map((state, index) => (targets?.[index] ? moduleErrorDegrees(state, targets[index]) : null)) ?? [];
  const isOff = (index: number) => (errors[index] ?? 0) > offDegrees;
  return (
    <Box component="svg" viewBox="-1.25 -1.25 2.5 2.5" role="img" aria-label="Swerve wheels, front of the robot up"
      sx={{ flex: 1, minHeight: 0, width: "100%", display: "block" }}>
      <rect x={-0.6} y={-0.6} width={1.2} height={1.2} rx={0.08} fill="rgba(250,204,21,0.08)" stroke={logColors.value} strokeWidth={0.03} />
      <path d="M0 -0.52 L-0.07 -0.4 L0.07 -0.4 Z" fill={logColors.value} />
      <g transform="rotate(-90)">
        {targets && <WheelArrows modules={targets} inset={inset} length={0.42} width={0.035} color={logColors.setpoint} dashed />}
        {states && <WheelArrows modules={states} inset={inset} length={0.42} width={0.05} color={logColors.good}
          colorOf={index => (isOff(index) ? logColors.bad : undefined)} />}
      </g>
      {states?.slice(0, moduleCorners.length).map((state, index) => {
        const [cornerX, cornerY] = moduleCorners[index];
        const front = cornerX > 0;
        const left = cornerY > 0;
        return (
          <text key={index} x={left ? -1.2 : 1.2} y={front ? -0.95 : 1.08} textAnchor={left ? "start" : "end"} fontSize={0.13}
            fill={isOff(index) ? logColors.bad : labelColor}>
            {isOff(index) ? `${moduleNames[index]} ${Math.round(errors[index] ?? 0)}° off` : `${moduleNames[index]} ${Math.abs(state.speed).toFixed(1)} m/s`}
          </text>
        );
      })}
    </Box>
  );
}
