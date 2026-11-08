import { useEffect, useMemo, useRef, useState } from "react";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import type { GeneratedSubsystem } from "../subsystems/types";
import type { Report, RobotStatus, Settings } from "../../../electron/characterization/types";
import { runCharacterization } from "./runCharacterization";
import { characterizationControlMode, readCharacterizationCatalog, readCharacterizationStatus } from "./characterizationModel";
export function useCharacterization(subsystems:GeneratedSubsystem[]) {
  const topics=useTopics("app"),network=useNetworkTables();
  const statusTopic=topics.find(topic=>topic.name==="/PowerLib/Characterization/status");
  const robot=readCharacterizationStatus(statusTopic?.value);
  const catalog=readCharacterizationCatalog(topics.find(topic=>topic.name==="/PowerLib/Characterization/catalog")?.value);
  const options=useMemo(()=>[
    ...subsystems.filter(item=>["velocity","velocityTorque"].includes(item.type||"")).map(item=>({id:item.id!,name:item.name!,kind:item.type!})),
    {id:"drivetrain",name:"Drivetrain",kind:"drive + steering"}
  ],[subsystems]);
  const [picked,setPicked]=useState<string[]>([]),[ready,setReady]=useState(false),[busy,setBusy]=useState(false);
  const [settings,setSettings]=useState<Settings>({duration:3,ramp:1,step:4,settle:1,medianWindow:5});
  const [progress,setProgress]=useState(""),[report,setReport]=useState<Report|null>(null),[error,setError]=useState<string|null>(null);
  const current=useRef({connected:false,host:"",status:null as RobotStatus|null,receivedAt:0});
  current.current={connected:network.status==="connected",host:network.connectionSettings.host,status:robot,receivedAt:statusTopic?.receivedAt??0};
  const abort=useRef<AbortController|null>(null);useEffect(()=>()=>abort.current?.abort(),[]);
  function reset(){setPicked([]);setReady(false);setReport(null);setError(null);setProgress("");}
  async function start(){
    if(abort.current||!ready)return;
    const targets=catalog.filter(target=>picked.includes(target.group));
    if(!targets.length||picked.some(id=>!targets.some(target=>target.group===id))){setError("Rebuild the robot with current PowerLib characterization support for all selected subsystems.");return;}
    const bridge=window.powerlib;
    if(!bridge?.startCharacterization){setError("Characterization requires the desktop Power Tool app.");return;}
    const controller=new AbortController();abort.current=controller;setBusy(true);setError(null);setReport(null);
    try{
      const result=await runCharacterization({api:{start:bridge.startCharacterization,collect:bridge.collectCharacterization,diagnostic:bridge.recordCharacterizationDiagnostic,finish:bridge.finishCharacterization,driver:bridge.controlCharacterizationDriverStation},
        publish:async(name,type,value)=>{if(type==="string")await network.clientRef.current.publish(name,type,String(value));else await network.clientRef.current.publish(name,type,Number(value));},
        observe:()=>current.current,now:()=>performance.now(),sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),uuid:()=>crypto.randomUUID()},targets,settings,controller.signal,setProgress);
      setReport(result);setProgress(result.outcome==="complete"?"Characterization complete.":"Characterization stopped.");
      if(result.error)setError(result.error);
    }catch(caught){setError(caught instanceof Error?caught.message:String(caught));}
    finally{abort.current=null;setBusy(false);}
  }
  return {options,picked,setPicked,ready,setReady,busy,settings,setSettings,progress,report,error,robot,controlMode:characterizationControlMode(robot),connected:network.status==="connected",supported:catalog.length>0,reset,start,stop:()=>abort.current?.abort()};
}
