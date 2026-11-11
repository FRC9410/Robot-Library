import { useEffect, useMemo, useRef, useState } from "react";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import type { GeneratedSubsystem } from "../subsystems/types";
import type { Report, RobotStatus, Settings, Target } from "../../../electron/characterization/types";
import { runCharacterization } from "./runCharacterization";
import type { ManualStep } from "./runCharacterization";
import { characterizationControlMode, readCharacterizationCatalog, readCharacterizationStatus } from "./characterizationModel";
import { defaultSettings } from "../../../electron/characterization/limits";
export type CharacterizationSubsystemType = "allVelocity" | "velocity" | "velocityTorque" | "drivetrain" | "positionCrawl";

export function useCharacterization(subsystems:GeneratedSubsystem[]) {
  const [subsystemType,setSubsystemType]=useState<CharacterizationSubsystemType>("allVelocity");
  const drivetrain=subsystemType==="drivetrain";
  const matchesVelocityType=(kind: string | undefined)=> (kind==="velocity"||kind==="velocityTorque") && (subsystemType==="allVelocity"||subsystemType===kind);
  const topics=useTopics("app"),network=useNetworkTables();
  const statusTopic=topics.find(topic=>topic.name==="/PowerLib/Characterization/status");
  const robot=readCharacterizationStatus(statusTopic?.value);
  const catalog=readCharacterizationCatalog(topics.find(topic=>topic.name==="/PowerLib/Characterization/catalog")?.value)
    .filter(target=>drivetrain ? target.kind==="drive"||target.kind==="steer" : matchesVelocityType(target.kind));
  const velocityOptions=useMemo(()=>subsystems.filter(item=>item.id&&item.name&&(item.type==="velocity"||item.type==="velocityTorque"))
    .map(item=>({id:item.id!,name:item.name!,kind:item.type!})),[subsystems]);
  const options=drivetrain?catalog:velocityOptions.filter(option=>matchesVelocityType(option.kind));
  const [picked,setPicked]=useState<string[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const manualDrive=drivetrain&&catalog.some(target=>target.kind==="drive"&&picked.includes(target.id));
  const [settings,setSettings]=useState<Settings>(defaultSettings);
  const [progress,setProgress]=useState(""),[report,setReport]=useState<Report|null>(null),[error,setError]=useState<string|null>(null);
  const [manualStep,setManualStep]=useState<ManualStep|null>(null);
  const armRequested=useRef(false);
  const current=useRef({connected:false,host:"",status:null as RobotStatus|null,receivedAt:0});
  current.current={connected:network.status==="connected",host:network.connectionSettings.host,status:robot,receivedAt:statusTopic?.receivedAt??0};
  const abort=useRef<AbortController|null>(null);useEffect(()=>()=>abort.current?.abort(),[]);
  function prepareNextRun(){setReady(false);setReport(null);setError(null);setProgress("");setManualStep(null);}
  function reset(){setPicked([]);prepareNextRun();}
  function changeSubsystemType(next:CharacterizationSubsystemType){
    if(next===subsystemType)return;
    if((next==="drivetrain")!==drivetrain)setSettings(next==="drivetrain"?{...defaultSettings,duration:3}:defaultSettings);
    reset();
    setSubsystemType(next);
  }
  async function start(){
    if(abort.current||!ready)return;
    const selectionKey=(target:typeof catalog[number])=>drivetrain?target.id:target.group;
    const targets=catalog.filter(target=>picked.includes(selectionKey(target)));
    if(!targets.length||picked.some(id=>!targets.some(target=>selectionKey(target)===id))){setError("Rebuild the robot with current PowerLib characterization support for all selected subsystems.");return;}
    await runTests(targets, settings, drivetrain);
  }
  async function startPosition(targetId: string, positionSettings: Settings) {
    const target = readCharacterizationCatalog(topics.find(topic=>topic.name==="/PowerLib/Characterization/catalog")?.value)
      .find(item => item.kind === "position" && item.id === targetId);
    if (!target) { setError("This mechanism is missing from the robot’s SysId catalog. Rebuild and restart the robot."); return; }
    await runTests([target], positionSettings, true);
  }
  async function runTests(targets: Target[], runSettings: Settings, manual: boolean) {
    if (abort.current) return;
    const bridge=window.powerlib;
    if(!bridge?.startCharacterization){setError("Characterization requires the desktop Power Tool app.");return;}
    const controller=new AbortController();abort.current=controller;setBusy(true);setError(null);setReport(null);setManualStep(null);
    try{
      const result=await runCharacterization({api:{start:bridge.startCharacterization,collect:bridge.collectCharacterization,diagnostic:bridge.recordCharacterizationDiagnostic,finish:bridge.finishCharacterization,driver:bridge.controlCharacterizationDriverStation},
        publish:async(name,type,value)=>{if(type==="string")await network.clientRef.current.publish(name,type,String(value));else await network.clientRef.current.publish(name,type,Number(value));},
        observe:()=>current.current,now:()=>performance.now(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),uuid:()=>crypto.randomUUID()},
        targets,runSettings,controller.signal,setProgress,manual?{
          update(step){if(step?.state==="arm")armRequested.current=false;setManualStep(step);},
          armRequested:()=>armRequested.current
        }:undefined);
      setReport(result);setProgress(result.outcome==="complete"?"Characterization complete.":"Characterization stopped.");
      if(result.error)setError(result.error);
    }catch(caught){setError(caught instanceof Error?caught.message:String(caught));}
    finally{abort.current=null;setBusy(false);}
  }
  return {subsystemType,changeSubsystemType,options,picked,setPicked,ready,setReady,busy,settings,setSettings,progress,report,error,robot,controlMode:characterizationControlMode(robot),connected:network.status==="connected",
    supported:catalog.length>0&&(!manualDrive||robot?.manualDrivetrain===true),manualDrive,manualStep,arm:()=>{armRequested.current=true;},reset,prepareNextRun,start,startPosition,stop:()=>abort.current?.abort()};
}
