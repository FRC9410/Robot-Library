# Custom dashboard

This folder belongs to your robot project. Power Tool installs and updates copy
it only when it does not exist; an existing folder is kept in full, including
components, CSS, images, JSON and other assets.

`index.tsx` exports the `DashboardPanel` component rendered on the Drive tab.
Initially it re-exports the generic Drive dashboard, so you keep receiving
generic dashboard improvements until you replace that export.

To customize it, export your own component with an optional `subsystems` prop:

```tsx
import type { GeneratedSubsystem } from "../src/features/subsystems/types";

export function DashboardPanel({ subsystems = [] }: { subsystems?: GeneratedSubsystem[] }) {
  return <main>{subsystems.map(subsystem => <div key={subsystem.id}>{subsystem.name}</div>)}</main>;
}
```

Keep all custom components and assets here and use relative imports, for example
`import "./dashboard.css"` or `import fieldImage from "./assets/field.png"`.
You can reuse `DrivePanel` from `../src/features/drive/DrivePanel` and read live
data through `useTopics` or `useNetworkTables` from
`../src/features/networktables/NetworkTablesContext`.

To extend the generic view without copying it, pass `renderTopCards` and
`renderSidebar` to `DrivePanel`. Each callback receives `{ topics, drive, now }`
from the existing 100 ms display loop. Top cards appear after the match timer;
sidebar content appears below the autonomous selector.

The surrounding Power Tool header, tuning switch, Robot tab and other tabs stay
managed by Robot-Library. Files under `src/` and `electron/` are refreshed during
updates; move any existing custom dashboard edits into this folder first.
Shared component interfaces may change between releases, so the update build
still checks your custom dashboard for compatibility without overwriting it.

Run `npm run build` from `power-tool/` after editing. `npm run package:app` also
builds this dashboard and includes its imported assets in the packaged app.
Commit this folder with your robot project. To return to the generic view,
restore the original export in `index.tsx`.
