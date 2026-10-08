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

For a local app rebuild from this library repo, run:

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
