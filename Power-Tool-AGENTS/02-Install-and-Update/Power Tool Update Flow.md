---
title: Power Tool Update Flow
date: 2026-10-30
tags: [installer, power-tool, powershell]
---

# Power Tool Update Flow

How the Power Tool source gets into a robot project, gets rebuilt, and gets updated. Most of the
logic lives in the shared helpers in `powerlib-dashboard/scripts/project-layout.ps1`.

## What's preserved in `<robot>/power-tool/`

| Folder | Owner | On update |
|---|---|---|
| `generated/` | robot project | **kept** (JSON configs; old copies archived in `generated/legacy/`) |
| `scripts/` | mixed | kept, then refreshed script by script |
| `dashboard/` | robot project | **kept**; only seeded when missing |
| everything else (`src/`, `electron/`, `package.json`…) | Robot-Library | deleted and replaced |

`Reset-PowerToolAppFiles` deletes everything except those three folders. `Copy-PowerToolAppFiles`
copies the new source, skipping `generated`, `scripts`, `node_modules` and the `dist-*` folders.

## First install: `build-dashboard-install.ps1`
`install.gradle` runs it as `power-tool/scripts/power-tool-install.ps1`.
1. Get the source: the repo zip from `github.com/FRC9410/Robot-Library/archive/refs/heads/<ref>.zip`, or a local `-SourceRoot`.
2. Lay out the folders: `Initialize-PowerToolLayout`, stop running Power Tool processes, reset app files, copy app files.
3. Copy in the helper scripts: `install.ps1` and `project-layout.ps1` into `scripts/`, `build-dashboard.ps1` to the robot root, and `PowerDashboard.java` to `scripts/templates/` (the generator uses it as a reference).
4. `npm ci` + `npm run build`.
5. Write the launchers `power-tool.cmd` / `power-tool.ps1`. They start `node_modules/electron/dist/electron.exe`, or fall back to `npm start`.
6. Copy `update-power-tool.ps1` and `generate-subsystem.ps1` into `scripts/`, and write the `powerlib-generate-subsystem.cmd` and `powerlib-update-subsystems.cmd` wrappers.
7. Write `.powerlib-repo-ref` and `.powerlib-source-root` markers.

## In-app update: **File → Update Power Tool**
1. `electron/main.ts` copies `update-power-tool.ps1` to `power-tool-update.ps1`, launches it detached with `-ParentPid`, and quits.
2. The script waits for the app to exit, then downloads the source using the saved ref or source root.
3. It loads the **downloaded** `project-layout.ps1`, so new layout rules apply even to an older install.
4. It resets and copies the app files, as on first install.
5. It copies `skills/` and the whole `powerlib-dashboard/scripts/` folder, replaces itself, and refreshes the generator and launchers.
6. `npm ci` + build, then relaunches Power Tool. Log file: `build/power-tool-update.log`.

The other File menu actions, **Update PowerLib Library Files** and **Update Vendor Dependencies**,
rerun `install.ps1` non-interactively for just that section. See [Installer Flow](Installer%20Flow.md).

## Packaging an exe: `build-dashboard.ps1`
`-Platform current|win|mac|linux`, `-Publish`, `-SkipInstall`.
- Runs `npm install` + `npm run build`, then `electron-builder --dir`.
- Output: `PowerTool-local/win-unpacked/Power Tool.exe`, or `PowerTool/` with `-Publish`.
- Local only; nothing is uploaded.

Related: [Installer Flow](Installer%20Flow.md), [Power Tool Architecture](../05-Power-Tool/Power%20Tool%20Architecture.md), [Custom Dashboard](../05-Power-Tool/Custom%20Dashboard.md)
