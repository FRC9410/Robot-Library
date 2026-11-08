# Auto Builder

[Project README](../README.md) · [All guides](README.md)

Use the **Autos** tab to create routines on the field, then save them into robot Java. Start with a drive point or wait; use state steps and branches as your routine grows.

- [Editing a routine](#editing-a-routine)
- [Robot check conditions](#robot-check-conditions)
- [Java autonomous API](java-programming.md#autonomous-chooser)

## Editing a routine

The Power Tool **Autos** tab creates routines through Add step → Add point,
Add wait, Execute state, Wait for state, or Add branch. Standalone state steps run in list order
and select their state in the inspector. Add the first point
through Add step, then drag
the green + handle on the selected point to create a new point immediately after it.
Empty field clicks clear the selection. Drag a point's center to move it, or edit its position,
heading, and motion
limits in the step inspector. Name and alliance share a row above the field.
Generated routines are never defaults and always clear their owned request at the end.
Wait-for-state checks the actual robot state; older saved state timeouts are disabled.

The editor autosaves drafts to `power-tool/generated/powerlib-autos.json`. The single
**Save** button at the bottom of Steps flushes the draft, explicitly writes the owned
`GeneratedAutos.java`, and adds its registration to
`RobotAutos.register` when needed, using the shared source transaction system.
Existing handwritten routines are preserved. **Build Robot** compiles existing Java;
editing or building alone does not regenerate autos. Rebuild and restart desktop
simulation, or deploy to the robot, after saving.

**File > Settings > Auto** sets the autonomous duration used by remaining-time branches in
all routines (20 seconds by default). It shares the Autos editor's draft. **Save auto
settings** saves that draft and updates generated Java; rebuild and restart simulation
or deploy before testing the new duration on the robot.

The first drive point seeds the starting pose in simulation only; a real robot
keeps its measured pose. Generated commands are fresh on each run and release their
state owner on normal completion and cancellation, leaving other owners intact.

Validation blocks generation for duplicate/reserved names, missing robot states,
invalid waits/limits, and missing drive helpers. Names found in handwritten robot
registration code are protected too. Reload discovers Java/source changes. Stale
saves keep the current draft, and newer, malformed, or unsupported auto documents
cannot be overwritten by this editor.

## Robot check conditions

Robot check branches scan `src/main/java/frc/robot/helpers/RobotChecks.java`,
which StateMachine exposes as `public final RobotChecks checks = new RobotChecks(this);`.
Add public instance methods that return `boolean` and take no arguments to this file.
Use its `robot` field to access the current StateMachine and its subsystems. For example:

```java
public boolean isPastFourMeters() {
  return robot.drivetrain.getState().Pose.getX() >= 4.0;
}
```

A generated branch calls `robot.checks.isPastFourMeters()`. Then runs when the check
is true; Otherwise runs when it is false after any configured condition wait.
Reload Power Tool after editing Java so the dropdown and source revision refresh.
The ZIP includes an empty `RobotChecks.java` bucket. Add team-specific checks here
and preserve those edits when reviewing a later release.

## More editor controls

The source UI guide describes [named points, selection, duplication, reordering, undo/redo and advanced point settings](../powerlib-dashboard/README.md#autos-editor). **Help → Auto Keyboard Shortcuts** lists the editor's keyboard and mouse controls.

Use [File → Settings → Field](power-tool.md#field-and-display-settings) to choose the field and bumper dimensions. Those display settings are shared with Dashboard and Logs.

For handwritten routines, command factories, drive constraints and request ownership, see [Java programming](java-programming.md#autonomous-chooser).
