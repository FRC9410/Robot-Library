import type { Gain, PositionTest, Sample, TestRecord, Result, Target, TestQuality } from "./types.js";

const minimumMotionSamples = 10;
const minimumQuasistaticSeconds = 3;
type MotionRow = { sample: Sample; velocity: number; acceleration: number };

function prepareMotion(run: Sample[], medianWindow: number) {
  const rows: MotionRow[] = [];
  const recordedSeconds = run.length ? run[run.length - 1].time - run[0].time : 0;
  let motionSeconds = 0;
  const velocities = run.map((_, i) => {
    const values = Array.from({ length: medianWindow }, (_, j) =>
      run[Math.max(0, Math.min(run.length - 1, i + j - Math.floor(medianWindow / 2)))].velocity).sort((a, b) => a - b);
    return values[Math.floor(values.length / 2)];
  });
  const peakVelocity = velocities.reduce((peak, velocity) => Math.max(peak, Math.abs(velocity)), 0);
  const threshold = Math.max(1e-5, peakVelocity * .005);
  for (let i = 1; i < run.length - 1; i++) {
    const before = run[i].time - run[i - 1].time;
    const after = run[i + 1].time - run[i].time;
    const dt = before + after;
    if (before <= 0 || after <= 0 || dt > .15 || Math.abs(velocities[i]) < threshold) continue;
    rows.push({ sample: run[i], velocity: velocities[i], acceleration: (velocities[i + 1] - velocities[i - 1]) / dt });
    motionSeconds += dt / 2;
  }
  return { rows, recordedSeconds, motionSeconds, peakVelocity };
}

type Motion = ReturnType<typeof prepareMotion>;

/** SysId simple-motor acceleration OLS: a=alpha*v+beta*u+gamma*sign(v).
 * kS=-gamma/beta, kV=-alpha/beta, kA=1/beta. See allwpilib v2026.2.1 FeedforwardAnalysis.cpp.
 * Filter/window choices are recorded; GUI automatic trimming is not silently applied.
 */
export function fitGains(name: string, runs: Sample[][], outputUnit: "V" | "A", medianWindow: number): Gain {
  return fitMotion(name, runs.map(run => prepareMotion(run, medianWindow)), outputUnit);
}

function fitMotion(name: string, runs: Motion[], outputUnit: "V" | "A", position?: PositionTest): Gain {
  const rows: number[][] = [], acceleration: number[] = [];
  for (const run of runs) {
    if (run.peakVelocity < 1e-5) throw Error("No measurable motion was recorded.");
    if (run.rows.length < minimumMotionSamples) throw Error("Insufficient usable motion in a test phase.");
    for (const row of run.rows) {
      const input = outputUnit === "A" ? row.sample.current : row.sample.voltage;
      if (![input, row.sample.position, row.velocity, row.acceleration].every(Number.isFinite)) throw Error("Non-finite log samples.");
      const values = [row.velocity, input * (position?.polarity ?? 1), Math.sign(row.velocity)];
      if (position) values.push(position.model === "arm" ? Math.cos(2 * Math.PI * (row.sample.position - position.horizontal!)) : 1);
      rows.push(values);
      acceleration.push(row.acceleration);
    }
  }
  if(rows.length<30)throw Error("Insufficient usable samples.");
  if (position && (!rows.some(row => row[0] > 0) || !rows.some(row => row[0] < 0))) {
    throw Error("Position tests need usable motion in both directions.");
  }
  const size = position ? 4 : 3;
  const columns=Array.from({length:size},(_,j)=>rows.map(row=>row[j]));
  const scales=columns.map(column=>Math.sqrt(column.reduce((sum,value)=>sum+value*value,0)));
  const q:number[][]=[],upper=Array.from({length:size},()=>Array<number>(size).fill(0));
  for(let j=0;j<size;j++) {
    if(scales[j]<1e-10)throw Error("Data cannot identify all gains.");
    const v=columns[j].map(value=>value/scales[j]);
    for(let k=0;k<j;k++){const dot=v.reduce((sum,value,i)=>sum+value*q[k][i],0);upper[k][j]=dot;for(let i=0;i<v.length;i++)v[i]-=dot*q[k][i];}
    const norm=Math.sqrt(v.reduce((sum,value)=>sum+value*value,0));
    if(norm<1e-7)throw Error("Tests lack independent steady-speed and acceleration data.");
    upper[j][j]=norm;q.push(v.map(value=>value/norm));
  }
  const coefficients=q.map(column=>column.reduce((sum,value,i)=>sum+value*acceleration[i],0));
  for(let i=size-1;i>=0;i--){for(let j=i+1;j<size;j++)coefficients[i]-=upper[i][j]*coefficients[j];coefficients[i]/=upper[i][i];}
  const gains=coefficients.map((value,i)=>value/scales[i]);
  const [alpha,beta,gamma,gravity]=gains;
  if(!Number.isFinite(beta)||beta<=1e-9)throw Error("Nonphysical acceleration fit. Check signal signs, units and test setup.");
  const kS=-gamma/beta,kV=-alpha/beta,kA=1/beta;
  const kG = position ? -gravity/beta : undefined;
  if(![kS,kV,kA,kG ?? 0].every(Number.isFinite))throw Error("The fitted gains are not finite.");
  const mean=acceleration.reduce((sum,value)=>sum+value,0)/acceleration.length;
  const sse=rows.reduce((sum,row,i)=>sum+(acceleration[i]-row.reduce((estimate,value,j)=>estimate+value*gains[j],0))**2,0);
  const total=acceleration.reduce((sum,value)=>sum+(value-mean)**2,0),rSquared=total>1e-12?1-sse/total:0;
  const warnings:string[]=[];
  if(kS<0||kV<0)warnings.push("Negative static/velocity gain; review the recorded data.");
  if(rSquared<.8)warnings.push("Low fit quality; review the test setup.");
  return {name,kS,kV,kA,...(kG === undefined ? {} : { kG }),outputUnit,velocityUnit:"rotations/s",accelerationUnit:"rotations/s²",rSquared,rmse:Math.sqrt(sse/rows.length),samples:rows.length,warnings};
}
export function analyzeTarget(target: Target, tests: TestRecord[], window: number, position?: PositionTest): Result {
  const runs=tests.filter(test=>test.target.id===target.id);
  const testQuality: TestQuality[] = [];
  try {
    const motors = target.motors.map((name, i) => runs.map(test => {
      const motion = prepareMotion(test.samples[i], window);
      const warnings: string[] = [];
      if (motion.rows.length < minimumMotionSamples) warnings.push("Too few usable motion samples to fit.");
      else if (test.phase.startsWith("quasistatic") && motion.motionSeconds < minimumQuasistaticSeconds)
        warnings.push("Under 3 s of usable quasistatic motion.");
      testQuality.push({ phase: test.phase, motor: name, recordedSeconds: motion.recordedSeconds, motionSeconds: motion.motionSeconds,
        usableSamples: motion.rows.length, peakVelocity: motion.peakVelocity, warnings });
      return motion;
    }));
    if(new Set(runs.map(run=>run.phase)).size!==4)throw Error("All four SysId tests are required.");
    if (target.kind === "position" && !position) throw Error("Position SysId settings are missing.");
    const gains=target.motors.map((name,i)=>fitMotion(name,motors[i],target.kind==="velocityTorque"?"A":"V",target.kind==="position"?position:undefined));
    let voltageGains: Gain[] | undefined;
    if(target.kind==="velocityTorque") {
      try { voltageGains=target.motors.map((name,i)=>fitMotion(name,motors[i],"V")); }
      catch { gains.forEach(gain=>gain.warnings.push("Secondary voltage fit unavailable; current-based gains are shown.")); }
    }
    return {target,gains,voltageGains,testQuality};
  }catch(error){return {target,gains:[],testQuality,error:error instanceof Error?error.message:String(error)};}
}
