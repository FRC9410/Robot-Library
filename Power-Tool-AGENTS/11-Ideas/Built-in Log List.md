---
title: Built-in Log List
date: 2026-11-03
tags: [idea, log-viewer]
status: decided
---

# Built-in Log List

**Status:** Decided; partly built 2026-11-03 (see [Tabs and Features](../05-Power-Tool/Tabs%20and%20Features.md)).
- **Built:** the list in a popup from the start page's centered Open log button (the team preferred that to the list filling the start page) and in a drawer when a log is open, Matches / Practice / All, search, event groups (titled by the event's folder), week groups, folder setting, the `LoadedLogsProvider` context and the last 3 logs kept in memory.
- **Not yet:** `session.json` (alliance, enabled time, practice at events), renaming, the "New" tag, the missing-file warning, the on-disk conversion cache, reopening the last log on start, and the "On robot" section.
- **Match names come from file names for now.** Phoenix already names `.hoot` files `<EVENT>_<Q12>_...` when the FMS is connected, so matches get "Qual 6" with no `session.json`.

## Idea
The Logs tab's start page lists every log in one folder that you set once, so opening a log is a
click on a row instead of a trip through File Explorer.

## Why
Opening a log today means **Open log**, then hunting through folders for the right file and
the files that go with it.

## Keep it uncluttered
Each row shows only what helps you pick the log. Leave out the rest:
- **Time and size are back (2026-11-03).** Once the list was built, rows had empty space on the right, so each row now shows when it ran ("Fri 2:39 PM" for a match, "Apr 3" for other runs) and the run's total size. No full dates on match rows; the event header gives them.
- **No file list** ("rio + CANivore"). Show a warning only when a file is missing ("No CANivore log").
- Shop sessions keep their date and time, because that's their name until someone renames them.

## Layout
- **Header:** "Robot logs", with [Get logs from robot](Pull%20Logs%20from%20the%20Robot.md) on the right (greyed out when the robot is off).
- **Filters:** Matches, Practice, All, plus a search box (finds "Qual 14" or a name you gave). **Matches is the default**, because the team looks at match logs, not shop logs.
- **Grouped by event**, each a collapsible section ("NY Regional (NYRO)"), newest first. Sessions away from an event go under **Shop**, grouped by week.
- **Rows:**
  - Match: "Qual 14", then alliance station and enabled time ("Blue 1 · 2m 31s enabled").
  - Practice at an event: "Practice field · 9:05 AM", then enabled time and enable count.
  - Shop: its name, or the date and time if it has none; a pencil renames it.
  - A **New** tag on sessions not opened yet.
- **Footer:** the folder path with **Change** (a Power Tool setting, default `Documents\Power Tool\Logs`), and an "Open another file" link (the only place File Explorer still shows up). Dropping a file anywhere still opens it.

## Names
Session names come from a small `session.json` that PowerLib writes into each log folder on the
robot: event name, match type and number, alliance station (all from `DriverStation`), and
enabled time. Power Tool reads it straight away, without converting the `.hoot` through Owlet.
Logs without it fall back to the date and time. A name you type is saved in the same
`session.json` on the laptop. See [Pull Logs from the Robot](Pull%20Logs%20from%20the%20Robot.md).

## Folder layout on disk
One folder per session, grouped the same way as the list, so the folder still makes sense in File Explorer:

```
Logs\
  2026 NYRO\
    Qual 12 (Nov 1 11-20)\
      rio_....hoot
      canivore_....hoot
      session.json
  Shop\
    2026-10-28 18-10\
      ...
      session.json   (a typed name goes here; the folder keeps its name)
```

- A session's `rio` and CANivore files stay together, which is what the Logs tab needs to open them as a set.
- Renaming never moves or renames a folder, so it can't break anything or collide.

## Mentor feedback (Chad, 2026-11-03)
- **A drawer instead of a popup.** The list (and the robot's logs) open in a drawer from the right, over the open log, so you can switch logs without leaving it. A **Logs** button in the status bar opens it. With no log open, the same list fills the start page. The robot's logs become an "On robot" section in the drawer (a download button per row) instead of the [Get logs from robot](Pull%20Logs%20from%20the%20Robot.md) dialog.
- **Keep loaded logs above the components.** Component state is lost when the component unmounts, so the wanted state lives higher up or in context. Today the open log lives in `useLogFile` inside `LogsPanel`, and survives tab switches only because `App.tsx` keeps `LogsPanel` mounted and hidden. Proposal: a `LogSessionProvider` (React context) at the app level holds the loaded logs, and `LogsPanel` and the drawer read from it.
  - Keep the last two or three parsed logs in memory, so going back to Qual 12 from Qual 14 is instant ("Loaded" in the drawer).
  - Cache each `.hoot` → `.wpilog` conversion on disk, keyed by file path and modified time, so reopening a log (even after restarting Power Tool) skips Owlet.
  - Remember the last opened log, so Power Tool can offer to reopen it on start.

## Open questions
- Read enabled time and enable count from `session.json` only, or also fill them in for old logs by reading the log once and caching it?

Related: [Pull Logs from the Robot](Pull%20Logs%20from%20the%20Robot.md), [Log Viewer Project](Log%20Viewer%20Project.md), [Match List](Match%20List.md), [Timeline Notes and Bookmarks](Timeline%20Notes%20and%20Bookmarks.md)
