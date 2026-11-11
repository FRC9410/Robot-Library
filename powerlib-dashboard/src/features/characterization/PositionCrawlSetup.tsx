import { useEffect, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField, Typography } from "@mui/material";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import type { PositionTest, Settings } from "../../../electron/characterization/types";
import { defaultSettings, limitsFields, resolveLimits, validPositionTest, validSettings } from "../../../electron/characterization/limits";
import { readCharacterizationStatus } from "./characterizationModel";

const base = "/PowerLib/Characterization/";
type CrawlTarget = { id: string; name: string; lower?: number; upper?: number };

function readTargets(value: unknown): CrawlTarget[] {
  try {
    const targets: unknown = typeof value === "string" ? JSON.parse(value) : null;
    return Array.isArray(targets) ? targets.filter(target => target && typeof target.id === "string" && typeof target.name === "string") : [];
  } catch {
    return [];
  }
}

type StartPosition = (targetId: string, settings: Settings) => Promise<void>;

export function PositionCrawlSetup({ onStart }: { onStart: StartPosition }) {
  const topics = useTopics("app");
  const catalog = topics.find(topic => topic.name === base + "crawlCatalog");
  const targets = readTargets(catalog?.value);
  const [selection, setSelection] = useState("");
  const [armed, setArmed] = useState(false);
  const target = targets.find(item => item.id === selection) ?? targets[0];

  if (!target) return <Typography variant="body2">
    {catalog ? "No position subsystems are registered for crawl setup." : "Connect to a robot or simulation rebuilt with crawl support."}
  </Typography>;

  return (
    <Stack spacing={1.5}>
      <FormControl size="small" sx={{ maxWidth: 360 }}>
        <InputLabel id="crawl-mechanism-label">Mechanism</InputLabel>
        <Select labelId="crawl-mechanism-label" label="Mechanism" value={target.id} disabled={armed}
          inputProps={{ "aria-label": "Mechanism" }} onChange={event => setSelection(event.target.value)}>
          {targets.map(item => <MenuItem key={item.id} value={item.id}>{item.name}</MenuItem>)}
        </Select>
      </FormControl>
      <CrawlControls key={target.id} target={target} setArmed={setArmed} onStart={onStart} />
    </Stack>
  );
}

function CrawlControls({ target, setArmed, onStart }: { target: CrawlTarget; setArmed: (armed: boolean) => void; onStart: StartPosition }) {
  const topics = useTopics("app");
  const network = useNetworkTables();
  const client = network.clientRef.current;
  const statusTopic = topics.find(topic => topic.name === base + "status");
  const robot = readCharacterizationStatus(statusTopic?.value);
  const connected = network.status === "connected";
  const [lower, setLower] = useState(target.lower?.toString() ?? "");
  const [upper, setUpper] = useState(target.upper?.toString() ?? "");
  const [margin, setMargin] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [speedSteps, setSpeedSteps] = useState(2);
  const speedLimit = speedSteps / 200;
  const [direction, setDirection] = useState(1);
  const [sysId, setSysId] = useState(false);
  const [model, setModel] = useState<PositionTest["model"]>("arm");
  const [horizontal, setHorizontal] = useState("");
  const [testSpeed, setTestSpeed] = useState("");
  const [polarity, setPolarity] = useState<1 | -1>();
  const [settings, setSettings] = useState<Settings>({ ...defaultSettings, ramp: .1, rampLimit: .3, step: .3 });
  const limits = resolveLimits(settings);
  const [session, setSession] = useState<{ id: string; at: number } | null>(null);
  const [error, setError] = useState("");
  const [nudgePending, setNudgePending] = useState(false);

  const matching = session && robot?.id === session.id && robot.phase === "crawl" ? robot : null;
  const fresh = connected && statusTopic?.receivedAt !== undefined && performance.now() - statusTopic.receivedAt < 500;
  const terminal = matching?.state === "cancelled" || matching?.state === "failed";
  const live = !!session && !terminal;
  const feedback = matching?.crawlFeedback;
  const low = Number(lower), high = Number(upper), buffer = Number(margin);
  const valid = lower !== "" && upper !== "" && [low, high, buffer].every(Number.isFinite)
    && buffer > 0 && high - low > 2 * buffer && low >= (target.lower ?? -Infinity) && high <= (target.upper ?? Infinity);
  const canArm = fresh && robot?.crawlSpeedCutoff === true && !robot.enabled && (robot.test || robot.controlMode === "simulation")
    && !robot.fms && !robot.estop && valid && confirmed && !live;
  const positionTest: PositionTest | undefined = polarity && (model === "elevator" || horizontal.trim() !== "") ? {
    model, ...(model === "arm" ? { horizontal: Number(horizontal) } : {}),
    lower: low, upper: high, margin: buffer, speedLimit: testSpeed === "" ? speedLimit : Number(testSpeed), polarity
  } : undefined;
  const canStart = canArm && robot?.positionSysId === true && validPositionTest(positionTest) && validSettings(settings, []);
  const canNudge = fresh && matching?.state === "ready" && matching.enabled && matching.test
    && !matching.fms && !matching.estop && !nudgePending && live;

  useEffect(() => {
    setArmed(live);
    return () => setArmed(false);
  }, [live, setArmed]);

  useEffect(() => {
    if (!session) return;
    const { id } = session;
    let count = 0, timer: ReturnType<typeof setTimeout> | undefined, active = true;
    async function renew() {
      try {
        await client.publish(base + "crawlLease", "string", id + "|" + ++count);
        if (active) timer = setTimeout(() => void renew(), 100);
      } catch {
        if (active) {
          setError("Connection to the robot was lost. Disable the robot.");
          setSession(null);
        }
      }
    }
    void renew();
    return () => {
      active = false;
      clearTimeout(timer);
      void client.publish(base + "request", "string", JSON.stringify({ id, cancel: true })).catch(() => {});
    };
  }, [session, client]);

  useEffect(() => {
    if (!session) return;
    if (!connected || terminal) {
      if (!connected) setError("Connection to the robot was lost. Disable the robot.");
      else if (matching?.error !== "Cancelled by operator.") setError(matching?.error || "Crawl stopped.");
      setSession(null);
      return;
    }
    const timeout = setTimeout(() => {
      setError("The robot did not acknowledge crawl setup. Disable the robot.");
      setSession(null);
    }, Math.max(0, 2500 - (performance.now() - session.at)));
    if (matching) clearTimeout(timeout);
    return () => clearTimeout(timeout);
  }, [session, connected, terminal, matching]);

  useEffect(() => {
    if (!nudgePending) return;
    const timeout = setTimeout(() => setNudgePending(false), 250);
    return () => clearTimeout(timeout);
  }, [nudgePending]);

  async function arm() {
    if (!canArm) return;
    const id = crypto.randomUUID();
    setError("");
    setSession({ id, at: performance.now() });
    try {
      await client.publish(base + "request", "string", JSON.stringify({
        id, target: target.id, phase: "crawl", lower: low, upper: high, margin: buffer
      }));
    } catch {
      setError("Could not arm crawl setup.");
      setSession(null);
    }
  }

  async function nudge() {
    if (!canNudge || !session) return;
    setNudgePending(true);
    try {
      await client.publish(base + "crawlNudge", "string", JSON.stringify({
        id: session.id, token: crypto.randomUUID(), direction, speedLimit
      }));
    } catch {
      setError("Could not send the nudge. Disable the robot.");
      setSession(null);
    }
  }

  const instructions = robot && !robot.crawlSpeedCutoff ? "Rebuild and restart the robot with current crawl support." : !live
    ? robot?.enabled ? "Disable the robot before arming another crawl." : "Start disabled in Test mode. Arm crawl, then enable manually."
    : matching?.state === "prepared" ? (robot?.controlMode === "simulation" ? "Enable Test mode in the WPILib Simulation GUI." : "Enable in FRC Driver Station Test mode.")
    : matching?.state === "moving" ? "Nudging…" : matching?.state === "ready" ? (matching.error || "Ready to nudge.") : "Waiting for the robot to arm…";

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 3 }}>
      <Stack spacing={1}>
        <TextField size="small" label="Lower test position (rot)" type="number" value={lower} disabled={live} onChange={event => { setLower(event.target.value); setConfirmed(false); }} />
        <TextField size="small" label="Upper test position (rot)" type="number" value={upper} disabled={live} onChange={event => { setUpper(event.target.value); setConfirmed(false); }} />
        <TextField size="small" label="Stopping margin on each end (rot)" type="number" value={margin} disabled={live} onChange={event => { setMargin(event.target.value); setConfirmed(false); }} />
        <FormControlLabel control={<Checkbox size="small" checked={confirmed} disabled={live} onChange={event => setConfirmed(event.target.checked)} />}
          label={<Typography variant="body2">The test window is clear and the mechanism can stop safely with motor output removed.</Typography>} />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant={sysId ? "text" : "outlined"} onClick={() => setSysId(false)}>Crawl</Button>
          <Button size="small" variant={sysId ? "outlined" : "text"} onClick={() => setSysId(true)} disabled={live}>SysId</Button>
        </Stack>
      </Stack>
      <Stack spacing={1}>
        {!sysId && <Typography variant="body2">Speed cutoff {speedLimit.toFixed(3)} rot/s · {direction > 0 ? "Positive output" : "Negative output"}</Typography>}
        {sysId ? <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
            <TextField select size="small" label="Gravity model" slotProps={{ select: { inputProps: { "aria-label": "Gravity model" } } }} value={model} onChange={event => setModel(event.target.value as PositionTest["model"])}>
              <MenuItem value="arm">Arm</MenuItem><MenuItem value="elevator">Elevator</MenuItem>
            </TextField>
            <TextField select size="small" label="Positive output moves" slotProps={{ select: { inputProps: { "aria-label": "Positive output moves" } } }} value={polarity ?? ""} onChange={event => setPolarity(Number(event.target.value) as 1 | -1)}>
              <MenuItem value={1}>Toward higher positions</MenuItem><MenuItem value={-1}>Toward lower positions</MenuItem>
            </TextField>
            <TextField size="small" type="number" label="SysId speed cutoff (rot/s)" value={testSpeed === "" ? speedLimit : testSpeed}
              slotProps={{ htmlInput: { min: .005, step: .005 } }} onChange={event => setTestSpeed(event.target.value)} />
            {model === "arm" && <TextField size="small" type="number" label="Horizontal position (rot)" value={horizontal} onChange={event => setHorizontal(event.target.value)} />}
            {limitsFields.map(([key,label,min,max]) => <TextField key={key} size="small" type="number" label={label} value={limits[key]}
              slotProps={{ htmlInput: { min, max, step: .1 } }} onChange={event => setSettings({ ...settings, [key]: Number(event.target.value) })} />)}
          </Box>
          {robot && !robot.positionSysId && <Typography variant="body2">Rebuild and restart the robot with position SysId support.</Typography>}
          <Button variant="contained" disabled={!canStart} onClick={() => positionTest && void onStart(target.id, { ...settings, positionTest })}>Start SysId walkthrough</Button>
        </> : <>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: .5 }}>
          <Button size="small" onClick={() => setSpeedSteps(steps => Math.max(1, steps - 1))} disabled={speedSteps <= 1 || matching?.state === "moving" || nudgePending}>Speed Down</Button>
          <Button size="small" onClick={() => setSpeedSteps(steps => steps + 1)} disabled={matching?.state === "moving" || nudgePending}>Speed Up</Button>
          <Button size="small" onClick={() => setDirection(-direction)} disabled={matching?.state === "moving" || nudgePending}>Flip Direction</Button>
        </Stack>
        <Typography variant="body2" role="status">{instructions}</Typography>
        {typeof feedback?.position === "number" && typeof feedback.velocity === "number" &&
          <Typography variant="body2">Position {feedback.position.toFixed(3)} rot · Speed {feedback.velocity.toFixed(3)} rot/s</Typography>}
        {error && <Alert severity="error" sx={{ py: 0 }}>{error}</Alert>}
        <Stack direction="row" spacing={1}>
          {live ? <>
            <Button variant="contained" disabled={!canNudge} onClick={() => void nudge()}>Nudge</Button>
            <Button variant="outlined" color="error" onClick={() => { setSession(null); setConfirmed(false); }}>Stop Crawl</Button>
          </> : <Button variant="contained" disabled={!canArm} onClick={() => void arm()}>Arm Crawl</Button>}
        </Stack>
        </>}
      </Stack>
    </Box>
  );
}
