# Power Tool

User guides: [Power Tool](../docs/power-tool.md), [Auto Builder](../docs/auto-builder.md), and [Log Viewer](../docs/log-viewer.md). This file contains the more detailed Power Tool source and UI reference.

**File → Settings → Integrations** builds its list from the project catalog and runs the servers you enable. [Integration setup and catalog format](../docs/integrations.md)

## Shared field layouts

Choose **View → Field Layout** or **File → Settings → Field → Field layout** to select the
2026 REBUILT simplified drawing, 2026 field image, 2025 REEFSCAPE field image, or
**None (custom dimensions)**. Dashboard, its thumbnail, the Autos field preview,
and Logs position/heat-map views share the selection and blue-origin coordinates.
Logs retains its vertical field presentation, robot trail, heat map, and swerve view.

Layouts supply their calibrated dimensions. Choose None to edit custom dimensions;
switching layouts preserves those custom values. These display preferences stay
on this laptop and do not change robot Java or the coordinates stored in a log.
Autos uses this shared field for its routine editor.

In **File → Settings → Field → Bumper perimeter**, enter the outside bumper length
(front to back) and width (left to right) in inches. Both default to **32 inches**.
Save bumper dimensions to update the scaled robot outline in Dashboard, its
thumbnail, Autos, named-point editing, and log position/heat-map playback. Selected
auto points and new-point previews show the footprint at their commanded heading.
The dimensions persist on this laptop across field-layout changes and restarts.

## Autos editor

Power Tool opens at 1920 × 1200. Create a routine with **New auto**. The Steps panel
has one **Add step** dropdown with **Add point**, **Add wait**, **Execute state**, and
**Wait for state**, and **Add branch**. The standalone state steps use a Robot state dropdown and run
in list order. A drive point's
settings include optional **Execute state** and **Wait for state** dropdowns, both
None by default. After arrival, the robot requests the Execute state if set, then
waits for the selected actual state if set, before proceeding. State waits have no
timeout; older saved state timeouts are disabled. Either option works independently.
Add wait inserts a timed delay. The settings divider stays outside the scroll area.
All new steps go immediately after the selected step, or at the end when none is
selected. Each step row has a trash icon. Select a step to edit its settings. Click
empty field space to clear the selection. Create the first point with **Add step → Add point**.
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
The first point sets the starting pose in simulation. Use **Turning** to turn immediately, turn
after a percentage of the leg, or face a field point throughout the leg. The **Limit turn rate**
option sets a maximum for that leg.
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
`.withHeadingTolerance(Rotation2d.fromDegrees(10))`. Saved auto documents use version 6.

Undo and redo icons sit beside the **Steps** label. Each row has a move icon,
duplicate icon, and trash icon. Drag anywhere on a row to move it; using the move
icon is optional. Duplicate inserts a copy immediately after that row, regardless
of which steps are selected. Copy/paste and group actions remain available through
the keyboard shortcuts. A yellow insertion line marks
the exact drop position above/below a step or at the end of the list. Shift-click a point or step row
to select every step between the current selection and the clicked item, including
wait/state steps. Ctrl/Cmd-click toggles an individual item. A plain click selects one
item; dragging a selected point keeps the group together. Drag a box on empty field
space to select points; Ctrl or Shift adds the box to the current selection. Dragging a selected point moves
the selected group while keeping its spacing; one drag is one undo action. Click
blank field space (including the dark margin), blank space in the steps list, or
press Escape to deselect. Escape also works from a numeric/text field. Group
settings align positions and edit motion limits. Snapping aligns positions with
other points, field edges/center, and 45° neighbor lines; headings snap near 45°
angles and other point headings. Creating a point by dragging **+** uses only
its source point's X/Y and 45° lines for point alignment, plus field edges/center.
Hold Ctrl while dragging to bypass snapping, including when starting a **+** drag.

Use **Save as named point** in a point's settings, then select that name from another
point's **Named point** dropdown to share its position and heading across routines.
Editing any link updates all links. Use the highlighted **Routines / Points** switch
at the top of the left card. In Points, **New point** adds a shared point; selecting
one opens its name, X/Y, and heading editor on the right in place of Steps. Drag its
position or heading on the field to edit it there. Point edits autosave; Save updates
generated Java. The list trash icon removes the name and unlinks uses while preserving
their coordinates. There is no named-points dialog or Routine settings menu.
Drag either inter-card gap to resize panes; widths persist on this computer.

In Routines, the bottom divider separates the list from **New auto**, followed by
**Duplicate auto**. Select a routine and click Duplicate auto to create another routine.
Choose a name and **Mirror axis**: None for an exact copy, X for field length, Y for
field width, or both. The copy appears in the left list and can be edited independently;
its points are unlinked from shared named points. X reflection switches Blue/Red
alliance; Y reflection keeps the source alliance. Save to update generated robot code.

**Help → Auto Keyboard Shortcuts** lists the controls from any tab: Ctrl/Cmd Z for undo, Shift Z or Y
for redo, C/V/D for copy/paste/duplicate, A to select all, and S to Save. Delete removes
selected steps. Arrows move selected points 5 cm (Shift: 25 cm), Q/E rotate headings
15° (Shift: 1°), and Alt+Up/Down reorders steps. Text and numeric fields keep their
normal typing behavior. Undo history lasts for the current app session.

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

In **File → Settings → Field → Upload a field**, drop a PNG, JPEG, or WebP image or click
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

Power Tool can share the optional WPILib **Live Robot Data** server connection when it matches the selected host and port. It uses `ntcore-ts-client` over WebSocket when the shared connection is unavailable. The default port is `5810`. The topic explorer supports configurable prefixes, and the app supports boolean, integer, double, and string publications. [Integration setup](../docs/integrations.md)

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
generic dashboard. Customize that entry point in this source checkout and keep custom
components, styles and assets in `dashboard/`. Rebuild and package Power Tool to distribute
those changes. [Custom dashboard guide](dashboard/README.md)

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

Open **File → Settings** for the settings modal. Select
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
The starter defaults to no minimum area, a 5 m cap for position and multi-tag heading,
and a 2 m cap for single-tag heading. These settings can limit the per-tag tiers defined in
`VisionConstants.java`. Enabled MegaTag1 heading uses its own 1/2/2.5 m tiers.
[Vision filtering](../docs/vision.md#heading-correction-and-camera-selection)
Older robots show unavailable fields until the library is updated.
Apply changes live values. Save tuned values reviews the current card's live values and saves selected differences directly to Java. Localization edits update the four defaults in VisionConstants and the recognized CONFIG/HEADING_CONFIG bindings while preserving other vision policy. Build and deploy to use the defaults at startup.

Saves serialize project operations, check source revisions and use recoverable multi-file transactions. Unsupported Java expressions remain read-only. Source changes made in the IDE are discovered on refresh; a stale form cannot silently overwrite them. Vision and LED cards retain their existing behavior.

Successfully applied tunables also have an app-local JSON recovery cache, isolated by robot project and connection profile/host/port. Restore edits loads matching values into pending drafts after an app restart. It never automatically reapplies them or changes code defaults. Apply and Save tuned values remain separate actions.

The app has Dashboard, Autos and Logs tabs. The Limelights tab appears when cameras are discovered.
Open the NetworkTables drawer from the View menu, subsystem configuration from **File → Settings**,
and live mechanism tuning from the Dashboard cards. Open **Logs → Characterize Robot** for SysId
and position crawl. [Characterization guide](../docs/characterization.md)

File → Settings → Vision manages an ordered list of Limelights, with Add, Edit and Delete.
New names always use `limelight-` followed by lowercase letters, numbers and
hyphen-separated words; duplicates are rejected. Camera entries contain only
names. Horizontal FOV in degrees and positive integer image width/height are
shared Vision settings that apply to every Limelight. These describe the
cameras; actual camera pipeline settings remain in their Limelight web UIs.
Save updates `VisionConstants.LIMELIGHT_NAMES` and the shared scalar FOV/width/height declarations directly. Other vision policy and custom code remain intact. Build and deploy to apply changed camera names to the robot.

File > Settings > States manages names using the inline Add, Edit and Delete list. Names use uppercase letters, numbers and underscores. The list comes from `StateMachine.RobotState`; Java additions appear on refresh. Save updates the enum, creates missing handler files and updates the registry immediately. IDLE is implicit and hidden, and its enum value and handler stay last. Existing handler bodies, constructor expressions and priority are preserved. A handwritten opaque guard requires Java review rather than an unconditional generated fallback.

Deleting a state asks for confirmation to remove its Java file, including custom code. Cancel preserves it. A confirmed save still rejects references elsewhere in robot source, including a configured default state. New handlers need mechanism actions and readiness checks added in Java.

Legacy configuration JSON is consumed only by a migration review. It compares real Java against saved fields, lets you choose values, backs up source and originals under `build/power-tool-migration/`, then archives legacy files after a successful source save. Normal operation creates no configuration JSON. File > Build Robot compiles the source without regeneration.

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

## Distribute the app

The project ZIP on [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases)
contains the prebuilt Windows application and its Electron runtime. Users extract
its contents into a clean WPILib robot project and launch **Power Tool.cmd**.
They do not need Node or npm. The bundled `power-tool/app/` directory is ignored
by Git; robot source and auto definitions remain available to commit.

Maintainers build both release ZIPs from the Robot-Library root with:

```powershell
.\release.ps1 -SkipInstall
```

Omit `-SkipInstall` when npm dependencies need to be installed. The app-only ZIP updates
Power Tool in an existing project. The full project ZIP also contains the robot templates
and pinned vendor dependencies. Both appear under `build/distributions/`. [Release workflow](../docs/development.md#build-the-distribution)
