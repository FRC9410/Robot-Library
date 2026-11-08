# Power Tool

## Shared field layouts

Choose **View → Field Layout** or **Config → Field → Field layout** to select the
2026 REBUILT simplified drawing, 2026 field image, 2025 REEFSCAPE field image, or
**None (custom dimensions)**. Dashboard, its thumbnail, the Autos field preview,
and Logs position/heat-map views share the selection and blue-origin coordinates.
Logs retains its vertical field presentation, robot trail, heat map, and swerve view.

Layouts supply their calibrated dimensions. Choose None to edit custom dimensions;
switching layouts preserves those custom values. These display preferences stay
on this laptop and do not change robot Java or the coordinates stored in a log.
Autos uses this shared field for its routine editor.

## Autos editor

Power Tool opens at 1920 × 1200. Create a routine with **New auto**. The Steps panel
has one **Add step** dropdown with **Add point**, **Add wait**, **Execute state**, and
**Wait for state**. The standalone state steps use a Robot state dropdown and run
in list order. A drive point's
settings include optional **Execute state** and **Wait for state** dropdowns, both
None by default. After arrival, the robot requests the Execute state if set, then
waits for the selected actual state if set, before proceeding. State waits have no
timeout; older saved state timeouts are disabled. Either option works independently.
Add wait inserts a timed delay. The settings divider stays outside the scroll area.
All new steps go immediately after the selected step, or at the end when none is
selected. Each step row has a trash icon. Select a step to edit its settings. Empty
field clicks do nothing. Create the first point with **Add step → Add point**.
Select a point to show its green **+** handle, then drag it to preview a new point and release
to insert it immediately after its source. The new point inherits the source heading;
the source stays fixed. Clicking the handle without dragging adds nothing; Escape
or pointer cancellation discards the preview. Dragging a point's center changes
its position. Select a drive point and drag the handle at the tip of its heading
arrow to turn it without moving the point. The handle also accepts arrow keys
(1 degree, or 15 degrees with Shift); the numeric heading remains editable.
Numbers sit inside point dots; the selected point is filled without a focus box.
The dotted segment leading into the selected point is highlighted white and thicker.
Field drags do not select text or highlight the field border, and creation handles
only appear on the selected point, hide while dragging the heading, and return on release.
The first point is the simulation start. Existing standalone state steps from older
documents retain their original order and behavior. Existing point state actions
also remain available and unchanged. Mid-drive progress actions are planned for a later phase.
Name and alliance share one
row above the field. Delete a routine from its list row; confirmation is required.
Generated routines are never defaults: None remains the initial chooser selection.
Every generated routine clears its owned state request on completion or cancellation.
This releases the requested state so another request or the fallback state can take
over; it does not clear other owners' requests. The center contains the field and
name/alliance controls, with no code preview or optional cleanup controls.

Drive steps finish within their distance and measured-speed tolerances. Enable
**Wait for heading** to also require alignment with the commanded heading; its
default tolerance is 10 degrees, adjustable above 0 through 180 degrees. It is off
for new steps and older documents. Java callers can opt in with
`.withHeadingTolerance(Rotation2d.fromDegrees(10))`. Saved documents use version 4
so older generators cannot silently ignore point state actions or heading completion.

Edits autosave to the detected robot project's `power-tool/generated/powerlib-autos.json`.
The single **Save** button stays at the bottom of Steps. It flushes the authoring
document, updates `GeneratedAutos.java`, and adds the registration hook without
replacing handwritten routines. There is no Autos header/toolbar; outer margins and
card gaps are all 12 px. **Build Robot** remains compile-only. Build and restart
simulation or deploy after saving. The
generation step uses current Java state names and rejects duplicate auto names,
invalid steps, source conflicts, and files owned by handwritten code. Reload reads
current project files through the Reload action shown with a save/read error;
unsaved changes require confirmation before discarding. Reopening the app also reads
current Java state names and handwritten autos.
Newer or unsupported auto formats are preserved read-only.

`npm run check:autos` validates persistence, version guards, name/state checks,
recoverable Java writes, source preservation, generated-code compilation, and command
execution with real WPILib scheduling and stubbed hardware. Run the library checks
and generated-robot fixture first. `scripts/auto-editor-electron-check.cjs` checks the
real App/preload/IPC workflow in an isolated robot with robot connections blocked;
its Build Robot action uses a fixture stub. The real robot is built separately.

In **Config → Field → Upload a field**, drop a PNG, JPEG, or WebP image or click
the drop box to browse (up to 10 MB). Preview it, set a name and full field length
and width in meters, then save. Use an image cropped to the field edges with the
blue origin at the bottom left; the rotation checkbox can turn it 180 degrees.
The saved upload is selected immediately in every field view and is also available
under **View → Field Layout → Uploaded field**. Edit its name, dimensions, or
orientation with **Edit uploaded field**, or replace/remove it from Config.
The image is copied into Power Tool's local app data and survives moving the original
file or restarting the app. Built-in layouts and saved custom grid dimensions are preserved.

Run `npm run check:fields` for field geometry checks. Run
`npm run check:field-upload` for uploaded-field validation and persistence checks. Run
`node_modules/electron/dist/electron.exe scripts/field-layout-electron-check.cjs`
for the isolated App/menu/preload check, or append an installed `power-tool` path
to run the same check against that copy. It blocks robot connections, generates
a sample log, and saves screenshots under `build/dashboard-checks/`.

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

The Limelights tab embeds each camera's configuration page and provides an Open
button to launch it in a browser. Both use the automatic `.local:5801` address
unless a configuration address was previously saved for that camera.

## Configuration

Open **Config** in the dashboard header for the settings modal. Select
**Subsystems** on the left and expand a subsystem to inspect its read-only
configuration. The **Edit** action stays in each expander header.

**Add Subsystem** opens a wizard with Basics, Hardware, Controls and Review
steps. The back arrow returns to settings; Previous returns to an earlier step.
The final step shows the complete configuration and requires verification before
saving. Edit uses the same wizard with the existing values prefilled. Saving
updates Java configuration; build and deploy
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
numeric, boolean and text tunables. A Position section appears when the robot
publishes `Position/Default`, with the default position in mechanism rotations.
Configured `velocityTorque` mechanisms also expose Torque FF in Feedforward,
using `Feedforward/Torque`; ordinary velocity mechanisms do not show that field.
Edit values, then Apply; the reset beside a
field clears its pending edit. Collapsing a section preserves pending edits.
Editing requires a connected robot and acknowledged Tuning mode. Unpublished
settings remain unavailable.
The Drivetrain card uses the same tuning interaction, with 15 settings in
collapsed Driver, Requests, Drive to Point and Heading PID sections. It reads
and writes `Subsystems/Swerve/Variables/`, while pose telemetry stays under
Drive. A Custom section appears for published Swerve custom tunables.
A collapsed Localization section exposes Vision's target area threshold (average
AprilTag area, percent of the image), maximum position target distance, maximum
heading tag distance and single-tag heading maximum distance (meters).
These write `Subsystems/Vision/Variables/Position/TargetAreaThreshold`,
`Position/MaxTargetDistanceMeters`, `Heading/MaxTagDistanceMeters` and
`Heading/SingleTagMaxDistanceMeters`. The updated Limelight reader applies valid
edits at 5 Hz while Tuning is enabled and keeps the last applied values when
disabled. Position filters and heading filters have independent distance limits.
The overall heading distance also caps single-tag distance; single-tag recovery
still requires its stricter ambiguity, freshness and stationary stability checks.
Defaults preserve the prior policy: no minimum area and the configured maximum
position distance (6.25 m), with heading limits of 4 m and 2 m for single tags.
Older robots show unavailable fields until the library is updated.
Apply changes live values. Save tuned values reviews the current card's live values and saves selected differences directly to Java. Localization edits update the four defaults in VisionConstants and the recognized CONFIG/HEADING_CONFIG bindings while preserving other vision policy. Build and deploy to use the defaults at startup.

Saves serialize project operations, check source revisions and use recoverable multi-file transactions. Unsupported Java expressions remain read-only. Source changes made in the IDE are discovered on refresh; a stale form cannot silently overwrite them. Vision and LED cards retain their existing behavior.

Successfully applied tunables also have an app-local JSON recovery cache, isolated by robot project and connection profile/host/port. Restore edits loads matching values into pending drafts after an app restart. It never automatically reapplies them or changes code defaults. Apply and Save tuned values remain separate actions.

The app has Dashboard, Limelights and Logs tabs; NetworkTables opens in a drawer from the View menu. Subsystem
configuration is accessed through Config on the Dashboard; mechanism tuning is
accessed through the enabled mechanism cards.

Config → Vision manages an ordered list of Limelights, with Add, Edit and Delete.
New names always use `limelight-` followed by lowercase letters, numbers and
hyphen-separated words; duplicates are rejected. Camera entries contain only
names. Horizontal FOV in degrees and positive integer image width/height are
shared Vision settings that apply to every Limelight. These describe the
cameras; actual camera pipeline settings remain in their Limelight web UIs.
Save updates `VisionConstants.LIMELIGHT_NAMES` and the shared scalar FOV/width/height declarations directly. Other vision policy and custom code remain intact. Build and deploy to apply changed camera names to the robot.

Config > States manages names using the inline Add, Edit and Delete list. Names use uppercase letters, numbers and underscores. The list comes from `StateMachine.RobotState`; Java additions appear on refresh. Save updates the enum, creates missing handler files and updates the registry immediately. IDLE is implicit and hidden, and its enum value and handler stay last. Existing handler bodies, constructor expressions and priority are preserved. A handwritten opaque guard requires Java review rather than an unconditional generated fallback.

Deleting a state asks for confirmation to remove its Java file, including custom code. Cancel preserves it. A confirmed save still rejects references elsewhere in robot source, including a configured default state. New handlers need mechanism actions and readiness checks added in Java.

Legacy configuration JSON is consumed only by a migration review. It compares real Java against saved fields, lets you choose values, backs up source and originals under `build/power-tool-migration/`, then archives legacy files after a successful source save. Normal operation creates no configuration JSON. The old JSON generator refuses to run. File > Build Robot compiles the source without regeneration.

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
