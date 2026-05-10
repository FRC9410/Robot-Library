# PowerLib Dashboard

Electron React dashboard shell for Team 9410 PowerLib tools and FRC NT4 NetworkTables.

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
/SmartDashboard/
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
                 Build a local Windows app under ../PowerLibDashboard-local.
npm run package:publish
                 Build the publish app under ../PowerLibDashboard.
npm start        Run the built Electron app.
```

## Publish The App

Every time you want the installer to ship a new dashboard build, run:

```powershell
cd E:\code\projects\Robot-Library
.\build-dashboard.ps1 -Publish
```

That command rebuilds the Electron app and refreshes:

```text
E:\code\projects\Robot-Library\PowerLibDashboard\
```

The packaged app is intentionally ignored by Git because it is too large for normal repository pushes.

For a local app rebuild without refreshing the installer-facing app folder, run:

```powershell
cd E:\code\projects\Robot-Library
.\build-dashboard.ps1
```

That writes to `E:\code\projects\Robot-Library\PowerLibDashboard-local\win-unpacked`, so it can rebuild even if the published dashboard app folder is locked.

To target another platform explicitly:

```powershell
.\build-dashboard.ps1 -Platform win
.\build-dashboard.ps1 -Platform mac
.\build-dashboard.ps1 -Platform linux
```

After packaging, run the app from the repository root:

```powershell
.\PowerLibDashboard.cmd
```
