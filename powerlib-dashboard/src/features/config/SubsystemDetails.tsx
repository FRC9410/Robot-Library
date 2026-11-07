import {Box} from "@mui/material";
import type {GeneratedSubsystem} from "../subsystems/types";
import {DetailsGroup} from "./DetailsGroup";
import {label} from "./configDetailsModel";
export function SubsystemDetails({ subsystem }: { subsystem: GeneratedSubsystem }) {
  const rows = Object.entries(subsystem).filter(([key, value]) => key !== "id" && !key.startsWith("source") && (value === null || typeof value !== "object"));
  const groups = Object.entries(subsystem).filter(([, value]) => value && typeof value === "object");
  return <Box className="config-details">
    <DetailsGroup title="General" rows={rows} />
    {groups.map(([key, value]) => key === "motors"
      ? (value as NonNullable<GeneratedSubsystem["motors"]>).map((motor, index) => <DetailsGroup key={`motor-${index}`} title={index === 0 ? "Leader motor" : `Follower motor ${index}`} rows={Object.entries(motor).map(([name, item]) => [name === "id" ? "CAN ID" : name, item])} />)
      : <DetailsGroup key={key} title={label(key)} rows={Object.entries(value)} />)}
  </Box>;
}
