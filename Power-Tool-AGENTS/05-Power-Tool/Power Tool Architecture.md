---
title: Power Tool Architecture
date: 2026-10-30
tags: [power-tool, electron, react, architecture]
---

# Power Tool Architecture

Power Tool is the team's desktop dashboard: an **Electron** app with a **React 19 + MUI** renderer,
built with **Vite** and **TypeScript**. Source lives in `powerlib-dashboard/`. The installer copies
it into a robot project as `<robot>/power-tool/` and builds it there
(see [Power Tool Update Flow](../02-Install-and-Update/Power%20Tool%20Update%20Flow.md)).

```mermaid
flowchart LR
  subgraph Electron main process
    M[electron/main.ts] --- PP[projectPaths.ts]
    M --- CF[constantsFiles.ts]
  end
  P[electron/preload.cts<br/>window.powerlib] 
  subgraph Renderer React
    A[App.tsx] --> NTC[NetworkTablesContext]
    NTC --> NT[nt4Client.ts<br/>ntcore-ts-client]
    A --> Tabs[Drive / Robot / Subsystems / Limelights / NetworkTables]
  end
  M <-- IPC --> P <--> A
  NT <-- NT4 websocket :5810 --> Robot[(Robot / sim)]
  M -- runs --> PS[PowerShell scripts<br/>generate-subsystem.ps1, install.ps1, update-power-tool.ps1]
  M -- reads/writes --> J[(power-tool/generated/*.json<br/>constants *.java read-only)]
```

## Build and run

| Script (`powerlib-dashboard/package.json`) | What it does |
|---|---|
| `npm run dev` | Builds electron, starts Vite on `127.0.0.1:5173`, launches Electron against it |
| `npm run build` | `tsc` type-check → `vite build` to `dist-renderer/` → `tsc -p tsconfig.electron.json` to `dist-electron/` |
| `npm start` | `electron .` runs the built app (what the installed launchers call) |
| `npm run package:app` / `package:publish` | Calls `../build-dashboard.ps1` → electron-builder `--dir` into `PowerTool-local/` or `PowerTool/` |
| `npm run check:*` | Node check scripts; see [Tests and Checks](../07-Testing/Tests%20and%20Checks.md) |

- Key dependencies: `ntcore-ts-client` 3.1.3 (pinned NT4 client), `@mui/material` 9, `electron` 39, `electron-builder`, `zod` (patches the NT library's schemas).
- **No charting library** is installed yet.
- `index.html` sets a strict CSP: `script-src 'self'`; `connect-src 'self' ws: wss:` plus localhost http. A log viewer that uses workers or blobs may need CSP changes.
- electron-builder: appId `org.team9410.powerlib.powertool`. Every platform builds an unpacked `dir` target (no installer).

## Main process (`electron/main.ts`)

- Window 1180×780 (min 960×640), `contextIsolation: true`, `nodeIntegration: false`. External links open in the system browser.
- **Robot root detection** (`getDetectedRobotRoot`): walks up to 8 levels from cwd, app path and `__dirname` until it finds a folder with `build.gradle`, `settings.gradle`, `src/main/java` or `power-tool/scripts/generate-subsystem.ps1`.
- **File menu:** Connection Settings, Update Code, Update PowerLib Library Files, Update Vendor Dependencies, Update Power Tool.

### IPC channels

| Channel | Purpose |
|---|---|
| `powerlib:read-subsystems` / `save-subsystems` | Read and merge-write `power-tool/generated/powerlib-subsystems.json` |
| `powerlib:read-constants` / `save-constants` | `constantsFiles.ts`: parse `*Constants.java`, save edits to `powerlib-constants.json` (**never rewrites Java**) |
| `powerlib:update-subsystem-code` | Runs `generate-subsystem.ps1 -UpdateSubsystems -SubsystemsJson …` ("Update Code") |
| `powerlib:update-install-section` | Runs `install.ps1` non-interactively for `lib` or `vendordeps`, using the ref in `.powerlib-repo-ref` |
| `powerlib:update-power-tool` | Launches `update-power-tool.ps1` detached in a console, then quits the app |
| `powerlib:menu-*` (main → renderer) | Menu clicks forwarded to React |

`preload.cts` exposes these as `window.powerlib` (types in `src/types/electron.d.ts`).
**There is no file-dialog or arbitrary file-read API yet.**

### Helper modules
- `projectPaths.ts`: `generatedJsonPath()` always resolves to `<robot>/power-tool/generated/<file>`. Old root-level copies are migrated there, and conflicting duplicates go to `generated/legacy/`.
- `constantsFiles.ts`: finds subsystem and robot `*Constants.java` targets and parses `public static final|volatile` declarations at class depth 1, including the custom-constants marker block. It overlays saved JSON and Swerve defaults, validates edits, and writes JSON atomically. Details: [Tuning Round Trip](../06-Data-Flows/Tuning%20Round%20Trip.md).

## Renderer

- `src/main.tsx`: MUI dark theme (primary `#facc15`) → `<App/>`.
- `src/App.tsx`: `NetworkTablesProvider` → `AppContent`, which holds the app bar (tuning switch, connect, host chip), the tabs, the global dialogs and the toast. It also owns the connection, prefix watches, the subsystem document and Update Code calls. See [Tabs and Features](Tabs%20and%20Features.md).
- `src/types/app.ts`: `AppView = "drive" | "robot" | "subsystems" | "limelights" | "networktables"`. Add a new value here to add a tab, e.g. `"logs"`.
- NetworkTables plumbing: [NetworkTables Layer](NetworkTables%20Layer.md).

Related: [NetworkTables Layer](NetworkTables%20Layer.md), [Tabs and Features](Tabs%20and%20Features.md), [Custom Dashboard](Custom%20Dashboard.md), [Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md), [Log Viewer Project](../11-Ideas/Log%20Viewer%20Project.md)
