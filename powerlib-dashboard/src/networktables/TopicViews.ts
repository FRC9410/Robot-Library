import type { NtTopicSnapshot } from "./nt4Client";

export type TopicView = "all" | "app" | "drive" | "robot" | "tuning";
const cameraMetadata = (name: string) => /^\/limelight[^/]*\//.test(name)
  || /^\/[^/]+\/(?:tv|tx|ty|ta|hb|heartbeat|getpipe|pipeline|botpose|json)$/.test(name);
const matches = (view: TopicView, name: string) => {
  if (view === "all") return true;
  if (view === "app") return name.startsWith("/PowerLib/Tuning/") || name.startsWith("/PowerLib/Characterization/") || cameraMetadata(name);
  if (view === "drive") return /^\/PowerLib\/Subsystems\/[^/]+\/Data\//.test(name) || name.startsWith("/PowerLib/Drive/")
    || name.startsWith("/SmartDashboard/Auto Chooser/") || name.startsWith("/SmartDashboard/Field/")
    || name.startsWith("/Robot/") || name.startsWith("/CameraPublisher/") || /^\/limelight[^/]*\//.test(name);
  if (view === "tuning") return /^\/PowerLib\/(?:Subsystems|Commands)\/[^/]+\/Variables\//.test(name) || name.startsWith("/PowerLib/Tuning/");
  return /^\/PowerLib\/Subsystems\/[^/]+\/Data\//.test(name) || name.startsWith("/PowerLib/Data/");
};

/** Stable snapshots let React skip consumers whose selected topics did not change. */
export class TopicViews {
  private views = new Map<TopicView, NtTopicSnapshot[]>(["all", "app", "drive", "robot", "tuning"].map(view => [view as TopicView, []]));
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get = (view: TopicView) => this.views.get(view)!;
  replace(topics: NtTopicSnapshot[], updateTuning = true) {
    for (const [view, previous] of this.views) {
      if (view === "tuning" && !updateTuning) continue;
      const oldByName = view === "app" ? new Map(previous.map(topic => [topic.name, topic])) : null;
      const next = topics.filter(topic => matches(view, topic.name)).map(topic => {
        // Camera discovery uses names/types; image and pose value traffic must not rerender the app shell.
        const old = oldByName?.get(topic.name);
        return view === "app" && cameraMetadata(topic.name) && old?.type === topic.type ? old : topic;
      });
      if (next.length !== previous.length || next.some((topic, index) => topic !== previous[index])) this.views.set(view, next);
    }
    this.listeners.forEach(listener => listener());
  }

  refreshTuning() {
    const previous = this.get("tuning");
    const next = this.get("all").filter(topic => matches("tuning", topic.name));
    if (next.length === previous.length && next.every((topic, index) => topic === previous[index])) return;
    this.views.set("tuning", next);
    this.listeners.forEach(listener => listener());
  }
}
