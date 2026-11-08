# Robot-Library maintainer notes

Start with [Development and releases](docs/development.md) for source setup, packaging and validation. These notes describe the source-editing engine and maintainer details.

End users download the project ZIP from [GitHub Releases](https://github.com/FRC9410/Robot-Library/releases), extract it into a clean WPILib 2026 Java Command Robot project, and open **Power Tool.cmd**. See [README.md](README.md) for setup. Distribution uses a prebuilt application; there is no source installer or in-app updater.

## Packaging

Run from the repository root on Windows:

```powershell
.\build-project-zip.ps1
# Reuse existing npm dependencies, while still rebuilding the app:
.\build-project-zip.ps1 -SkipInstall
```

Output: `build/distributions/Robot-Library-2026-Windows-x64.zip`. Attach this file as a GitHub Release asset; creating it does not publish anything automatically. Do not substitute GitHub's automatic source-code ZIP.

`build-dashboard.ps1` builds the renderer and Electron code and packages a standalone app under `PowerTool-local/win-unpacked/`. The ZIP builder calls it, then copies the complete `templates/powerlib/` and `templates/replacements/` trees, the five pinned dependency files in `templates/vendordeps/`, `skills/`, and `distribution/project-overlay/`. Newly imported UI components and assets are rebuilt; new library and robot template files are picked up recursively. A new npm dependency requires running without `-SkipInstall`.

`-PowerToolDirectory` reuses an already packaged application; use this only when its build is current. The ZIP has no enclosing directory and includes `.gitignore`, which excludes the full prebuilt `power-tool/app/` tree while preserving robot source and auto definitions for Git. The receiver keeps their Gradle wrapper, build configuration, team preferences, `Main.java` and `Robot.java`.

## Validation

See [tests/README.md](tests/README.md). The ZIP checks extract into an actual stock WPILib template and build it, verify Git exclusions, and launch the packaged executable against a fake SFTP robot. Source-editor and UI checks seed isolated fixtures directly from release templates. Runtime build, deployment and simulation live in `powerlib-dashboard/electron/robotActions.ts`; all File actions use the same typed action bridge.

## Power Tool development

Work in `powerlib-dashboard/`; run `npm ci`, `npm run dev`, or `npm run build` there. The custom dashboard source and imported assets are compiled into the packaged app; a release ZIP contains the runtime, not an editable Node project. See [the dashboard guide](powerlib-dashboard/dashboard/README.md) for source customization.

## Edit robot configuration

Power Tool's Settings wizard creates and edits velocity, velocity-torque, absolute-position and relative-position mechanisms directly in Java. It maintains constants classes, Constants aliases, StateMachine instances, tunable registration and characterization integration as needed. Ordinary value changes patch individual initializers. Runtime renames preserve the stable Java class identity and subsystem ID comment.

Settings also saves camera descriptions and state names immediately. Idle is implicit and always last. Existing state bodies and guarded handler priority remain team-owned. Deleting a state requires confirmation and rejects remaining source references. Build and deploy are separate from saving.

The shared engine is in `powerlib-dashboard/electron/java-config/`. Renderer forms, Electron IPC, legacy migration and the development CLI use this engine. Writes check revisions, retain source spans, serialize saves and keep a recovery journal under `build/power-tool-edits/`. An interrupted save rolls back recognized writes while refusing to overwrite later external edits. This is a bounded source editor; arbitrary Java factories and expressions stay read-only.

```powershell
node E:/code/projects/Robot-Library/powerlib-dashboard/scripts/source-config.cjs validate
node E:/code/projects/Robot-Library/powerlib-dashboard/scripts/source-config.cjs migration-preview
```

Review the preview's individual saved differences before using `migration-apply <revision> <selected-change-ids>`. Destructive state imports additionally require `--confirm-state-deletions`. Originals and source are backed up under `build/power-tool-migration/`; legacy JSON is archived only after successful source edits. Normal saves never read or create configuration JSON.

Custom constants markers remain supported, and existing custom methods and comments survive structural edits. Existing numeric fields retain their tuning annotation; newly added numeric custom fields become tunable. Save Tuned Values saves selected defaults together in one source transaction. Live Apply uses the same NetworkTables keys as before and stays separate from code saving.

Temporary tuning recovery JSON lives in app user-data, isolated by robot project and target/profile/host/port. Only successfully published variable values are cached. Restore fills pending drafts and requires explicit Apply; it never replaces Java defaults or replays automatically.
