import { Stack } from "@mui/material";
import type { GeneratedSubsystem } from "../subsystems/types";
import { CharacterizeRobotButton } from "../characterization/CharacterizeRobotButton";
import { LogsContent } from "./LogsContent";
type LogsPanelProps={active:boolean;subsystems:GeneratedSubsystem[]};
export function LogsPanel({active,subsystems}:LogsPanelProps){
  return <Stack spacing={1.5} sx={{flex:1,minHeight:0}}><Stack direction="row" sx={{justifyContent:"flex-end"}}><CharacterizeRobotButton subsystems={subsystems}/></Stack>
    <LogsContent active={active} subsystems={subsystems}/></Stack>;
}
