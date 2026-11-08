import { useState } from "react";
import { Button } from "@mui/material";
import ScienceOutlinedIcon from "@mui/icons-material/ScienceOutlined";
import type { GeneratedSubsystem } from "../subsystems/types";
import { CharacterizationDialog } from "./CharacterizationDialog";
type CharacterizeSubsystemsButtonProps={subsystems:GeneratedSubsystem[]};
export function CharacterizeSubsystemsButton({subsystems}:CharacterizeSubsystemsButtonProps){
  const [open,setOpen]=useState(false);
  return <><Button variant="outlined" startIcon={<ScienceOutlinedIcon/>} onClick={()=>setOpen(true)}>Characterize Subsystems</Button>
    {open&&<CharacterizationDialog open onClose={()=>setOpen(false)} subsystems={subsystems}/>}</>;
}
