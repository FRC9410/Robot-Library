import { Typography } from "@mui/material";
import { averageAt } from "../logModel";
import type { LogMotor } from "../logModel";
import { formatNumber } from "../logUtils";

type PowerMotorRowProps = {
  motor: LogMotor;
  time: number;
};

/** One motor under an open subsystem row: its supply current and temperature (0.5 s averages). */
export function PowerMotorRow({ motor, time }: PowerMotorRowProps) {
  const current = motor.signals.SupplyCurrent;
  const temp = motor.signals.DeviceTemp;
  const cell = (text: string) => (
    <Typography variant="caption" color="text.secondary" noWrap title={text} sx={{ fontVariantNumeric: "tabular-nums" }}>{text}</Typography>
  );
  return (
    <>
      <span />
      {cell(motor.label)}
      {cell(current ? `${formatNumber(averageAt(current, time), 1)} A` : "–")}
      {cell(temp ? `${formatNumber(averageAt(temp, time), 0)} °C` : "–")}
    </>
  );
}
