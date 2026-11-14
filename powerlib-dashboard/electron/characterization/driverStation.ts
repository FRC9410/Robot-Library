import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
const execute=promisify(execFile);
// NI FRC DS documented keyboard shortcuts; no fake DS packets or NT hardware enable.
import { driverStationNative } from "./driverStationNative.js";
import { driverStationFailure } from "./driverStationErrors.js";
export function driverStationScript(action: "check" | "enable" | "disable",nativePath="driverStationNative.cs") {
  const script=["$ErrorActionPreference='Stop'", "$ProgressPreference='SilentlyContinue'", "try {",
    "$stations=@(Get-Process -Name DriverStation -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 })",
    "if ($stations.Count -ne 1) { throw 'Open exactly one FRC Driver Station on this Windows computer, in Test mode.' }"];
  script.push(`Add-Type -TypeDefinition ([IO.File]::ReadAllText('${nativePath.replaceAll("'","''")}'))`,
    "$stationProcessId=[uint32]$stations[0].Id",
    "$window=[CharacterizationDsKeys]::ResolveMainWindow($stationProcessId)",
    "[CharacterizationDsKeys]::Focus($window,$stationProcessId)");
  if(action!=="check")script.push(`[CharacterizationDsKeys]::PressForWindow($window,$stationProcessId,[uint16[]]@(${action==="enable"?"219,221,220":"13"}))`);
  script.push("} catch { [Console]::Error.WriteLine('POWERTOOL_DS_ERROR: '+$_.Exception.GetBaseException().Message); exit 1 }");
  return script.join("\n");
}
export async function controlDriverStation(action: "check" | "enable" | "disable") {
  if(process.platform!=="win32")throw Error("Driver Station control needs the FRC Driver Station on this Windows computer.");
  const tempRoot=path.resolve(os.tmpdir()),folder=await fs.mkdtemp(path.join(tempRoot,"power-tool-ds-"));
  const nativePath=path.join(folder,"driverStationNative.cs"),scriptPath=path.join(folder,"driverStation.ps1");
  try {
    await Promise.all([fs.writeFile(nativePath,driverStationNative),fs.writeFile(scriptPath,driverStationScript(action,nativePath))]);
    await execute("powershell.exe",["-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-File",scriptPath],{windowsHide:true,timeout:10000});
  }
  catch(caught) { throw Error(driverStationFailure(caught)); }
  finally { if(path.dirname(folder)===tempRoot&&path.basename(folder).startsWith("power-tool-ds-"))await fs.rm(folder,{recursive:true,force:true}).catch(()=>{}); }
}
