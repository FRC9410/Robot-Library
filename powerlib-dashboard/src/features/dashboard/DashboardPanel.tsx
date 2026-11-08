import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TuneIcon from "@mui/icons-material/Tune";
import { FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import { SubsystemTuningDialog } from "./SubsystemTuningDialog";
import { drivetrainTuningOwner } from "./drivetrainTunables";
import { canTuneMechanism } from "./mechanismTunables";
import { useNetworkTables, useTopics } from "../networktables/NetworkTablesContext";
import { tuningModeTopicName } from "../networktables/tuningUtils";
import { discoverCameras, discoverMechanisms, getPowerLibAutoChooser, dashboardModel, formatTime } from "./dashboardModel";
import { FieldView } from "../field/components/FieldView";
import { useFieldLayout } from "../field/useFieldLayout";
import { useDashboardSettings } from "./useDashboardSettings";
import type { DashboardCamera } from "./dashboardModel";
import { startCameraStream } from "./cameraStream";
import type { GeneratedSubsystem } from "../subsystems/types";
import type { ReactNode } from "react";
import type { NtTopicSnapshot } from "../../networktables/nt4Client";
import "./dashboard.css";

function CameraCanvas({ camera, images, failed, active = true }: { camera: DashboardCamera; images: React.MutableRefObject<Map<string, HTMLImageElement>>; failed: boolean; active?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const draw = () => {
      const img = images.current.get(camera.id);
      const canvas = ref.current;
      if (canvas && img?.naturalWidth && img.naturalHeight) {
        if (canvas.width !== img.naturalWidth) canvas.width = img.naturalWidth;
        if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
        const context = canvas.getContext("2d");
        if (context) {
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
        }
      }
      frame = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(frame);
  }, [camera.id, images, active]);
  return <div className="dashboard-camera-view">
    <canvas ref={ref} width="640" height="640" aria-label={`${camera.name} live camera`} />
    {failed && <span className="dashboard-camera-message">Stream unavailable</span>}
  </div>;
}

function CameraStream({ camera, override, images, onFailed }: {
  camera: DashboardCamera;
  override?: string;
  images: React.MutableRefObject<Map<string, HTMLImageElement>>;
  onFailed: (id: string, failed: boolean) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const sources = JSON.stringify(override ? [override] : camera.urls);
  useEffect(() => startCameraStream(container.current!, JSON.parse(sources), image => {
    if (image) images.current.set(camera.id, image);
    else images.current.delete(camera.id);
  }, failed => onFailed(camera.id, failed)), [camera.id, sources, images, onFailed]);
  return <div ref={container} />;
}

export type DashboardPanelData = { topics: NtTopicSnapshot[]; dashboard: ReturnType<typeof dashboardModel>; now: number };

export function DashboardPanel({ subsystems = [], renderTopCards, renderSidebar, onOpenConfig, tuningRequested = false }: {
  subsystems?: GeneratedSubsystem[];
  renderTopCards?: (data: DashboardPanelData) => ReactNode;
  renderSidebar?: (data: DashboardPanelData) => ReactNode;
  onOpenConfig?: () => void;
  tuningRequested?: boolean;
}) {
  const { status, clientRef, connectionSettings } = useNetworkTables();
  const topics = useTopics("dashboard");
  const appTopics = useTopics("app");
  const tuningEnabled = status === "connected" && tuningRequested
    && appTopics.find(topic => topic.name === tuningModeTopicName)?.value === true;
  const settings = useDashboardSettings();
  const layout = useFieldLayout();
  const field = layout ?? settings;
  const [now, setNow] = useState(performance.now());
  const [selectedView, setSelectedView] = useState("field");
  const [visibleCameraIds, setVisibleCameraIds] = useState<string[]>([]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState<{ path: string; name: string; at: number } | null>(null);
  const [autoError, setAutoError] = useState("");
  const [tuningSubsystem, setTuningSubsystem] = useState<{ id: string; name: string; kind: "mechanism" | "drivetrain" } | null>(null);
  const DrivetrainCard = tuningEnabled ? "button" : "section";
  const images = useRef(new Map<string, HTMLImageElement>());
  const updateCameraFailure = useCallback((id: string, failed: boolean) => {
    setFailed(current => current[id] === failed ? current : { ...current, [id]: failed });
  }, []);
  const panel = useRef<HTMLDivElement>(null);
  const cameraList = useRef<HTMLDivElement>(null);
  const cameras = useMemo(() => discoverCameras(topics), [topics]);
  const chooser = useMemo(() => getPowerLibAutoChooser(topics), [topics]);
  const model = dashboardModel(topics, status === "connected", now);
  const mechanisms = useMemo(() => discoverMechanisms(topics, subsystems, status === "connected", now), [topics, subsystems, status, now]);
  const cameraIds = cameras.map(camera => camera.id).join("\n");
  const selectedCamera = cameras.find(c => c.id === selectedView);
  const streaming = cameras.filter(camera => visibleCameraIds.includes(camera.id) || camera.id === selectedView);
  const mode = model.live ? model.text("mode") ?? "UNKNOWN" : "UNKNOWN";
  const invalidFeedback = model.live && model.boolean("poseValid") === false;
  const requestedState = model.live ? model.text("requestedState") : undefined;
  const actualState = model.live ? model.text("actualState") : undefined;
  const number = (key: Parameters<typeof model.number>[0]) => model.live ? model.number(key) : undefined;
  const metric = (value: number | undefined, places = 1) => value === undefined ? "—" : value.toFixed(places);

  useEffect(() => { const timer = setInterval(() => setNow(performance.now()), 100); return () => clearInterval(timer); }, []);
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
    const titlebar = document.querySelector(".window-titlebar");
    const measure = () => panel.current?.style.setProperty("--dashboard-header-height", `${(header?.getBoundingClientRect().height ?? 112) + (titlebar?.getBoundingClientRect().height ?? 0)}px`);
    const observer = new ResizeObserver(measure);
    if (header) observer.observe(header);
    if (titlebar) observer.observe(titlebar);
    measure();
    return () => observer.disconnect();
  }, []);

  async function selectAuto(name: string) {
    const current = dashboardModel(topics, status === "connected", performance.now());
    if (!chooser || !current.canSelectAuto || !chooser.controllable || !chooser.options.includes(name)) return;
    setPending({ path: chooser.path, name, at: performance.now() });
    setAutoError("");
    try { await clientRef.current.publish(`${chooser.path}/selected`, "string", name); }
    catch (error) { setPending(null); setAutoError(error instanceof Error ? error.message : "Selection failed"); }
  }

  return <div className="dashboard-dashboard-viewport" ref={panel}><div className="dashboard-dashboard">
    <div className="dashboard-topline">
      {model.topic("mode") && <section className="dashboard-top-metric dashboard-match-time" aria-label="Match time">
        <span className="dashboard-top-metric-label">{mode}</span><b>{formatTime(number("time"))}</b>
      </section>}
      {renderTopCards?.({ topics, dashboard: model, now })}
      {model.topic("battery") && <section className="dashboard-top-metric dashboard-battery" aria-label="Battery voltage">
        <span className="dashboard-top-metric-label">BATTERY</span>
        <b>{metric(number("battery"))} V</b>
      </section>}
      <section className={`dashboard-robot-mode ${model.live ? "live" : ""}`} aria-label="Robot status">
        <div className="dashboard-state-row"><span>REQUESTED STATE</span><b title={requestedState}>{requestedState?.replaceAll("_", " ") || "UNKNOWN"}</b></div>
        <div className="dashboard-state-row"><span>ACTUAL STATE</span><b title={actualState}>{actualState?.replaceAll("_", " ") || "UNKNOWN"}</b></div>
      </section>
      {onOpenConfig && <button type="button" className="dashboard-config" aria-label="Open Config" onClick={onOpenConfig}>
        <SettingsOutlinedIcon /><span>Config</span>
      </button>}
    </div>
    <div className="dashboard-main">
      <div className={`dashboard-rail ${cameras.length ? "" : "without-cameras"}`}>
        <button className={`dashboard-thumb dashboard-field-thumb ${selectedView === "field" ? "selected" : ""}`} onClick={() => setSelectedView("field")} aria-label="Show field view">
          <div className="dashboard-thumb-preview dashboard-field-preview" style={{ aspectRatio: `${field.length} / ${field.width}` }}><FieldView pose={model.pose} dimensions={settings} layout={layout} flip={settings.flip} emptyMessage="Waiting for live robot pose" /></div><b>FIELD</b>
        </button>
        {cameras.length > 0 && <div className="dashboard-camera-list" ref={cameraList} role="region" aria-label="Camera views" tabIndex={0}>
        {cameras.map(camera => <button key={camera.id} data-camera-id={camera.id} className={`dashboard-thumb ${selectedView === camera.id ? "selected" : ""}`}
          onClick={() => setSelectedView(camera.id)} aria-label={`Show ${camera.name}`}>
          <div className="dashboard-thumb-preview dashboard-camera-preview"><CameraCanvas camera={camera} images={images} active={visibleCameraIds.includes(camera.id) && camera.id !== selectedView}
            failed={!!failed[camera.id] || camera.connected === false} /></div><b>{camera.name.replace(/^limelight-/, "").toUpperCase()} CAMERA</b>
        </button>)}
        </div>}
        {!cameras.length && <div className="dashboard-no-cameras">Cameras appear here when published to NetworkTables.</div>}
      </div>
      <div className="dashboard-stage">{selectedCamera ? <CameraCanvas camera={selectedCamera} images={images} failed={!!failed[selectedCamera.id] || selectedCamera.connected === false} />
        : <FieldView pose={model.pose} dimensions={settings} layout={layout} flip={settings.flip} emptyMessage="Waiting for live robot pose" />}</div>
      <aside className="dashboard-sidebar">
        {chooser && <section className="dashboard-auto"><FormControl fullWidth size="small">
          <InputLabel id="dashboard-auto-label" shrink>Autonomous</InputLabel>
          <Select id="dashboard-auto" labelId="dashboard-auto-label" label="Autonomous" notched
            value={pending?.path === chooser.path && chooser.options.includes(pending.name) ? pending.name :
            [chooser.active, chooser.selected, chooser.default].find(name => name !== undefined && chooser.options.includes(name)) ?? ""}
            disabled={!model.canSelectAuto || !chooser.controllable || !!pending} onChange={event => void selectAuto(event.target.value)}>
            {chooser.options.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
          </Select></FormControl>
          {(autoError || pending) && <small className={autoError ? "dashboard-warning" : ""}>{autoError || "Waiting for robot…"}</small>}
          {!model.canSelectAuto && <small>{model.live ? "Locked while enabled" : "Waiting for live disabled state"}</small>}
        </section>}
        {renderSidebar?.({ topics, dashboard: model, now })}
      </aside>
    </div>
    {(model.poseSupported || mechanisms.length > 0) && <div className="dashboard-subsystems" role="region" aria-label="Subsystems">
    {model.poseSupported && <DrivetrainCard className={`dashboard-drivetrain${tuningEnabled ? " dashboard-mechanism-tunable" : ""}`}
      type={tuningEnabled ? "button" : undefined} aria-label={tuningEnabled ? "Open Drivetrain tunables" : "Drivetrain pose"}
      aria-haspopup={tuningEnabled ? "dialog" : undefined}
      onClick={tuningEnabled ? () => setTuningSubsystem({ id: drivetrainTuningOwner, name: "Drivetrain", kind: "drivetrain" }) : undefined}>
      <b className="dashboard-card-heading"><span>Drivetrain</span>{tuningEnabled && <TuneIcon />}</b>
      {model.poseSupported && <div className="dashboard-pose">
        <span>X <b>{metric(model.pose?.x, 2)}<small> m</small></b></span>
        <span>Y <b>{metric(model.pose?.y, 2)}<small> m</small></b></span>
        <span className="dashboard-heading">Heading <b>{metric(model.pose?.heading, 0)}°</b>
          {model.headingSetpoint !== undefined && <small className="dashboard-setpoint">Setpoint: {metric(model.headingSetpoint, 0)}°</small>}
        </span>
      </div>}
    </DrivetrainCard>}
    {mechanisms.map(mechanism => {
      const tunable = tuningEnabled && canTuneMechanism(mechanism.id);
      const Card = tunable ? "button" : "section";
      return <Card key={mechanism.id} className={`dashboard-mechanism${tunable ? " dashboard-mechanism-tunable" : ""}`}
        type={tunable ? "button" : undefined} aria-label={tunable ? `Open ${mechanism.name} tunables` : mechanism.name}
        aria-haspopup={tunable ? "dialog" : undefined} onClick={tunable ? () => setTuningSubsystem({ id: mechanism.id, name: mechanism.name, kind: "mechanism" }) : undefined}>
        <b className="dashboard-card-heading" title={mechanism.name}><span>{mechanism.name}</span>{tunable && <TuneIcon />}</b>
        <span className="dashboard-mechanism-value"><b>{metric(mechanism.value, mechanism.places)}</b><small> {mechanism.units}</small></span>
        {mechanism.setpoint !== undefined && <small className="dashboard-setpoint">Setpoint: {metric(mechanism.setpoint, mechanism.places)} {mechanism.units}</small>}
      </Card>;
    })}
    </div>}
    <div className={`dashboard-status ${model.live && !invalidFeedback ? "healthy" : "unavailable"}`} role="status">
      <span className="dashboard-status-message">{status !== "connected" ? "ROBOT DATA UNAVAILABLE · CHECK CONNECTION" : invalidFeedback ? "DRIVETRAIN FEEDBACK INVALID" : model.live ? "ROBOT DATA LIVE" : model.topic("heartbeat") ? "ROBOT FEEDBACK STALE" : "CONNECTED · WAITING FOR ROBOT TELEMETRY"}</span>
      <div className="dashboard-health">
        <span>ALLIANCE {model.live ? model.text("alliance")?.toUpperCase() || "UNKNOWN" : "UNKNOWN"}</span>
        <span>RIO CAN {number("can") === undefined ? "—" : `${metric(number("can")! * 100, 0)}%`}</span>
      </div>
    </div>
    <div className="dashboard-stream-pool" aria-hidden="true">{streaming.map(camera => <CameraStream key={camera.id}
      camera={camera} override={settings.urls[camera.id]} images={images} onFailed={updateCameraFailure} />)}</div>
    {tuningSubsystem && <SubsystemTuningDialog key={`${connectionSettings.targetId}:${connectionSettings.host}:${connectionSettings.port}:${tuningSubsystem.id}`} owner={tuningSubsystem.id} name={tuningSubsystem.name}
      kind={tuningSubsystem.kind} subsystems={subsystems} tuningRequested={tuningRequested} onClose={() => setTuningSubsystem(null)} />}
  </div></div>;
}
