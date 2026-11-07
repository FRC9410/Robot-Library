/** One .hoot or .wpilog in the logs folder; `folder` is its subfolder relative to the logs folder ("" at the top). */
export type LogFileEntry = { path: string; folder: string; name: string; modifiedMs: number; size: number };

/** The FMS match a log was recorded in, from its file name. */
export type LogMatch = { event: string; type: string; number: number };

/** One robot run in the logs folder: every file from it (one per CAN bus, the roboRIO's first). */
export type SavedLog = {
  id: string;
  name: string;
  /** Epoch ms the run started (from the file name's time stamp, else the file's modified time). */
  start: number;
  match?: LogMatch;
  /** Its subfolder, relative to the logs folder. */
  folder: string;
  /** All its files together. */
  bytes: number;
  files: string[];
};

export type SavedLogGroup = { id: string; title: string; subtitle: string; logs: SavedLog[] };
export type LogFilter = "matches" | "practice" | "all";

const locale = "en-US";
const matchTypes: Record<string, string> = { Q: "Qual", P: "Practice", E: "Elim" };
const isRio = (name: string) => /(^|_)rio_/i.test(name);

/**
 * What a file name says about its run. Phoenix names .hoot files `[<EVENT>_<Q12>_]<bus>_YYYY-MM-DD_HH-MM-SS.hoot`
 * (the event and match only when the FMS was connected) and keeps local time. WPILib's DataLogManager names
 * .wpilog files `FRC_YYYYMMDD_HHMMSS[_<EVENT>_<Q12>].wpilog` in UTC.
 */
export function parseLogFileName(name: string): { stamp?: string; start?: number; match?: LogMatch } {
  const base = name.replace(/(\.hoot)?(\.wpilog)?$/i, "");
  const wpilib = /^FRC_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})(?:_([A-Za-z0-9]+)_([PQE])(\d+))?/i.exec(base);
  if (wpilib) {
    const [, year, month, day, hour, minute, second, event, type, number] = wpilib;
    return {
      stamp: `${year}${month}${day}${hour}${minute}${second}`,
      start: Date.UTC(+year, +month - 1, +day, +hour, +minute, +second),
      match: event ? { event: event.toUpperCase(), type: type.toUpperCase(), number: +number } : undefined
    };
  }
  const phoenix = /(\d{4})-(\d{2})-(\d{2})_(\d{2})-(\d{2})-(\d{2})$/.exec(base);
  const prefix = /^([A-Za-z0-9]+)_([PQE])(\d+)_/i.exec(base);
  return {
    stamp: phoenix ? phoenix.slice(1).join("") : undefined,
    start: phoenix ? new Date(+phoenix[1], +phoenix[2] - 1, +phoenix[3], +phoenix[4], +phoenix[5], +phoenix[6]).getTime() : undefined,
    match: prefix ? { event: prefix[1].toUpperCase(), type: prefix[2].toUpperCase(), number: +prefix[3] } : undefined
  };
}

/** "Qual 25", "Practice 3", "Elim 4". */
export const matchLabel = (match: LogMatch) => `${matchTypes[match.type] ?? match.type} ${match.number}`;

/** "Qual 25 · MOLEE" or "Fri, Apr 3, 2:15 PM", for the status bar once a saved log is open. */
export const savedLogTitle = (log: SavedLog) => log.match
  ? `${matchLabel(log.match)} · ${log.match.event}`
  : new Date(log.start).toLocaleString(locale, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** "Fri 2:15 PM": the week header already gives the date. */
export const runLabel = (start: number) =>
  new Date(start).toLocaleString(locale, { weekday: "short", hour: "numeric", minute: "2-digit" }).replace(",", "");

/** When a row in the list ran: "Fri 2:39 PM" for a match (its event header gives the dates), "Apr 3" for other runs (named by time already). */
export const savedLogWhen = (log: SavedLog) => (log.match ? runLabel(log.start) : shortDate(log.start));

/** "640 KB", "18 MB", "1.2 GB"; blank when the size is unknown. */
export function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes)) return "";
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)} MB`;
  return `${Math.max(1, Math.round(bytes / 1e3))} KB`;
}

/** Files from the same run (same folder and time stamp) become one saved log, newest first. */
export function groupLogFiles(files: LogFileEntry[]): SavedLog[] {
  const runs = new Map<string, { files: LogFileEntry[]; start: number; match?: LogMatch }>();
  for (const listed of files) {
    // Same id whether the folder came from Windows (\) or from a download (/), so "Open" and "Loaded" line up.
    const file = { ...listed, folder: listed.folder.replace(/\\/g, "/") };
    const parsed = parseLogFileName(file.name);
    const key = parsed.stamp ? `${file.folder}|${parsed.stamp}` : file.path;
    const run = runs.get(key) ?? { files: [], start: parsed.start ?? file.modifiedMs, match: parsed.match };
    run.files.push(file);
    run.match ??= parsed.match;
    runs.set(key, run);
  }
  return Array.from(runs, ([id, run]) => ({
    id,
    name: run.match ? matchLabel(run.match) : runLabel(run.start),
    start: run.start,
    match: run.match,
    folder: run.files[0].folder,
    bytes: run.files.reduce((sum, file) => sum + file.size, 0),
    files: [...run.files].sort((left, right) => Number(isRio(right.name)) - Number(isRio(left.name)) || left.name.localeCompare(right.name))
      .map(file => file.path)
  })).sort((left, right) => right.start - left.start);
}

const shortDate = (time: number) => new Date(time).toLocaleDateString(locale, { month: "short", day: "numeric" });

/** "Oct 24" or "Nov 1–2" (or "Oct 31–Nov 1") for the days a group covers. */
export function dayRange(times: number[]) {
  const first = Math.min(...times);
  const last = Math.max(...times);
  if (new Date(first).toDateString() === new Date(last).toDateString()) return shortDate(first);
  const sameMonth = new Date(first).getMonth() === new Date(last).getMonth();
  return `${shortDate(first)}–${sameMonth ? new Date(last).getDate() : shortDate(last)}`;
}

/** Monday 00:00 of the week `time` falls in. */
function weekStart(time: number) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.getTime();
}

/**
 * The event's header: a folder named for it if there is one ("2026 KSLA - Heartland" holding "Qual 6 (…)"),
 * else the event code. A folder that also names the match ("KSLA_Q6") doesn't count.
 */
export function eventTitle(log: SavedLog) {
  const event = log.match!.event;
  const folder = log.folder.split(/[\\/]/).reverse()
    .find(part => part.toUpperCase().includes(event) && !new RegExp(`${event}_[PQE]\\d+`, "i").test(part));
  return folder ?? event;
}

const fileName = (filePath: string) => filePath.split(/[\\/]/).pop() ?? filePath;
const pad = (value: number) => value.toString().padStart(2, "0");
/** "2026-03-20_14-39" in local time. */
const stampText = (time: number) => {
  const date = new Date(time);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}`;
};

/** True when every file of a robot run is already in the logs folder (matched by file name). */
export function isDownloaded(robotLog: SavedLog, local: SavedLog[]) {
  const names = new Set(local.flatMap(log => log.files.map(fileName)));
  return robotLog.files.every(file => names.has(fileName(file)));
}

/**
 * The folder (relative to the logs folder) a robot run downloads into, matching the layout the list reads:
 * a match goes in its event's folder (reusing one already there, like "2026 KSLA - Heartland") as
 * "Qual 6 (2026-03-20_14-39)"; any other run goes in "Shop/2026-03-28 05-49".
 */
export function downloadFolderFor(log: SavedLog, local: SavedLog[]) {
  const stamp = stampText(log.start);
  if (!log.match) return `Shop/${stamp.replace("_", " ")}`;
  const event = log.match.event;
  const sameEvent = local.find(item => item.match?.event === event && eventTitle(item) !== event);
  const parts = sameEvent?.folder.split(/[\\/]/) ?? [];
  const index = parts.lastIndexOf(sameEvent ? eventTitle(sameEvent) : "");
  const eventFolder = index >= 0 ? parts.slice(0, index + 1).join("/") : `${new Date(log.start).getFullYear()} ${event}`;
  return `${eventFolder}/${matchLabel(log.match)} (${stamp})`;
}

const matchesSearch = (log: SavedLog, search: string) => {
  const text = search.trim().toLowerCase();
  return !text || [log.name, log.match?.event ?? "", log.folder].some(value => value.toLowerCase().includes(text));
};

/**
 * The list the Logs tab shows: match logs grouped by event, everything else grouped by week,
 * groups ordered by their newest log. Logs inside a group stay newest first.
 */
export function groupSavedLogs(logs: SavedLog[], filter: LogFilter, search = ""): SavedLogGroup[] {
  const groups = new Map<string, SavedLogGroup>();
  for (const log of logs) {
    if ((filter === "matches" && !log.match) || (filter === "practice" && log.match) || !matchesSearch(log, search)) continue;
    const id = log.match ? `event:${log.match.event}` : `week:${weekStart(log.start)}`;
    const group = groups.get(id) ?? { id, title: log.match ? eventTitle(log) : `Week of ${shortDate(weekStart(log.start))}`, subtitle: "", logs: [] };
    group.logs.push(log);
    groups.set(id, group);
  }
  return Array.from(groups.values(), group => ({
    ...group,
    logs: [...group.logs].sort((left, right) => right.start - left.start),
    subtitle: group.id.startsWith("event:") ? dayRange(group.logs.map(log => log.start)) : `${group.logs.length} run${group.logs.length === 1 ? "" : "s"}`
  })).sort((left, right) => right.logs[0].start - left.logs[0].start);
}
