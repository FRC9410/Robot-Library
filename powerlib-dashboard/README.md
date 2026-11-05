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

## Auto Builder

The Autos tab builds routines for the existing `frc.powerlib.auto.Auto` API without changing it. The left column lists the project's autos and the named points they share. The center shows the selected auto: its name (click to rename), alliance, symmetry and default star, with the save status, undo, redo and reload at the right; then the field (or the generated code) and the replay bar. The right column lists the steps in run order, with the selected step's settings below (Esc or the × closes them). Dragging the handles between the columns resizes them; on a window narrower than 1500 px they start narrower so the field gets the room. The field prompts the next action for a new auto, and setting explanations sit behind info icons.

The field draws each drive point as a robot outline with its front bar and swerve modules, whose wheels point along the direction of travel. The colored line is the replay's ideal route (rounded where loose tolerances let legs blend), with a dot every 0.1 s so spacing shows speed; faint dashes show the straight line to each target.

Click the field to add a drive point after the selection. Drag a robot to move it; positions snap to other points' X or Y, the field center lines, and 45° lines from neighboring points, with a guide showing the match. Drag the handle in front of a selected or hovered robot to aim it; headings snap to 45° steps (so 90° too), the path direction and neighbors' headings (Shift: 15° steps). Hold Ctrl while dragging to turn snapping off. Shift-click robots or steps to select several, drag on empty field to box-select, or press Ctrl+A; a selection moves, nudges, turns, copies and deletes together, and the inspector can set its limits at once or line the points up on the same X or Y. Steps run in order:

- Drive to point: `DriveToPose` with this leg's max velocity, max acceleration and finish tolerances (`DriveConstraints`). The leg ends once the robot is within the end distance and slower than the end velocity. Loosen both to round a point without stopping. New legs copy the previous leg's limits, and Use for all legs copies them across the auto.
- Subpoints (a drive step's "During this move"): state requests made partway along the leg, at a percentage of the straight line from where the leg started (`DriveToPose.atProgress`). If the leg finishes first, for example with loose tolerances, they run when it ends. They show as diamonds on the path that you can drag; the path changes color at each one, and the replay timeline marks when they fire.
- Turning (a drive step's "Turning"): Now turns toward the target heading as the leg starts. Later holds the starting heading until a percentage of the leg is done (`DriveToPose.turningAfter`). Face point keeps the front aimed at a spot, such as the hub, for the whole leg and ends facing it (`DriveToPose.facing`); drag its crosshair on the field, or drop it on a named point to link them. Max turn rate caps how fast the leg turns (`withMaxTurnRate`); empty uses the robot's default. Legs finish on position, so a slow turn can still be going when the next step starts.
- Request state: `RequestState`. It continues immediately and the request stays active.
- Wait for state: waits for the StateMachine's actual state, with an optional timeout. Its replay estimate only paces the replay.
- Wait: a fixed pause.
- Branch: runs its Then steps or its Otherwise steps, then carries on with the steps after it either way (`Commands.either`). It can check the robot's actual state, a robot check (any `public boolean` method with no arguments on `StateMachine`, such as a `hasFuel()` you add for a sensor), or whether at least some time is left in autonomous. State and robot checks can wait up to a set time for a yes first. Each side's steps sit under its label in the step list; use a label's + (or the branch's Add step) to add to that side, or drag steps in. Branches can't hold other branches.

Path segments are colored by the state requested at that point. Robot states come from `RobotState` in `StateMachine.java`. Point at robot uses the live pose.

Ctrl+Z and Ctrl+Y (or Ctrl+Shift+Z) undo and redo edits; a drag, or typing in one field, is one undo step. Other shortcuts: Ctrl+S saves immediately, 1–5 add a step, Ctrl+C/Ctrl+V copy and paste a step (also into another auto), Ctrl+D duplicates it, Delete removes it, `[` and `]` select the previous or next step, Alt+↑/↓ move it, arrow keys nudge the selected point 5 cm (Shift: 25 cm), Q/E turn it 15° (Shift: 1°), Space plays the replay, and `?` lists them all. Right-click an auto in the list to duplicate, flip, delete or make it the default.

Symmetry (↔ and ↕ beside the alliance) also generates a mirrored copy for the other side: flipped across the center line, top to bottom, or both, with the opposite alliance (or "(mirrored)" when the auto is for any alliance). The field can show either version, and edits on the mirrored view are flipped back onto the original. The right-click menu can also flip an auto's points in place.

Named points (Points, below the autos) are saved once and reused in any auto. Save as named point in a drive step links the step to a new point, which you can rename there or in the list. Moving a linked step, in any auto, moves the point and every step linked to it. Points the auto doesn't use show as purple pins on the field; click one, or the list's drive-here button, to add a linked drive step. Generated code declares each point autos use once, as a `Pose2d` constant. Deleting a point leaves its steps where they are, unlinked, and mirrored copies use plain poses.

Replay plays the ideal motion from point 1 using the same math as the robot's `DriveToPoseController` and `LegHeading`, assuming the robot tracks its commands exactly and turns at each leg's max turn rate (180°/s by default). Consecutive drive legs carry their speed into the next leg; a state request right before a move joins it, and any other step leaves the robot stopped. The timeline marks the autonomous period (20 s by default; click it to change) and flags legs that never reach their finish tolerances.

Speed checks compare each auto with what the drivetrain can physically do. Power Tool reads the free speed, gearing, wheel radius, slip current and module positions from `TunerConstants` (in `frc/robot/constants` or `frc/robot/generated`), and the robot mass, wheel friction and drive motor from PathPlanner's `settings.json`. From those it works out the top speed with an 11.5 V match battery, the acceleration the drive motors can give at their current limit (it fades to zero near top speed), and how much wheel speed turning uses. It then replays the auto a second time, as that drivetrain would drive it. A leg gets a warning when its max velocity or acceleration is beyond the drivetrain, or when the robot needs noticeably longer than the replay shows: it runs out of speed, or turning while driving fast makes CTRE's swerve slow everything down. The replay bar then shows how much longer the whole auto takes on the robot, with orange marks where it falls behind. A drive step's motion limits show what the robot can do, and hovering there lists where `TunerConstants` and PathPlanner's settings disagree. The checks only warn; generated code is unchanged.

The Tags toggle above the field shows what the cameras can see. It needs a field layout, since that is where the AprilTags come from. Each Limelight gets a wedge for its field of view in its own color, and a line to every tag it could use from the pose on the field, which is the playhead while the replay runs. Hovering a line gives the distance, how far off square the tag is and how wide it lands in the image. Under the timeline, a strip colors the route by how well the robot could place itself: green within 5 cm, yellow within 15 cm, orange beyond that, and hatched grey where no tag is usable at all, with the total blind time beside it. That number is the standard deviation the robot's own pose estimator would use, `basePositionStdDev × averageTagDistance² ÷ tagCount` from `LimelightVision.parseMeasurement`, read from the project's `VisionConstants`.

A tag counts only when the whole tag lands in the image, it faces the camera within 60°, it is at least 12 px across (from the field of view and the detector's image width, so a smaller pipeline loses range), it is inside the robot's tag distance limit, and nothing on the field is in the way. Sight lines are blocked in 3D by the hub, the trench bar, the trench posts and the tower uprights, so the hub hides the tags on its own far side. Power Tool can't read a Limelight's mount pose from the robot project, so the camera button opens a dialog to enter it; the numbers are the same ones as the Limelight web UI's robot-space camera pose, and they are saved with the autos. The view assumes the robot is standing still with a good gyro heading, and it knows nothing about other robots on the field.

The field and replay follow one side of each branch at a time (Then at first); the other side is drawn faintly and dimmed in the step list. Pick the side in the branch's settings, click a side's label, select one of its steps, or click one of its faint points. A branch that waits assumes the answer is already yes on the Then side and never comes on the Otherwise side. For a time-left branch, its settings say how much time the replay has left there and which side the robot would take.

While Power Tool is connected, it records each enabled autonomous period, in simulation or on the robot, from the drive pose and the auto chooser's active auto. The field draws the last run of the auto it shows as a white line over the ideal route; the Last run chip hides it or, with ×, clears it. Runs are kept on this computer.

Before a match, while the robot is disabled, the Drive tab lists checks under the auto chooser: an auto is selected, the alliance is known and fits the auto (an auto for any alliance must start on the robot's side), the robot is within 15 cm and 5° of the selected Auto Builder auto's point 1, and `GeneratedAutos.java` matches the Auto Builder (otherwise use File → Update Code and deploy). The field outlines point 1 in green so the robot can be lined up on it. Hand-written autos get the alliance check only.

Autos save to `power-tool/generated/powerlib-autos.json` as you edit. File → Update Code, which also regenerates subsystem code, writes `src/main/java/frc/robot/autos/GeneratedAutos.java` and, if needed, adds `GeneratedAutos.register(autoBuilder, robot);` to `RobotAutos.register`. Hand-written autos in `RobotAutos.java` are untouched. Generated drive steps need `DriveToPose.java` and PowerLib's `DriveConstraints.java`; if the project is missing them, install the PowerLib templates. Auto names must not match a string in `RobotAutos.java`, because `AutoBuilder` stops robot code at startup on duplicate names. Run `npm run check:autos` to check validation, code generation, symmetry, subpoints, turning, named points, branches, replay, speed checks, tag visibility, recorded runs, pre-match checks, file updates, editing, keyboard shortcuts, column sizes and field dragging.

The code is in `src/features/autos/`. `AutoBuilderPanel.tsx` only lays out the columns; `useAutoBuilder.ts` puts the state together from one-job hooks (`useAutoFiles`, `useAutoSave`, `useAutoSelection`, `useReplayPlayback`, `useAutoShortcuts` and others). Each component is in its own file in `components/`. The data logic is in plain `.ts` files that `check:autos` tests: `autoModel.ts` (the auto document and Java generation), `autoReplay.ts`, `autoLimits.ts`, `autoVision.ts`, `autoEdits.ts` (edits to autos and steps), `autoRoute.ts`, `autoKeys.ts` (what each key does), `fieldDrag.ts` and `fieldGeometry.ts` (dragging and drawing on the field).

The `allowScripts` entry in `package.json` approves the install scripts of Electron, esbuild and electron-winstaller, which npm 11 asks about and which `npm ci` needs to download Electron.

## Scripts

```text
npm run dev      Start Vite and Electron for local development.
npm run build    Type-check and build the renderer and Electron main process.
npm run check:components
                 Check the React rules: one component per file, named after it, with a
                 named export and a <Component>Props type; one hook per use<Name>.ts file;
                 component files under 250 lines. Older files that don't follow them yet
                 are listed in scripts/component-rules-check.mjs.
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
