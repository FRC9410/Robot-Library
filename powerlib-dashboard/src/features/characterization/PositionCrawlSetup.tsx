import { useEffect, useState } from "react";
import { Alert, Box, Button, Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField, Tooltip, Typography } from "@mui/material";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import type { PositionTest, Settings } from "../../../electron/characterization/types";
import { defaultSettings, limitsFields, resolveLimits, validPositionBounds, validPositionTest, validSettings } from "../../../electron/characterization/limits";
import { readCharacterizationStatus, readPositionFeedback } from "./characterizationModel";

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

type PositionDraft = {
  lower: string;
  upper: string;
  reverseStop: string;
  forwardStop: string;
  speedSteps: number;
  direction: number;
  sysId: boolean;
  model: PositionTest["model"];
  horizontal: string;
  testSpeed: string;
  polarity?: 1 | -1;
  settings: Settings;
};

export function usePositionDrafts() {
  const [selection, setSelection] = useState("");
  const [drafts, setDrafts] = useState<Record<string, PositionDraft>>({});
  function defaultDraft(target: CrawlTarget): PositionDraft {
    return {
      lower: target.lower?.toString() ?? "", upper: target.upper?.toString() ?? "",
      reverseStop: "", forwardStop: "", speedSteps: 2, direction: 1, sysId: false,
      model: "arm", horizontal: "", testSpeed: "",
      settings: { ...defaultSettings, ramp: .1, rampLimit: .3, step: .3 }
    };
  }
  function changeDraft(target: CrawlTarget, update: Partial<PositionDraft>) {
    setDrafts(current => ({ ...current, [target.id]: { ...(Object.hasOwn(current, target.id) ? current[target.id] : defaultDraft(target)), ...update } }));
  }
  return { selection, setSelection, readDraft: (target: CrawlTarget) => Object.hasOwn(drafts, target.id) ? drafts[target.id] : defaultDraft(target), changeDraft };
}

type StartPosition = (targetId: string, settings: Settings) => Promise<void>;

export function PositionCrawlSetup({ onStart, drafts }: { onStart: StartPosition; drafts: ReturnType<typeof usePositionDrafts> }) {
  const topics = useTopics("app");
  const catalog = topics.find(topic => topic.name === base + "crawlCatalog");
  const targets = readTargets(catalog?.value);
  const { selection, setSelection } = drafts;
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
      <CrawlControls key={target.id} target={target} setArmed={setArmed} onStart={onStart}
        draft={drafts.readDraft(target)} changeDraft={update => drafts.changeDraft(target, update)} />
    </Stack>
  );
}

function CrawlControls({ target, setArmed, onStart, draft, changeDraft }: {
  target: CrawlTarget;
  setArmed: (armed: boolean) => void;
  onStart: StartPosition;
  draft: PositionDraft;
  changeDraft: (update: Partial<PositionDraft>) => void;
}) {
  const topics = useTopics("app");
  const network = useNetworkTables();
  const client = network.clientRef.current;
  const statusTopic = topics.find(topic => topic.name === base + "status");
  const robot = readCharacterizationStatus(statusTopic?.value);
  const connected = network.status === "connected";
  const { lower, upper, reverseStop, forwardStop, speedSteps, direction, sysId, model, horizontal, testSpeed, polarity, settings } = draft;
  const [confirmed, setConfirmed] = useState(false);
  const speedLimit = speedSteps / 200;
  const limits = resolveLimits(settings);
  const [session, setSession] = useState<{ id: string; at: number } | null>(null);
  const [error, setError] = useState("");
  const [nudgePending, setNudgePending] = useState(false);

  const matching = session && robot?.id === session.id && robot.phase === "crawl" ? robot : null;
  const fresh = connected && statusTopic?.receivedAt !== undefined && performance.now() - statusTopic.receivedAt < 500;
  const terminal = matching?.state === "cancelled" || matching?.state === "failed";
  const live = !!session && !terminal;
  const positionTopic = topics.find(topic => topic.name === base + "positionFeedback");
  const feedback = connected && positionTopic?.receivedAt !== undefined && performance.now() - positionTopic.receivedAt < 500
    ? readPositionFeedback(positionTopic.value, target.id) : null;
  const low = Number(lower), high = Number(upper);
  const lowerStop = Number(reverseStop), upperStop = Number(forwardStop);
  const valid = [lower, upper, reverseStop, forwardStop].every(value => value.trim() !== "")
    && validPositionBounds({ lower: low, upper: high, lowerStop, upperStop })
    && low >= (target.lower ?? -Infinity) && high <= (target.upper ?? Infinity);
  function updateBounds(update: Partial<PositionDraft>) {
    changeDraft(update);
    setConfirmed(false);
  }
  const canArm = fresh && robot?.crawlSpeedCutoff === true && !robot.enabled && (robot.test || robot.controlMode === "simulation")
    && !robot.fms && !robot.estop && valid && confirmed && !live;
  const positionTest: PositionTest | undefined = polarity && (model === "elevator" || horizontal.trim() !== "") ? {
    model, ...(model === "arm" ? { horizontal: Number(horizontal) } : {}),
    lower: low, upper: high, lowerStop, upperStop, speedLimit: testSpeed === "" ? speedLimit : Number(testSpeed), polarity
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
        id, target: target.id, phase: "crawl", lower: low, upper: high, lowerStop, upperStop, polarity: polarity ?? 1
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
        <Typography variant="body2" role="status">{feedback
          ? `Position ${feedback.position.toPrecision(6)} rot · Speed ${feedback.velocity.toFixed(3)} rot/s`
          : "Live position unavailable"}</Typography>
        <Stack direction="row" spacing={1}>
          <TextField fullWidth size="small" label="Min (rot)" type="number" value={lower} disabled={live} onChange={event => updateBounds({ lower: event.target.value })} />
          <Button size="small" aria-label="Use current position for Min" sx={{ flexShrink: 0 }} disabled={live || !feedback}
            onClick={() => feedback && updateBounds({ lower: String(feedback.position) })}>Use current position</Button>
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField fullWidth size="small" label="Max (rot)" type="number" value={upper} disabled={live} onChange={event => updateBounds({ upper: event.target.value })} />
          <Button size="small" aria-label="Use current position for Max" sx={{ flexShrink: 0 }} disabled={live || !feedback}
            onClick={() => feedback && updateBounds({ upper: String(feedback.position) })}>Use current position</Button>
        </Stack>
        <Stack direction="row" spacing={1}>
          <TextField size="small" fullWidth label="Lower stop (rot)" type="number" value={reverseStop} disabled={live} onChange={event => updateBounds({ reverseStop: event.target.value })} />
          <TextField size="small" fullWidth label="Upper stop (rot)" type="number" value={forwardStop} disabled={live} onChange={event => updateBounds({ forwardStop: event.target.value })} />
        </Stack>
        <FormControlLabel control={<Checkbox size="small" checked={confirmed} disabled={live} onChange={event => setConfirmed(event.target.checked)} />}
          label={<Typography variant="body2">The test window is clear and the mechanism can stop safely with motor output removed.</Typography>} />
        <Stack direction="row" spacing={1}>
          <Button size="small" variant={sysId ? "text" : "outlined"} onClick={() => changeDraft({ sysId: false })}>Crawl</Button>
          <Button size="small" variant={sysId ? "outlined" : "text"} onClick={() => changeDraft({ sysId: true })} disabled={live}>SysId</Button>
        </Stack>
      </Stack>
      <Stack spacing={1}>
        {!sysId && <Typography variant="body2">Speed cutoff {speedLimit.toFixed(3)} rot/s · {direction > 0 ? "Positive output" : "Negative output"}</Typography>}
        {sysId ? <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
            <TextField select size="small" label="Gravity model" slotProps={{ select: { inputProps: { "aria-label": "Gravity model" } } }} value={model} onChange={event => changeDraft({ model: event.target.value as PositionTest["model"] })}>
              <MenuItem value="arm">Arm</MenuItem><MenuItem value="elevator">Elevator</MenuItem>
            </TextField>
            <TextField select size="small" label="Positive output moves" slotProps={{ select: { inputProps: { "aria-label": "Positive output moves" } } }} value={polarity ?? ""} onChange={event => changeDraft({ polarity: Number(event.target.value) as 1 | -1 })}>
              <MenuItem value={1}>Toward higher positions</MenuItem><MenuItem value={-1}>Toward lower positions</MenuItem>
            </TextField>
            <TextField size="small" type="number" label="SysId speed cutoff (rot/s)" value={testSpeed === "" ? speedLimit : testSpeed}
              slotProps={{ htmlInput: { min: .005, step: .005 } }} onChange={event => changeDraft({ testSpeed: event.target.value })} />
            {model === "arm" && <Tooltip title="Enter the encoder reading when the arm is level with the ground. Power Tool uses this reference to calculate the gravity gain (kG)." describeChild>
              <TextField size="small" type="number" label="Horizontal position (rot)" value={horizontal} onChange={event => changeDraft({ horizontal: event.target.value })} />
            </Tooltip>}
            {limitsFields.map(([key,label,min,max]) => <TextField key={key} size="small" type="number" label={label} value={limits[key]}
              slotProps={{ htmlInput: { min, max, step: .1 } }} onChange={event => changeDraft({ settings: { ...settings, [key]: Number(event.target.value) } })} />)}
          </Box>
          {robot && !robot.positionSysId && <Typography variant="body2">Rebuild and restart the robot with position SysId support.</Typography>}
          <Button variant="contained" disabled={!canStart} onClick={() => { if (positionTest) { setConfirmed(false); void onStart(target.id, { ...settings, positionTest }); } }}>Start SysId walkthrough</Button>
        </> : <>
        <Stack direction="row" sx={{ flexWrap: "wrap", gap: .5 }}>
          <Button size="small" onClick={() => changeDraft({ speedSteps: Math.max(1, speedSteps - 1) })} disabled={speedSteps <= 1 || matching?.state === "moving" || nudgePending}>Speed Down</Button>
          <Button size="small" onClick={() => changeDraft({ speedSteps: speedSteps + 1 })} disabled={matching?.state === "moving" || nudgePending}>Speed Up</Button>
          <Button size="small" onClick={() => changeDraft({ direction: -direction })} disabled={matching?.state === "moving" || nudgePending}>Flip Direction</Button>
        </Stack>
        <Typography variant="body2" role="status">{instructions}</Typography>
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
