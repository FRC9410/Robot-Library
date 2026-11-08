import type { Gain, Sample, TestRecord, Result, Target } from "./types.js";
/** SysId simple-motor acceleration OLS: a=alpha*v+beta*u+gamma*sign(v).
 * kS=-gamma/beta, kV=-alpha/beta, kA=1/beta. See allwpilib v2026.2.1 FeedforwardAnalysis.cpp.
 * Filter/window choices are recorded; GUI automatic trimming is not silently applied.
 */
export function fitGains(name: string, runs: Sample[][], outputUnit: "V" | "A", medianWindow: number): Gain {
  const rows: number[][] = [], acceleration: number[] = [];
  for (const run of runs) {
    if (run.length < 12) throw Error("Insufficient samples; each test must contain motion data.");
    const velocities = run.map((_, i) => {
      const values = Array.from({length:medianWindow}, (_, j) => run[Math.max(0, Math.min(run.length-1, i+j-Math.floor(medianWindow/2)))].velocity).sort((a,b)=>a-b);
      return values[Math.floor(values.length/2)];
    });
    const maxVelocity = Math.max(...velocities.map(Math.abs));
    if (maxVelocity < 1e-5) throw Error("No measurable motion was recorded.");
    for (let i=1;i<run.length-1;i++) {
      const point=run[i],dt=run[i+1].time-run[i-1].time;
      if (dt<=0 || dt>.15 || Math.abs(velocities[i])<Math.max(1e-5,maxVelocity*.005)) continue;
      const input=outputUnit==="A"?point.current:point.voltage,a=(velocities[i+1]-velocities[i-1])/dt;
      if (![input,point.position,velocities[i],a].every(Number.isFinite)) throw Error("Non-finite log samples.");
      rows.push([velocities[i],input,Math.sign(velocities[i])]); acceleration.push(a);
    }
  }
  if(rows.length<30)throw Error("Insufficient usable samples.");
  const columns=[0,1,2].map(j=>rows.map(row=>row[j]));
  const scales=columns.map(column=>Math.sqrt(column.reduce((sum,value)=>sum+value*value,0)));
  const q:number[][]=[],upper=Array.from({length:3},()=>[0,0,0]);
  for(let j=0;j<3;j++) {
    if(scales[j]<1e-10)throw Error("Data cannot identify all three gains.");
    const v=columns[j].map(value=>value/scales[j]);
    for(let k=0;k<j;k++){const dot=v.reduce((sum,value,i)=>sum+value*q[k][i],0);upper[k][j]=dot;for(let i=0;i<v.length;i++)v[i]-=dot*q[k][i];}
    const norm=Math.sqrt(v.reduce((sum,value)=>sum+value*value,0));
    if(norm<1e-7)throw Error("Tests lack independent steady-speed and acceleration data.");
    upper[j][j]=norm;q.push(v.map(value=>value/norm));
  }
  const coefficients=q.map(column=>column.reduce((sum,value,i)=>sum+value*acceleration[i],0));
  for(let i=2;i>=0;i--){for(let j=i+1;j<3;j++)coefficients[i]-=upper[i][j]*coefficients[j];coefficients[i]/=upper[i][i];}
  const [alpha,beta,gamma]=coefficients.map((value,i)=>value/scales[i]);
  if(!Number.isFinite(beta)||beta<=1e-9)throw Error("Nonphysical acceleration fit. Check signal signs, units and test setup.");
  const kS=-gamma/beta,kV=-alpha/beta,kA=1/beta;
  if(![kS,kV,kA].every(Number.isFinite))throw Error("The fitted gains are not finite.");
  const mean=acceleration.reduce((sum,value)=>sum+value,0)/acceleration.length;
  const sse=rows.reduce((sum,row,i)=>sum+(acceleration[i]-row[0]*alpha-row[1]*beta-row[2]*gamma)**2,0);
  const total=acceleration.reduce((sum,value)=>sum+(value-mean)**2,0),rSquared=total>1e-12?1-sse/total:0;
  const warnings:string[]=[];
  if(kS<0||kV<0)warnings.push("Negative static/velocity gain; review the recorded data.");
  if(rSquared<.8)warnings.push("Low fit quality; review the test setup.");
  return {name,kS,kV,kA,outputUnit,velocityUnit:"rotations/s",accelerationUnit:"rotations/s²",rSquared,rmse:Math.sqrt(sse/rows.length),samples:rows.length,warnings};
}
export function analyzeTarget(target: Target, tests: TestRecord[], window: number): Result {
  const runs=tests.filter(test=>test.target.id===target.id);
  try {
    if(new Set(runs.map(run=>run.phase)).size!==4)throw Error("All four SysId tests are required.");
    const gains=target.motors.map((name,i)=>fitGains(name,runs.map(run=>run.samples[i]),target.kind==="velocityTorque"?"A":"V",window));
    let voltageGains: Gain[] | undefined;
    if(target.kind==="velocityTorque") {
      try { voltageGains=target.motors.map((name,i)=>fitGains(name,runs.map(run=>run.samples[i]),"V",window)); }
      catch { gains.forEach(gain=>gain.warnings.push("Secondary voltage fit unavailable; current-based gains are shown.")); }
    }
    return {target,gains,voltageGains};
  }catch(error){return {target,gains:[],error:error instanceof Error?error.message:String(error)};}
}
