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

The Dashboard tab renders `dashboard/index.tsx`, which initially re-exports the
generic dashboard. Customize that entry point and keep all custom
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

The Limelights tab embeds each camera's configuration page. If its automatic
`.local:5801` address is unreachable, enter a full Configuration URL such as
`http://10.94.10.11:5801` and click Apply. The address is saved per camera on this
laptop and used by both the frame and Open button. Reset restores the automatic
address. This setting is separate from the camera's stream URL.

## Configuration

Open **Config** in the dashboard header for the settings modal. Select
**Subsystems** on the left and expand a subsystem to inspect its read-only
configuration. The **Edit** action stays in each expander header.

**Add Subsystem** opens a wizard with Basics, Hardware, Controls and Review
steps. The back arrow returns to settings; Previous returns to an earlier step.
The final step shows the complete configuration and requires verification before
saving. Edit uses the same wizard with the existing values prefilled. Saving
updates the project configuration; use File > Update Code, rebuild and deploy
to apply it to the robot. Run `npm run check:config` for validation checks.

Select **Field** to change the full field length and width in meters. Save
dimensions to update the main field and its thumbnail immediately. Dimensions
must be positive and finite and are saved on this laptop. Reset to defaults
loads the bundled template dimensions into the form; save to apply them.
Field dimensions do not change robot calibration or constants.

## Robot tuning

With connected, acknowledged Tuning enabled, mechanism cards gain a glowing
border, pointer cursor and hover highlight. With Tuning off they remain
read-only, with no click action or tuning highlight.
Click an enabled mechanism card on the Dashboard to open its live tuning
sections: PID kP/kI/kD/kG, feedforward kS/kV/kA, and Motion Magic cruise velocity
and acceleration. Sections start collapsed. A Sensor section appears when the
mechanism publishes CANcoder tunables, with magnet offset and discontinuity
point in rotations. A Custom section appears when that
mechanism publishes supported values under `Variables/Custom/`; it supports
numeric, boolean and text tunables. Edit values, then Apply; the reset beside a
field clears its pending edit. Collapsing a section preserves pending edits.
Editing requires a connected robot and acknowledged Tuning mode. Unpublished
settings remain unavailable.
These edits change live values; they do not save project defaults. Drivetrain,
Vision and LED cards retain their existing behavior.

The app routes only to Dashboard, Limelights and NetworkTables. Subsystem
configuration is accessed through Config on the Dashboard; mechanism tuning is
accessed through the enabled mechanism cards.

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
