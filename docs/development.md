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
| `skills/` | Project-local agent skill and simulation templates |
| `tests/` | Java, integration and release validation tools |

## Develop Power Tool

From `powerlib-dashboard/`:

```powershell
npm ci
npm run dev
# Type-check and build without starting the app:
npm run build
```

The packaged release contains the runtime. Edit React components and imported assets in a source checkout, then rebuild to distribute them. See [Custom dashboard](../powerlib-dashboard/dashboard/README.md) and the [Power Tool source reference](../powerlib-dashboard/README.md).

## Build the distribution

From Robot-Library on Windows with Node/npm available:

```powershell
.\build-project-zip.ps1
# Reuse installed npm dependencies:
.\build-project-zip.ps1 -SkipInstall
```

Output: `build/distributions/Robot-Library-2026-Windows-x64.zip`. Power Tool is rebuilt and packaged before archiving. For an already packaged app, pass `-PowerToolDirectory .\PowerTool-local\win-unpacked`. The archive has no enclosing folder, includes `.gitignore`, and contains generic templates rather than the test robot's configuration. Pinned vendor snapshots live in `templates/vendordeps/`.

New library files and robot templates under the copied trees are included recursively. New UI components and assets are included when imported by the app build. Use a full dependency installation when adding npm packages; `-SkipInstall` only skips that installation, not the build.

Attach the resulting project ZIP to a [GitHub Release](https://github.com/FRC9410/Robot-Library/releases). The packaging command writes local output; it does not publish a release automatically. Users should choose the attached project ZIP instead of GitHub's automatic source archive.

## Validate a release

After packaging, run these from the repository root:

```powershell
python tests/project-zip-check.py
node powerlib-dashboard/scripts/packaged-project-check.mjs
```

These checks extract over an actual stock WPILib template, verify the project/team settings and Git exclusions, build the robot, then launch the packaged executable and test log downloads against a local fake SFTP robot. See [test requirements and the full validation catalog](../tests/README.md) for the required SDK, cached dependencies and source/UI checks.

`tests/source-config-checks.ps1`, `tests/generated-robot-check.ps1` and `tests/app-generation-check.ps1` cover source edits, migration, template compilation and saving through the app before building. They do not deploy a robot.

## Maintainer references

- [Internal notes and source-editing behavior](../INTERNAL.md)
- [Validation catalog](../tests/README.md)
- [Power Tool source guide](../powerlib-dashboard/README.md)
- [Dashboard integration](../powerlib-dashboard/DASHBOARD.md)
