# Log Viewer

[Project README](../README.md) · [All guides](README.md)

Use the **Logs** tab to review saved robot runs. You can open local files without a live robot connection, or download logs from a reachable robot.

- [Open a local log](#open-a-local-log)
- [Download logs from the robot](#download-logs-from-the-robot)
- [Review a run](#review-a-run)
- [Field and mechanism setup](#field-and-mechanism-setup)
- [If a log is missing or will not open](#if-a-log-is-missing-or-will-not-open)

## Open a local log

The viewer supports **`.wpilog`** and CTRE **`.hoot`** files.

1. Open the Logs tab and open its log list, or drag a file onto the tab.
2. Choose a saved run. Use **Open another file** to browse to a file outside the selected folder.
3. Use the folder bar's **Change** control to select a different log library folder.

The default library is `logs/` in the robot project root. The release ZIP includes this folder and its README. Power Tool remembers a folder selected with **Change**. Use **Matches**, **Practice**, **All**, or search to narrow the list. Select **All** if a practice or simulation run is missing from Matches. Use the refresh button to look for new files.

Power Tool converts `.hoot` files with a compatible CTRE Owlet before viewing them. It looks for Owlet in project tool folders, AdvantageScope's Owlet cache and PATH. A compatible converter can be placed in `power-tool/tools/`. `.wpilog` files do not require Owlet. When opening a `.hoot`, files from the same session in that directory are grouped so data from multiple CAN buses can be read together.

## Download logs from the robot

1. Connect the computer to the robot's network or USB connection.
2. Click **Get logs from robot** when it becomes available.
3. Select one or more runs. **Download and open** opens a single selected run; selecting several downloads them into the chosen local library.

Robot downloads use SSH/SFTP. The browser searches these locations, including one level of run subfolders:

```text
/U/logs
/u/logs
/media/sda1/logs
/home/lvuser/logs
/home/systemcore/logs
```

The current discovery addresses are Team 9410's radio IP and roboRIO mDNS name, `robot.local`, and roboRIO USB at `172.22.11.2`. This discovery is separate from the live NetworkTables connection settings; the development override is `POWERLIB_ROBOT=host[:port]`.

The robot list also supports deletion with confirmation. Deletion removes the selected files from the robot; downloading a run does not delete it.

## Review a run

Use playback and the timeline to inspect a recorded time. Select mechanisms and graph measurements, inspect power data, and use the field view for recorded pose, robot trail, heat map and swerve data when those signals are present.

The viewer reads data recorded in the file. The [Java telemetry reference](java-programming.md#telemetry-logging) explains the PowerLib measurements and status fields written by the starter robot.

## Field and mechanism setup

The field layout and bumper dimensions are shared with Dashboard and Auto Builder through **File → Settings → Field**. A recorded pose does not require a live robot connection.

Motor grouping uses the robot's Java configuration and drive motor IDs from `TunerConstants.java`. The **Assign motors** controls allow local grouping overrides when the recorded device information does not match your current project.

## If a log is missing or will not open

| Symptom | First check |
|---|---|
| Library is empty | Check the folder shown at the bottom, select All, and refresh. |
| A simulation run is missing | Open its file directly or select its folder; the simulation launch actions do not automatically copy logs into the library. |
| `.hoot` conversion fails | Check that a compatible Owlet converter is available for that Phoenix log format. |
| Get logs from robot is unavailable | Confirm the robot is reachable over SSH; a live NetworkTables connection alone does not establish SFTP availability. |
| No PowerLib data found | Check that the run includes PowerLib data or supported Phoenix motor signals. Opening an unrelated log cannot create missing robot measurements. |

Related: [Power Tool](power-tool.md), [Vision diagnostics](vision.md), and [Getting started](getting-started.md).
