# Custom dashboard

This folder is part of the Power Tool source checkout. The Dashboard tab renders
`dashboard/index.tsx`; the default exports the generic Drive dashboard. Customize
it here and rebuild the release ZIP to distribute your changes. The prebuilt
release does not load editable React source from the robot project.

To customize it, export your own component with an optional `subsystems` prop:

```tsx
import type { GeneratedSubsystem } from "../src/features/subsystems/types";

export function DashboardPanel({ subsystems = [] }: { subsystems?: GeneratedSubsystem[] }) {
  return <main>{subsystems.map(subsystem => <div key={subsystem.id}>{subsystem.name}</div>)}</main>;
}
```

Keep all custom components and assets here and use relative imports, for example
`import "./dashboard.css"` or `import fieldImage from "./assets/field.png"`.
You can reuse `DashboardPanel` from `../src/features/dashboard/DashboardPanel` and read live
data through `useTopics` or `useNetworkTables` from
`../src/features/networktables/NetworkTablesContext`.

To extend the generic view without copying it, pass `renderTopCards` and
`renderSidebar` to `DashboardPanel`. Each callback receives `{ topics, dashboard, now }`
from the existing 100 ms display loop. Top cards appear after the match timer;
sidebar content appears below the autonomous selector.

The surrounding Power Tool header, tuning switch and navigation tabs are shared
with the other app views. Keep your dashboard customization in version control
and review shared component interfaces when updating the source checkout.

Run `npm run build` from `powerlib-dashboard/` after editing. Run
`./release.ps1 -SkipInstall` from the repository root to package both release ZIPs.
To return to the generic view,
restore the original export in `index.tsx`.
