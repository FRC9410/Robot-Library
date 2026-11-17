# Development and releases

[Project README](../README.md) · [All guides](README.md)

Use this guide when changing PowerLib, developing the desktop app, or producing a release. End users can start with the [prebuilt project ZIP](getting-started.md).

- [Source layout](#source-layout)
- [Develop Power Tool](#develop-power-tool)
- [Build the distribution](#build-the-distribution)
- [Validate a release](#validate-a-release)
- [Maintainer references](#maintainer-references)

## Source layout

| Path | Purpose |
|---|---|
| `templates/powerlib/` | PowerLib Java files copied into the robot project |
| `templates/replacements/` | Generic robot starter files |
| `templates/vendordeps/` | Pinned vendor dependency JSON files |
| `powerlib-dashboard/` | Electron, React and dashboard source |
| `distribution/project-overlay/` | Release launcher, Git ignore rules and starter instructions |
| `distribution/integrations/` | Shared integration catalog bundled with the app and full project ZIP |
| `skills/` | Project-local agent skill and simulation templates |
| `tests/` | Java, integration and release validation tools |

## Develop Power Tool

You can develop on Windows or macOS. The release ZIP and the packaged app that teams use are
Windows x64 only.

### Set up a development machine

| | Windows | macOS |
|---|---|---|
| Node.js 24 (from `.nvmrc`) | Node.js 24 LTS installer, or `nvm use` | `brew install node@24`, then put `/opt/homebrew/opt/node@24/bin` first on your `PATH` (or `nvm use`) |
| PowerShell 7 (`pwsh`) | `winget install Microsoft.PowerShell` | `brew install powershell` |
| WPILib 2026 (Java checks and robot builds) | WPILib installer, to `%PUBLIC%\wpilib\2026` | WPILib installer, to `~/wpilib/2026` |

Use Node 24, not a newer version: Electron 39's installer can't unpack its download on
Node 26, which leaves Power Tool unable to start. `package.json` approves install scripts
only for `electron` and `esbuild` (`allowScripts`); npm 11 skips the rest.

### Run and build

From `powerlib-dashboard/`:

```powershell
npm ci
npm run dev
# Type-check and build without starting the app:
npm run build
```

The packaged release contains the runtime. Edit React components and imported assets in a source checkout, then rebuild to distribute them. See [Custom dashboard](../powerlib-dashboard/dashboard/README.md) and the [Power Tool source reference](../powerlib-dashboard/README.md).

`npm run package:app` packages Power Tool for the machine you run it on (a `.app` on macOS),
for trying a packaged build locally.

## Build the distribution

Run these PowerShell scripts from Robot-Library on Windows with Node/npm available. They write ZIPs to `build/distributions/` by default.

| Script | ZIP | Extract into |
|---|---|---|
| `.\release-library-and-power-tool.ps1` | `Robot-Library-2026-Windows-x64.zip` | A clean WPILib 2026 Java Command Robot project |
| `.\release-power-tool.ps1` | `Power-Tool-Windows-x64.zip` | An existing PowerLib robot project with Power Tool closed |
| `.\release.ps1` | Both ZIPs | Use the instructions for each ZIP |

The combined release builds Power Tool once and bundles that same build in both ZIPs. The full ZIP also includes generic robot templates, pinned vendor dependencies, simulation skills, and the project overlay. The Power Tool update ZIP contains `Power Tool.cmd`, `power-tool/launch.ps1` and the packaged app under `power-tool/app/`. Its integration catalog is inside the app resources. Both archives extract at the project root. Pass `-PowerToolDirectory .\PowerTool-local\win-unpacked` to the full release script to package an existing app build.

New library files and robot templates under the copied trees are included recursively. New UI components and assets are included when imported by the app build. Use a full dependency installation when adding npm packages; `-SkipInstall` only skips that installation, not the build.

Attach the resulting ZIPs to a [GitHub Release](https://github.com/FRC9410/Robot-Library/releases). These scripts prepare the assets locally for upload.

## Validate a release

After packaging, run these from the repository root:

```powershell
python tests/project-zip-check.py
node powerlib-dashboard/scripts/packaged-project-check.mjs
```

These checks exercise the full project ZIP. They extract over a stock WPILib template, verify project and team settings and Git exclusions, build the robot, then launch the packaged executable and test log downloads against a local fake SFTP robot. [Test requirements and validation catalog](../tests/README.md)

`tests/source-config-checks.ps1`, `tests/generated-robot-check.ps1` and `tests/app-generation-check.ps1` cover source edits, migration, template compilation and saving through the app before building. They do not deploy a robot.

## Maintainer references

- [Internal notes and source-editing behavior](../INTERNAL.md)
- [Validation catalog](../tests/README.md)
- [Power Tool source guide](../powerlib-dashboard/README.md)
- [Dashboard integration](../powerlib-dashboard/DASHBOARD.md)
