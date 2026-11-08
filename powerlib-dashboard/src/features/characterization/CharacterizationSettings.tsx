import { Stack, TextField } from "@mui/material";
import type { Settings } from "../../../electron/characterization/types";
type CharacterizationSettingsProps={value:Settings;disabled:boolean;onChange:(value:Settings)=>void};
export function CharacterizationSettings({value,disabled,onChange}:CharacterizationSettingsProps){
  return <Stack direction="row" sx={{pt:1,flexWrap:"wrap",gap:1.5}}>{([
    ["duration","Test duration (s)",.5,10],["ramp","Ramp (V/s)",.1,2],["step","Voltage limit / step (V)",.1,6],["settle","Disabled gap (s)",.2,10],["medianWindow","Median window",1,9]
  ] as const).map(([key,label,min,max])=><TextField key={key} label={label} type="number" size="small" value={value[key]} disabled={disabled}
    sx={{width:150}} slotProps={{htmlInput:{min,max,step:key==="medianWindow"?2:.1}}} onChange={event=>onChange({...value,[key]:Number(event.target.value)})}/> )}</Stack>;
}
