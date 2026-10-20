# Power Tool

Electron React app for Team 9410 PowerLib tools and FRC NT4 NetworkTables.

## Setup

```powershell
npm install
npm run dev
```

## NetworkTables

This app uses `ntcore-ts-client`, a TypeScript client for WPILib NetworkTables 4 over WebSocket. The UI connects to a selected host on port `5810`, watches configurable topic prefixes, and can publish boolean, integer, double, and string topics.

Common robot addresses:

```text
10.94.10.2
roborio-9410-frc.local
localhost
```

The target selector includes robot IP, roboRIO mDNS, local simulation, loopback, Driver Station laptop, and custom host options. NT4 usually runs on the robot or simulation host; use the Driver Station target only if that machine is running a NetworkTables server.

Use the prefix explorer to watch areas like:

```text
/PowerLib/
/Shuffleboard/
/LiveWindow/
/FMSInfo/
```

Rows appear as matching topic values arrive from NetworkTables.

## Custom dashboard

The Drive tab renders `dashboard/index.tsx`, which initially re-exports the
generic Drive dashboard. Customize that entry point and keep all custom
components, styles and assets in `dashboard/`. Installs and updates seed this
folder only when it is missing and preserve an existing folder without merging
or overwriting any files. The shared application and generic dashboard still
update normally. See [the custom dashboard guide](dashboard/README.md).

## Cameras and Limelight configuration

Visible camera thumbnails and the selected camera share one live stream per
camera. The selected camera's thumbnail pauses while its main view stays live;
the thumbnail resumes when another view is selected.
Published stream addresses are tried in order; a failed request or four
seconds without a first frame advances to the next address. When all addresses
fail, the list retries after four seconds. Healthy streams stay connected.
An explicit stream URL in Crew tools overrides the published addresses; clear it
to return to automatic discovery.

The Limelights tab embeds each camera's configuration page. If its automatic
`.local:5801` address is unreachable, enter a full Configuration URL such as
`http://10.94.10.11:5801` and click Apply. The address is saved per camera on this
laptop and used by both the frame and Open button. Reset restores the automatic
address. This setting is separate from the camera's stream URL.

## Robot tuning

The Robot tab shows clickable subsystem cards with their live readings. Click a card to open all of its tunables in the side panel; there is no variable selection or separate Tuning/Constants tab. Other constants groups appear after the subsystem cards, including groups discovered from the project's constants files or live NetworkTables variables. Commands with tunables also get their own cards.

The tuning switch stays in the header. Live edits require a connected robot and its acknowledgement that tuning is enabled. Apply publishes changes for that group; the Reset icon beside each field clears only that field's pending edit. Search filters the list without changing which variables belong to the group. Save Tuned Values saves that group's live values as project defaults.

Existing constants appear directly in the same side panel, alongside the group's live tunables. A published constant has one live row rather than a duplicate saved row. Apply sends live edits through NetworkTables and saves edits to saved-only values in the project configuration. Live values show their baseline beneath the field. Saved values can also be changed while disconnected; run Update Code, rebuild, and deploy to apply those defaults. Names and Java types stay fixed, and constants cannot be added or deleted. Numeric edits must fit the declared Java type.

## Scripts

```text
npm run dev      Start Vite and Electron for local development.
npm run build    Type-check and build the renderer and Electron main process.
npm run package:app
                 Build a local Windows app under ../PowerTool-local.
npm run package:publish
                 Build the publish app under ../PowerTool.
npm start        Run the built Electron app.
```

## Publish The App

The GitHub installer downloads this source into the robot project, runs `npm ci` using the dependency lockfile, and builds the app. Installation fails if dependency installation or the build fails. It does not ship the compiled app because the packaged output is too large for normal repository pushes.

From an installed robot project, start Power Tool with:

```powershell
.\power-tool\scripts\power-tool.cmd
```

Or:

```powershell
powershell -ExecutionPolicy Bypass -File .\power-tool\scripts\power-tool.ps1
```

Installed launchers run `npm start`, so Power Tool opens from the built app instead of starting the Vite dev server.

Installs and updates retain `build-dashboard.ps1` in the robot project root.
To rebuild and package the installed app without updating Power Tool, run:

```powershell
cd power-tool
npm run package:app
```

This uses the existing dependencies and writes to `PowerTool-local/` beside
`power-tool/`. On Windows, launch `PowerTool-local/win-unpacked/Power Tool.exe`.
The equivalent command from the robot root is
`powershell -ExecutionPolicy Bypass -File .\build-dashboard.ps1 -SkipInstall`.
Omit `-SkipInstall` when dependencies need to be installed. `-Publish` packages
to `PowerTool/` locally; it does not upload a release.

The same script also supports a local app rebuild from this library repo:

```powershell
cd E:\code\projects\Robot-Library
.\build-dashboard.ps1
```

That writes to `E:\code\projects\Robot-Library\PowerTool-local\`.

To make a compiled dashboard app locally:

```powershell
.\build-dashboard.ps1 -Publish
```

To target another platform explicitly:

```powershell
.\build-dashboard.ps1 -Platform win
.\build-dashboard.ps1 -Platform mac
.\build-dashboard.ps1 -Platform linux
```

Telemetry requests and screen updates use a 100 ms (10 Hz) cadence. PowerLib publishes the complete data map as one JSON frame at `/PowerLib/Data`. Each valid frame replaces the previous dashboard telemetry, including removed fields; intermediate frames are not queued. The pose is included in the map and is also exposed as a typed AdvantageScope topic from the same captured frame. SignalLogger records the latest map and log-only status every 20 ms (50 Hz); dashboard JSON serialization and typed-pose publication remain at 100 ms. Tuning subscriptions and the tuning display run every 200 ms (5 Hz), matching the robot's tuning reads and application. Apply sends edits immediately for the robot's next tuning pass. Older per-field robot publishers remain supported. Run `npm run check:telemetry` to verify complete-object replacement, arrival timestamps, invalid frames and connection resets.

The tuning switch retains its requested state while this Power Tool session reconnects to the same robot. Every 200 ms the app compares that state with both the NetworkTables request and the robot's acknowledgement; it resends on mismatch and after reconnection, so a code deploy or robot reboot does not require toggling off and on. The switch shows `Tuning (syncing)` while awaiting acknowledgement. Changing the connection host/port starts with that robot's state. Run `npm run check:tuning` to check recovery, acknowledgement, retry and display timing behavior.
