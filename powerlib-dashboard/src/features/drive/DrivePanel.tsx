import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import { useNetworkTables } from "../networktables/NetworkTablesContext";
import { discoverCameras, getPowerLibAutoChooser, driveModel, formatTime, streamUrl, template } from "./driveModel";
import type { DriveCamera } from "./driveModel";
import "./drive.css";

type DisplaySettings = { length: number; width: number; flip: boolean; urls: Record<string, string> };
const settingsKey = "powerlib.driveDisplay.v1";
function readSettings(): DisplaySettings {
  const defaults = { length: template.field.lengthMeters, width: template.field.widthMeters, flip: false, urls: {} };
  try {
    const value = JSON.parse(localStorage.getItem(settingsKey) || "{}");
    return { length: Number.isFinite(value.length) && value.length > 0 ? value.length : defaults.length,
      width: Number.isFinite(value.width) && value.width > 0 ? value.width : defaults.width,
      flip: value.flip === true,
      urls: value.urls && typeof value.urls === "object" ? Object.fromEntries(Object.entries(value.urls)
        .filter((entry): entry is [string, string] => typeof entry[1] === "string" && !!streamUrl(entry[1]))) : {} };
  } catch { return defaults; }
}

function Field({ pose, settings }: { pose?: { x: number; y: number; heading: number }; settings: DisplaySettings }) {
  const gridId = `drive-grid-${useId().replaceAll(":", "")}`;
  const height = 480;
  const width = height * settings.length / settings.width;
  const outOfBounds = pose && (pose.x < 0 || pose.x > settings.length || pose.y < 0 || pose.y > settings.width);
  return <svg viewBox={`-12 -12 ${width + 24} ${height + 24}`} role="img" aria-label="Field and robot position" preserveAspectRatio="xMidYMid meet">
    <defs><pattern id={gridId} width={width / 16} height={height / 8} patternUnits="userSpaceOnUse">
      <path d={`M ${width / 16} 0 H 0 V ${height / 8}`} fill="none" stroke="#355060" strokeWidth="1" />
    </pattern></defs>
    <g transform={settings.flip ? `translate(${width} ${height}) rotate(180)` : undefined}>
      <rect width={width} height={height} rx="5" fill="#101e29" stroke="#7993a5" strokeWidth="3" />
      <rect width={width} height={height} fill={`url(#${gridId})`} />
      <rect width="16" height={height} fill="#307de0" opacity=".55" />
      <rect x={width - 16} width="16" height={height} fill="#ec4d5d" opacity=".55" />
      <path d={`M ${width / 2} 0 V ${height}`} stroke="#698191" strokeDasharray="10 9" />
      {pose && !outOfBounds && <g transform={`translate(${pose.x / settings.length * width} ${height - pose.y / settings.width * height}) rotate(${-pose.heading})`}>
        <rect x="-15" y="-15" width="30" height="30" rx="4" fill="#ffdc00" stroke="#fff" strokeWidth="2" />
        <path d="M -5 -7 L 9 0 L -5 7" fill="none" stroke="#14212c" strokeWidth="4" />
      </g>}
    </g>
    {(!pose || outOfBounds) && <text x={width / 2} y={height / 2} textAnchor="middle" fill="#a8bbca" fontSize="18">
      {outOfBounds ? "Pose outside configured field" : "Waiting for live robot pose"}
    </text>}
  </svg>;
}

function CameraCanvas({ camera, images, failed, active = true }: { camera: DriveCamera; images: React.MutableRefObject<Map<string, HTMLImageElement>>; failed: boolean; active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const draw = () => {
      const img = images.current.get(camera.id);
      const canvas = ref.current;
      if (canvas && img?.naturalWidth) {
        const context = canvas.getContext("2d");
        if (context) {
          const size = 640;
          context.clearRect(0, 0, size, size);
          const scale = Math.min(size / img.naturalWidth, size / img.naturalHeight);
          const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
          context.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [camera.id, images, active]);
  return <div className="drive-camera-view">
    <canvas ref={ref} width="640" height="640" aria-label={`${camera.name} live camera`} />
    {failed && <span className="drive-camera-message">Stream unavailable</span>}
  </div>;
}

function StatusFlag({ label, ok }: { label: string; ok?: boolean }) {
  const state = ok === undefined ? "unknown" : ok ? "good" : "bad";
  const description = `${label}: ${ok === undefined ? "unknown" : ok ? "OK" : "unavailable"}`;
  return <span className={`drive-status-flag ${state}`} title={description} aria-label={description}><i aria-hidden="true" />{label}</span>;
}

function CameraUrlSetting({ camera, url, onSave }: { camera: DriveCamera; url: string; onSave: (url?: string) => void }) {
  const [draft, setDraft] = useState(url);
  const invalid = !!draft.trim() && !streamUrl(draft.trim());
  return <TextField label={`${camera.name} stream URL`} value={draft} error={invalid}
    onChange={event => setDraft(event.target.value)}
    helperText={invalid ? "Enter a valid HTTP MJPEG URL without credentials." : "Leave blank to use the published stream."}
    onBlur={() => { if (!invalid) onSave(streamUrl(draft.trim())); }} />;
}

export function DrivePanel() {
  const { topics, status, clientRef } = useNetworkTables();
  const [settings, setSettings] = useState(readSettings);
  const [tools, setTools] = useState(false);
  const [now, setNow] = useState(performance.now());
  const [selectedView, setSelectedView] = useState("field");
  const [visibleCameraIds, setVisibleCameraIds] = useState<string[]>([]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [retry, setRetry] = useState(0);
  const [pending, setPending] = useState<{ path: string; name: string; at: number } | null>(null);
  const [autoError, setAutoError] = useState("");
  const images = useRef(new Map<string, HTMLImageElement>());
  const panel = useRef<HTMLDivElement>(null);
  const cameraList = useRef<HTMLDivElement>(null);
  const cameras = useMemo(() => discoverCameras(topics), [topics]);
  const chooser = useMemo(() => getPowerLibAutoChooser(topics), [topics]);
  const model = driveModel(topics, status === "connected", now);
  const cameraIds = cameras.map(camera => camera.id).join("\n");
  const selectedCamera = cameras.find(c => c.id === selectedView);
  const streaming = cameras.filter(camera => visibleCameraIds.includes(camera.id) || camera.id === selectedView);
  const mode = model.live ? model.text("mode") ?? "UNKNOWN" : "UNKNOWN";
  const invalidFeedback = model.live && (model.boolean("poseValid") === false || model.boolean("speedsValid") === false);
  const state = model.live ? model.text("state") : undefined;
  const number = (key: Parameters<typeof model.number>[0]) => model.live ? model.number(key) : undefined;
  const metric = (value: number | undefined, places = 1) => value === undefined ? "—" : value.toFixed(places);

  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(timer); }, []);
  useEffect(() => {
    const timer = setInterval(() => setRetry(v => v + 1), 4000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => { try { localStorage.setItem(settingsKey, JSON.stringify(settings)); } catch { /* Keep session settings if storage is unavailable. */ } }, [settings]);
  useEffect(() => { if (selectedView !== "field" && !selectedCamera) setSelectedView("field"); }, [selectedView, selectedCamera]);
  useEffect(() => {
    const root = cameraList.current;
    if (!root) return;
    const visible = new Set<string>();
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const id = (entry.target as HTMLElement).dataset.cameraId!;
        if (entry.isIntersecting) visible.add(id); else visible.delete(id);
      }
      setVisibleCameraIds([...visible]);
    }, { root });
    root.querySelectorAll("[data-camera-id]").forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [cameraIds]);
  useEffect(() => {
    if (!pending) return;
    if (chooser?.path !== pending.path) { setPending(null); return; }
    if (!chooser.options.includes(pending.name)) { setPending(null); setAutoError("Selection no longer available"); return; }
    if (chooser.active === pending.name) { setPending(null); setAutoError(""); }
    else if (now - pending.at > 3000 || status !== "connected") { setPending(null); setAutoError("Selection not acknowledged"); }
  }, [pending, chooser, now, status]);
  useLayoutEffect(() => {
    const header = document.querySelector("header");
    const measure = () => panel.current?.style.setProperty("--drive-header-height", `${header?.getBoundingClientRect().height ?? 112}px`);
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    measure();
    return () => observer.disconnect();
  }, []);

  async function selectAuto(name: string) {
    const current = driveModel(topics, status === "connected", performance.now());
    if (!chooser || !current.canSelectAuto || !chooser.controllable || !chooser.options.includes(name)) return;
    setPending({ path: chooser.path, name, at: performance.now() });
    setAutoError("");
    try { await clientRef.current.publish(`${chooser.path}/selected`, "string", name); }
    catch (error) { setPending(null); setAutoError(error instanceof Error ? error.message : "Selection failed"); }
  }

  function exportSnapshot() {
    const blob = new Blob([JSON.stringify({ capturedAt: new Date().toISOString(), settings, topics }, (_, value) =>
      value instanceof ArrayBuffer ? { bytes: Array.from(new Uint8Array(value)) } : value, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "powerlib-drive-snapshot.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="drive-dashboard-viewport" ref={panel}><div className="drive-dashboard">
    <div className="drive-topline">
      {model.topic("mode") && <section className="drive-top-metric drive-match-time" aria-label="Match time">
        <span className="drive-top-metric-label">{mode}</span><b>{formatTime(number("time"))}</b>
      </section>}
      {model.topic("battery") && <section className={`drive-top-metric drive-battery ${model.live && model.boolean("brownout") ? "drive-danger" : ""}`} aria-label="Battery voltage">
        <span className="drive-top-metric-label">BATTERY{model.live && model.boolean("brownout") ? " · BROWNOUT" : ""}</span>
        <b>{metric(number("battery"))} V</b>
      </section>}
      <div className={`drive-robot-mode ${model.live ? "live" : ""}`}><span>ROBOT STATE</span><b>{state || "UNKNOWN"}</b></div>
      <button className="drive-tools" onClick={() => setTools(true)} aria-label="Open crew tools"><TuneIcon /><span>Crew tools</span></button>
    </div>
    <div className="drive-main">
      <div className={`drive-rail ${cameras.length ? "" : "without-cameras"}`}>
        <small className="drive-select-label">Select view</small>
        <button className={`drive-thumb drive-field-thumb ${selectedView === "field" ? "selected" : ""}`} onClick={() => setSelectedView("field")} aria-label="Show field view">
          <div className="drive-thumb-preview drive-field-preview" style={{ aspectRatio: `${settings.length} / ${settings.width}` }}><Field pose={model.pose} settings={settings} /></div><b>FIELD</b>
        </button>
        {cameras.length > 0 && <div className="drive-camera-list" ref={cameraList} role="region" aria-label="Camera views" tabIndex={0}>
        {cameras.map(camera => <button key={camera.id} data-camera-id={camera.id} className={`drive-thumb ${selectedView === camera.id ? "selected" : ""}`}
          onClick={() => setSelectedView(camera.id)} aria-label={`Show ${camera.name}`}>
          <div className="drive-thumb-preview drive-camera-preview"><CameraCanvas camera={camera} images={images} active={visibleCameraIds.includes(camera.id) || camera.id === selectedView}
            failed={!!failed[camera.id] || camera.connected === false} /></div><b>{camera.name.replace(/^limelight-/, "").toUpperCase()} CAMERA</b>
        </button>)}
        </div>}
        {!cameras.length && <div className="drive-no-cameras">Cameras appear here when published to NetworkTables.</div>}
      </div>
      <div className="drive-stage">{selectedCamera ? <CameraCanvas camera={selectedCamera} images={images} failed={!!failed[selectedCamera.id] || selectedCamera.connected === false} />
        : <Field pose={model.pose} settings={settings} />}</div>
      <aside className="drive-sidebar">
        {chooser && <section className="drive-auto"><div className="drive-auto-choice"><label htmlFor="drive-auto">AUTONOMOUS</label>
          <select id="drive-auto" value={pending?.path === chooser.path && chooser.options.includes(pending.name) ? pending.name :
            [chooser.active, chooser.selected, chooser.default].find(name => name !== undefined && chooser.options.includes(name)) ?? ""}
            disabled={!model.canSelectAuto || !chooser.controllable || !!pending} onChange={event => void selectAuto(event.target.value)}>
            <option value="" disabled>Select routine</option>{chooser.options.map(option => <option key={option}>{option}</option>)}
          </select></div>
          {(autoError || pending) && <small className={autoError ? "drive-warning" : ""}>{autoError || "Waiting for robot…"}</small>}
          {!model.canSelectAuto && <small>{model.live ? "Locked while enabled" : "Waiting for live disabled state"}</small>}
        </section>}
      </aside>
    </div>
    {(model.poseSupported || model.topic("gyro") || model.modules.length > 0) && <section className={`drive-drivetrain ${model.health}`} aria-label={`Drivetrain, health ${model.health}`}>
      <b className="drive-card-heading">Drivetrain</b>
      {model.poseSupported && <div className="drive-pose">
        <span>X <b>{metric(model.pose?.x, 2)}<small> m</small></b></span>
        <span>Y <b>{metric(model.pose?.y, 2)}<small> m</small></b></span>
        <span title="Heading">H <b>{metric(model.pose?.heading, 0)}°</b></span>
      </div>}
      <div className="drive-hardware">
        {model.topic("gyro") && <span className={!model.live || model.boolean("gyro") === undefined ? "unknown" : model.boolean("gyro") ? "good" : "bad"} title="Gyro communication health">GYRO</span>}
        {model.modules.map(module => <span key={module.name} className={module.connected === undefined ? "unknown" : module.connected ? "good" : "bad"}
          title={`${module.name}: ${module.connected === undefined ? "unknown" : module.connected ? "connected" : "disconnected"}`}>{module.name}</span>)}
      </div>
    </section>}
    <div className={`drive-status ${model.live && !invalidFeedback ? "healthy" : "unavailable"}`} role="status">
      <span className="drive-status-message">{status !== "connected" ? "ROBOT DATA UNAVAILABLE · CHECK CONNECTION" : invalidFeedback ? "DRIVETRAIN FEEDBACK INVALID" : model.live ? "ROBOT DATA LIVE" : model.topic("heartbeat") ? "ROBOT FEEDBACK STALE" : "CONNECTED · WAITING FOR DRIVE TELEMETRY"}</span>
      <div className="drive-health">
        <StatusFlag label="DS" ok={model.live ? model.boolean("ds") : undefined} />
        <StatusFlag label="FMS" ok={model.live ? model.boolean("fms") : undefined} />
        <StatusFlag label="CONTROLLER" ok={model.live ? model.boolean("controller") : undefined} />
        <StatusFlag label="POWER" ok={model.live && model.boolean("brownout") !== undefined ? !model.boolean("brownout") : undefined} />
        <span>RIO CAN {number("can") === undefined ? "—" : `${metric(number("can")! * 100, 0)}%`}</span>
      </div>
    </div>
    <div className="drive-stream-pool" aria-hidden="true">{streaming.map(camera => <img key={`${camera.id}-${settings.urls[camera.id] ?? camera.urls[0]}-${failed[camera.id] ? retry : 0}`}
      ref={element => { if (element) images.current.set(camera.id, element); else images.current.delete(camera.id); }}
      src={settings.urls[camera.id] ?? camera.urls[0]} alt="" onLoad={() => setFailed(v => v[camera.id] ? { ...v, [camera.id]: false } : v)}
      onError={() => setFailed(v => v[camera.id] ? v : { ...v, [camera.id]: true })} />)}</div>
    <Dialog open={tools} onClose={() => setTools(false)} maxWidth="sm" fullWidth><DialogTitle>Crew tools</DialogTitle><DialogContent className="drive-tool-fields">
      <p>Display settings stay on this laptop. Field coordinates use the blue origin.</p>
      <TextField label="Field length (m)" type="number" value={settings.length} onChange={e => { const length = Number(e.target.value); if (length > 0 && Number.isFinite(length)) setSettings(v => ({ ...v, length })); }} />
      <TextField label="Field width (m)" type="number" value={settings.width} onChange={e => { const width = Number(e.target.value); if (width > 0 && Number.isFinite(width)) setSettings(v => ({ ...v, width })); }} />
      <Button onClick={() => setSettings(v => ({ ...v, flip: !v.flip }))}>Flip field {settings.flip ? "(flipped)" : ""}</Button>
      {cameras.map(camera => <CameraUrlSetting key={camera.id} camera={camera} url={settings.urls[camera.id] ?? camera.urls[0]}
        onSave={url => setSettings(v => { const urls = { ...v.urls }; if (url) urls[camera.id] = url; else delete urls[camera.id]; return { ...v, urls }; })} />)}
      <Button onClick={exportSnapshot}>Export telemetry snapshot</Button>
    </DialogContent><DialogActions><Button onClick={() => setTools(false)}>Done</Button></DialogActions></Dialog>
  </div></div>;
}
