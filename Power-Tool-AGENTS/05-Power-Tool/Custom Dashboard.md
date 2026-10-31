---
title: Custom Dashboard
date: 2026-10-30
tags: [power-tool, dashboard, customization]
---

# Custom Dashboard

Each robot project owns the Drive tab's content: `power-tool/dashboard/`, seeded from
`powerlib-dashboard/dashboard/`.

- **Installs and updates never overwrite an existing `dashboard/` folder** (`Copy-PowerToolAppFiles` in `powerlib-dashboard/scripts/project-layout.ps1`). Everything under `power-tool/src/` is managed by Robot-Library and gets replaced on update.
- The default `dashboard/index.tsx` is one line:
  `export { DrivePanel as DashboardPanel } from "../src/features/drive/DrivePanel";`
- `App.tsx` renders `<DashboardPanel subsystems={…} />`. The only prop is `subsystems?: GeneratedSubsystem[]`.
- `DrivePanel` also accepts extension slots: `renderTopCards?(data)` and `renderSidebar?(data)`. `data` is `{topics, drive, now}`.
- Custom components can use `useTopics(view)` and `useNetworkTables()` from `src/features/networktables/NetworkTablesContext`.
- Rebuild after edits with `npm run package:app` from `power-tool/`, or run `build-dashboard.ps1 -SkipInstall` from the robot root.

Full contract: `powerlib-dashboard/dashboard/README.md`. Update behavior:
[Power Tool Update Flow](../02-Install-and-Update/Power%20Tool%20Update%20Flow.md).

Related: [Tabs and Features](Tabs%20and%20Features.md), [Power Tool Architecture](Power%20Tool%20Architecture.md)
