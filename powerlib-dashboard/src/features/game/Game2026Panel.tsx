import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { useNetworkTables } from "../networktables/NetworkTablesContext";
import { discoverCameras, getPowerLibAutoChooser, formatTime, streamUrl } from "../drive/driveModel";
import { gameModel, gameTemplate, validGameConfig } from "./gameModel";
import { gamePreviewTopics } from "./gamePreview";
import { GameField } from "./GameField";
import "./game.css";

const cameraSlots = ["left", "right", "turret"];
type Settings = { flip: boolean; urls: Record<string, string> };
const settingsKey = "powerlib.game2026.display.v1";
function readSettings(): Settings {
  try { const saved = JSON.parse(localStorage.getItem(settingsKey) || "{}"); return { flip: saved.flip === true,
    urls: Object.fromEntries(Object.entries(saved.urls || {}).filter((pair): pair is [string, string] => typeof pair[1] === "string" && !!streamUrl(pair[1]))) }; }
  catch { return { flip: false, urls: {} }; }
}
const metric = (value: number | undefined, places = 1) => value === undefined ? "—" : value.toFixed(places);
function Flag({ label, ok }: { label: string; ok?: boolean }) {
  return <span className={`game-flag ${ok === undefined ? "unknown" : ok ? "good" : "bad"}`} aria-label={`${label}: ${ok === undefined ? "unknown" : ok ? "OK" : "unavailable"}`}><i />{label}</span>;
}
function Check({ label, ok }: { label: string; ok?: boolean }) {
  return <div className="game-check"><span>{label}</span><span className={ok === undefined ? "unknown" : ok ? "good" : "bad"}><i />{ok === undefined ? "—" : ok ? "YES" : "WAIT"}</span></div>;
}
export function Game2026Panel() {
  const network = useNetworkTables();
  const preview = import.meta.env.DEV && new URLSearchParams(location.search).get("preview") === "2026";
  const [now, setNow] = useState(performance.now());
  const topics = useMemo(() => preview ? gamePreviewTopics(now) : network.topics, [preview, now, network.topics]);
  const connected = preview || network.status === "connected";
  const model = gameModel(topics, connected, now);
  const drive = model.drive;
  const [config, setConfig] = useState(gameTemplate);
  const [configNote, setConfigNote] = useState("");
  const [settings, setSettings] = useState(readSettings);
  const [tools, setTools] = useState(false);
  const [view, setView] = useState("field");
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{ name: string; at: number } | null>(null);
  const [autoError, setAutoError] = useState("");
  const [previewAuto, setPreviewAuto] = useState("Blue Left");
  const panel = useRef<HTMLDivElement>(null);
  const cameras = useMemo(() => discoverCameras(topics), [topics]);
  const chooser = getPowerLibAutoChooser(topics);
  const acknowledgedAuto = preview ? previewAuto : chooser?.active;
  const route = acknowledgedAuto ? config.autos[acknowledgedAuto] : undefined;
  const shooting = model.bool("ShotRequested") === true;
  const enabled = drive.live ? drive.boolean("enabled") : undefined;
  const dn = (key: Parameters<typeof drive.number>[0]) => drive.live ? drive.number(key) : undefined;
  const cameraUrl = (slot: string) => settings.urls[slot] || cameras.find(camera => camera.id.toLowerCase().includes(slot))?.urls[0];
  const showCamera = (slot: string) => {
    const url = cameraUrl(slot);
    return <div className="game-camera">{url && !failed[slot] ? <img src={url} alt={`${slot} camera stream`} onError={() => setFailed(current => ({ ...current, [slot]: true }))} /> : <span>{url ? "UNAVAILABLE" : "OFFLINE"}</span>}</div>;
  };
  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(timer); }, []);
  useEffect(() => { try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* Keep session settings. */ } }, [settings]);
  useEffect(() => {
    let active = true;
    if (window.powerlib?.readGameConfiguration) void window.powerlib.readGameConfiguration().then(value => {
      if (!active) return;
      if (value === null) setConfigNote("Using bundled 2026 field/route reference; project game JSON was not found.");
      else if (validGameConfig(value)) setConfig(value);
      else setConfigNote("Project game JSON is invalid; using bundled field/route reference.");
    }).catch(() => { if (active) setConfigNote("Could not read project game JSON; using bundled reference."); });
    return () => { active = false; };
  }, []);
  useLayoutEffect(() => {
    const header = document.querySelector("header");
    const resize = () => panel.current?.style.setProperty("--game-header", `${header?.getBoundingClientRect().height ?? 112}px`);
    const observer = new ResizeObserver(resize); if (header) observer.observe(header); resize();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!pending) return;
    if (!chooser?.options.includes(pending.name)) { setPending(null); setAutoError("Routine no longer available"); }
    else if (chooser.active === pending.name) { setPending(null); setAutoError(""); }
    else if (!drive.canSelectAuto || now - pending.at > 3000) { setPending(null); setAutoError("Selection not acknowledged by robot"); }
  }, [pending, chooser, now, drive.canSelectAuto]);
  async function selectAuto(name: string) {
    if (!chooser || !drive.canSelectAuto || !chooser.controllable || !chooser.options.includes(name)) return;
    if (preview) { setPreviewAuto(name); return; }
    setAutoError(""); setPending({ name, at: performance.now() });
    try { await network.clientRef.current.publish(`${chooser.path}/selected`, "string", name); }
    catch (error) { setPending(null); setAutoError(error instanceof Error ? error.message : "Selection failed"); }
  }
  function saveTools() {
    const urls: Record<string, string> = {};
    for (const slot of cameraSlots) { const draft = (drafts[slot] ?? settings.urls[slot] ?? "").trim(); if (draft) { const url = streamUrl(draft); if (!url) return; urls[slot] = url; } }
    setSettings(current => ({ ...current, urls })); setFailed({}); setTools(false);
  }
  function exportSnapshot() {
    const url = URL.createObjectURL(new Blob([JSON.stringify({ capturedAt: new Date().toISOString(), preview, topics, config }, (_, value) => value instanceof ArrayBuffer ? Array.from(new Uint8Array(value)) : value, 2)], { type: "application/json" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "powerlib-game2026-snapshot.json"; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const autoStatus = model.text("AutoStatus");
  const autoReason = model.text("AutoReason");
  const fault = autoStatus === "ABORTED" || autoStatus === "CANCELLED" || drive.health === "fault";
  const message = preview ? `PREVIEW DATA · AUTO ${autoStatus} · ${autoReason}` : !connected ? "ROBOT DATA UNAVAILABLE · CHECK CONNECTION"
    : !drive.live ? "DRIVE TELEMETRY STALE OR UNAVAILABLE" : !model.live ? "WAITING FOR GAME2026 TELEMETRY"
    : autoStatus && autoStatus !== "NONE" ? `AUTO ${autoStatus} · ${autoReason}` : model.text("ShotStatus") || "ROBOT DATA LIVE";
  return <div className="game-viewport" ref={panel}><main className="game-dashboard" aria-label="2026 game dashboard">
    <div className="game-topline">
      <section className="game-top-card"><label>{drive.live ? drive.text("mode") || "UNKNOWN" : "UNKNOWN"}</label><b>{formatTime(dn("time"))}</b></section>
      <section className="game-top-card"><label>{model.bool("HubActive") === undefined ? "HUB UNKNOWN" : model.bool("HubActive") ? "HUB ACTIVE" : "HUB INACTIVE"}</label><b>{formatTime(model.number("HubTimeSeconds"))}</b></section>
      <section className={`game-top-card ${drive.live && drive.boolean("brownout") ? "danger" : ""}`}><label>BATTERY</label><b>{metric(dn("battery"))} V</b></section>
      <section className="game-top-card game-state"><label>ROBOT STATE</label><b>{model.text("State") || "UNKNOWN"}</b></section>
      <button className="game-tools" aria-label="Open game crew tools" onClick={() => { setDrafts(settings.urls); setTools(true); }}><TuneIcon /><span>Crew tools</span></button>
    </div>
    <div className="game-main">
      <nav className="game-rail" aria-label="Game camera and field views"><small>Select view</small>
        <button className={view === "field" ? "selected" : ""} onClick={() => setView("field")} aria-label="Show game field"><div className="game-mini-field"><GameField config={config} flip={settings.flip} /></div><b>FIELD</b></button>
        {cameraSlots.map(slot => <button key={slot} className={view === slot ? "selected" : ""} onClick={() => setView(slot)} aria-label={`Show ${slot} camera`}>{showCamera(slot)}<b>{slot.toUpperCase()} CAMERA</b></button>)}
      </nav>
      <section className="game-stage">{view === "field" ? <GameField config={config} pose={drive.pose} route={route} alliance={drive.live ? drive.text("alliance") : undefined} flip={settings.flip} /> : showCamera(view)}</section>
      <aside className="game-sidebar">
        <section className="game-auto"><label htmlFor="game-auto">AUTONOMOUS</label><select id="game-auto" value={pending?.name ?? acknowledgedAuto ?? chooser?.default ?? ""}
          disabled={!chooser || !drive.canSelectAuto || !chooser.controllable || !!pending} onChange={event => void selectAuto(event.target.value)}>
          {!chooser && <option value="">Waiting for robot</option>}{chooser?.options.map(option => <option key={option}>{option}</option>)}
        </select>{(pending || autoError || enabled !== false) && <small>{autoError || (pending ? "Waiting for robot acknowledgment…" : enabled ? "Locked while enabled" : "Waiting for live disabled state")}</small>}</section>
        <section className="game-shot" aria-label="Shot readiness"><h2>Shot ready <i className={model.bool("FeedReady") ? "good" : "unknown"} /></h2>
          <Check label="Flywheel at speed" ok={shooting ? model.bool("VelocityReady") : undefined} />
          <Check label="Hood in position" ok={shooting ? model.bool("HoodReady") : undefined} />
          <Check label={`Aligned${shooting && model.number("HeadingError") !== undefined ? ` · ${metric(model.number("HeadingError"))}°` : ""}`} ok={shooting ? model.bool("Aligned") : undefined} />
          <Check label="Calibrated range" ok={shooting ? model.bool("CalibratedRange") : undefined} />
          <Check label="Our hub active" ok={model.bool("HubActive")} />
          <div className="game-check"><span>Target</span><span>{model.text("Target") === "HUB" ? `HUB · ${metric(model.number("HubDistance"), 2)} m` : "—"}</span></div>
          <div className="game-check"><span>Vision</span><span>{model.bool("VisionAccepted") ? "Fresh accepted frame" : model.live ? "No accepted frame" : "—"}</span></div>
        </section>
      </aside>
    </div>
    <section className="game-mechanisms" aria-label="Mechanism telemetry">
      <article className={`game-mechanism game-drivetrain ${drive.health === "healthy" ? "healthy" : ""}`}><h3>Drivetrain</h3>
        <div className="game-pose"><span>X <b>{metric(drive.pose?.x, 2)}</b><small> m</small></span><span>Y <b>{metric(drive.pose?.y, 2)}</b><small> m</small></span><span>H <b>{metric(drive.pose?.heading, 0)}°</b></span></div>
        <div className="game-module-health"><Flag label="GYRO" ok={drive.live ? drive.boolean("gyro") : undefined} />{["FL", "FR", "BL", "BR"].map(name => <Flag key={name} label={name} ok={drive.modules.find(module => module.name === name)?.connected} />)}</div>
      </article>
      {model.mechanisms.map(mechanism => <article key={mechanism.id} className={`game-mechanism ${mechanism.connected === true ? "healthy" : mechanism.connected === false ? "danger" : ""}`}><h3>{mechanism.label}</h3>
        <div className="game-reading"><b>{metric(mechanism.value, mechanism.places)}</b><small>{mechanism.unit}</small></div>
        <div className="game-meter" role="meter" aria-label={`${mechanism.label} magnitude`} aria-valuemin={0} aria-valuemax={mechanism.scale} aria-valuenow={mechanism.value === undefined ? undefined : Math.min(Math.abs(mechanism.value), mechanism.scale)}><i style={{ width: `${mechanism.value === undefined ? 0 : Math.min(Math.abs(mechanism.value) / mechanism.scale, 1) * 100}%` }} /></div>
      </article>)}
    </section>
    <footer className={`game-status ${fault ? "danger" : model.live ? "healthy" : ""}`} role="status"><span title={message}>{message}</span><div>
      <Flag label="DS" ok={drive.live ? drive.boolean("ds") : undefined} /><Flag label="FMS" ok={drive.live ? drive.boolean("fms") : undefined} /><Flag label="CONTROLLER" ok={drive.live ? drive.boolean("controller") : undefined} /><Flag label="POWER" ok={drive.live && drive.boolean("brownout") !== undefined ? !drive.boolean("brownout") : undefined} /><span>RIO CAN {dn("can") === undefined ? "—" : `${metric(dn("can")! * 100, 0)}%`}</span>
    </div></footer>
    <Dialog open={tools} onClose={() => setTools(false)} maxWidth="sm" fullWidth><DialogTitle>2026 Game · Crew tools</DialogTitle><DialogContent className="game-tool-fields">
      <p>Field coordinates use the blue origin. Camera overrides and field orientation stay on this laptop.</p>{preview && <p>Development preview uses fixture data and never sends robot commands.</p>}{configNote && <p>{configNote}</p>}
      <Button onClick={() => setSettings(current => ({ ...current, flip: !current.flip }))}>Flip field {settings.flip ? "(flipped)" : ""}</Button>
      {cameraSlots.map(slot => { const draft = drafts[slot] ?? ""; const invalid = !!draft.trim() && !streamUrl(draft.trim()); return <TextField key={slot} label={`${slot[0].toUpperCase() + slot.slice(1)} camera URL`} value={draft} error={invalid} helperText={invalid ? "Use an HTTP/HTTPS MJPEG URL without credentials." : "Leave blank to use the published camera stream."} onChange={event => setDrafts(current => ({ ...current, [slot]: event.target.value }))} />; })}
      <Button onClick={() => setFailed({})}>Retry camera streams</Button><Button onClick={exportSnapshot}>Export telemetry snapshot</Button>
    </DialogContent><DialogActions><Button onClick={() => setTools(false)}>Cancel</Button><Button onClick={saveTools} disabled={cameraSlots.some(slot => !!drafts[slot]?.trim() && !streamUrl(drafts[slot].trim()))}>Save display settings</Button></DialogActions></Dialog>
  </main></div>;
}
