# Team 9410 Robot Library

Team 9410's reusable FRC robot code and the desktop app that configures it. Use these terms in
code, docs, issues and agent output.

## Language

### The project

**Robot Library**:
This whole repo: PowerLib, the robot starter files, Power Tool and the release packaging. Written
"Robot-Library" only as the repo name.
_Avoid_: the library (ambiguous with PowerLib)

**PowerLib**:
The reusable Java library under `frc.powerlib` that is copied into every robot project.
_Avoid_: Robot Library (the larger whole), the framework

**Starter files**:
The generic `frc.robot` files the release ZIP adds to a robot project; they belong to the team
once extracted.
_Avoid_: replacements (the folder name only), template files

**Power Tool**:
The desktop app for configuring, tuning, auto building, log viewing and simulating a robot
project.
_Avoid_: PowerLib Dashboard, the dashboard (that is one tab of Power Tool), the app

**Robot project**:
A team's WPILib 2026 Java Command Robot project with PowerLib and the starter files extracted
into it.
_Avoid_: robot code, the template

**Release ZIP**:
The extract-ready archive of PowerLib, the starter files, vendor files, skills and the packaged
Power Tool that a team unpacks into a clean robot project.
_Avoid_: distribution, the package, source archive (GitHub's automatic one is a different thing)

### Robot states

**Robot state**:
A named mode the whole robot can be in (e.g. `IDLE`), coordinated by the state machine.
_Avoid_: mode (WPILib's auto/teleop/disabled), status

**State machine**:
The single robot-wide coordinator that collects state requests and runs the winning state
handler. There is exactly one per robot project.
_Avoid_: state manager, robot brain

**State handler**:
The class that decides whether it matches a request and drives the robot while that robot
state is active. Registration order is its priority.
_Avoid_: state class, state implementation

**State request**:
One owner's ask for a robot state. Each owner holds at most one request at a time.
_Avoid_: command, transition

**Owner**:
The stable identity a state request is filed under (a button binding, an auto routine), so it
can be replaced or cleared without touching other owners' requests.
_Avoid_: requester, source, caller

**Requested state**:
The robot state that won among the current state requests.
_Avoid_: wanted state, desired state, target state

**Actual state**:
The robot state the active handler reports the robot is really in. It changes only when the
handler says so, never because a request changed.
_Avoid_: current state, real state

**Robot check**:
A named yes/no question about the robot (e.g. `isPastFourMeters`) that auto branches can ask.
_Avoid_: condition, guard, predicate

### Mechanisms and tuning

**Mechanism**:
A motor-driven subsystem configured through Power Tool, of one of the mechanism types.
_Avoid_: subsystem (also covers drivetrain, vision and LEDs), device

**Mechanism type**:
One of PowerLib's mechanism kinds: velocity, velocity-torque, absolute position, or relative
position.
_Avoid_: subsystem type, mechanism class

**Tunable**:
A value the robot accepts live changes to from Power Tool while tuning is on.
_Avoid_: variable, live constant, parameter

**Tuning**:
The robot-wide switch that lets tunables change. It counts as on only after the robot
acknowledges the request.
_Avoid_: tuning mode, live mode, test mode (WPILib's Test mode is different)

**Apply**:
Sending a tunable change to the running robot. It does not change the robot project.
_Avoid_: save, push, deploy

**Saved default**:
The value written into robot project Java that a tunable starts from after a rebuild and
deploy.
_Avoid_: constant, stored value, config value

**Restore edits**:
Bringing back applied tunable values from an earlier Power Tool session into pending drafts,
without sending them.
_Avoid_: recover, reload, resume tuning

### Autonomous

**Auto routine**:
One named autonomous plan, selectable on the auto chooser, made of steps.
_Avoid_: auto (fine in UI labels only), path, autonomous, program

**Step**:
One entry in an auto routine: a drive point, wait, state step or branch, run in list order.
_Avoid_: action, command, node

**Drive point**:
A field pose the robot drives to as a step, with optional motion limits.
_Avoid_: waypoint, target, destination

**Leg**:
The straight-line drive from where the robot is to one drive point.
_Avoid_: segment, path, move

**Branch**:
A step that picks which steps run next from a robot check or the time left in autonomous.
_Avoid_: conditional, if-step, fork

**Generated routine**:
An auto routine Power Tool writes into robot project Java when it is saved, as opposed to one
written by hand.
_Avoid_: built auto, Power Tool auto, code-gen auto

### Field and vision

**Blue-origin coordinates**:
Field positions measured from the blue alliance's corner, used for every pose in this project
whatever alliance the robot is on.
_Avoid_: field coordinates (ambiguous), alliance-relative coordinates

**Field layout**:
The field image and dimensions Power Tool draws poses on. It is a local display choice and never
changes the robot project.
_Avoid_: field map, field config

**Heading initialization**:
Setting the robot's heading from vision before it trusts vision for position.
_Avoid_: gyro reset, heading seed, zeroing

**Pose fusion**:
Blending vision measurements into the drivetrain's pose estimate over time.
_Avoid_: localization (the broader topic), pose correction, vision update

### Telemetry and simulation

**Telemetry frame**:
The complete JSON snapshot of every subsystem's readings the robot publishes every 100 ms.
_Avoid_: data map, packet, update

**Sim with DS / Sim without DS**:
Launching desktop simulation connected to the real FRC Driver Station, or using the
simulation's built-in Driver Station controls.
_Avoid_: sim mode, local sim

**MapleSim**:
The physics simulator a robot project can add for drivetrain movement and game pieces; added
through the `powerlib-sim` skill, not included by default.
_Avoid_: the simulator (desktop simulation runs without it), physics sim
