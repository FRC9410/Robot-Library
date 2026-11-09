# AGENTS.md

Shared instructions for every coding agent working in this repo (Claude Code reads them through
`CLAUDE.md`, Codex reads this file directly).

## Repository Overview

Team 9410's robot library for FRC. It has three parts:

- **PowerLib**: Java library and robot starter code (`templates/`) copied into a team's WPILib
  2026 robot project.
- **Power Tool**: the desktop app (Electron + React + MUI, `powerlib-dashboard/`) for
  configuring, tuning, auto building, logs and simulation. Older code and file names call it
  the "PowerLib Dashboard"; they are the same app.
- **Release packaging**: PowerShell scripts that build Power Tool and the extract-ready
  **release ZIP** that a team unpacks into a clean WPILib project.

The robot and Power Tool talk over NetworkTables under `/PowerLib/...`. The telemetry contract
is `tests/TELEMETRY-CONTRACT.md`; read it before changing anything on either side of that link.

Use the terms in `GLOSSARY.md` in code, docs, issues and your own output, and avoid the
synonyms it lists.

Remote is GitHub (`FRC9410/Robot-Library`). Development and releases happen on Windows.

### Docs vault

The docs for people and agents are in an Obsidian vault kept **outside this repo**, next to it
at `../Power-Tool-AGENTS/` (not every checkout has it). If it's there, start at
`../Power-Tool-AGENTS/README.md` to find the note for the area you're changing, and:

- Follow `../Power-Tool-AGENTS/Maintaining This Vault.md`: add a CHANGELOG entry for code
  changes and update the note that owns the area you touched.
- Run the checks listed in `../Power-Tool-AGENTS/07-Testing/Change to Tests Map.md`.

If it isn't there, skip those steps; the rules in this file still apply.

## Common Commands

Run from the repo root in PowerShell 7 unless noted. Java checks need the installed WPILib
2026 JDK and cached vendor dependencies. Dashboard checks need `npm ci` in
`powerlib-dashboard/` first.

```powershell
# Power Tool: type-check and build (the gate for any dashboard change)
cd powerlib-dashboard; npm run build
npm run dev                                # run the app against Vite
npm run check:<name>                       # focused checks, listed in package.json "scripts"

# PowerLib Java
./tests/run-library-checks.ps1
./tests/generated-robot-check.ps1          # compiles the full robot template

# Release ZIP
./build-project-zip.ps1 -SkipInstall
python tests/project-zip-check.py
```

`tests/README.md` lists every check and what it covers. Change dependencies
(`package.json`, `package-lock.json`, `templates/vendordeps/`) only when the user asks.

## Architecture & Layout

- **`templates/powerlib/`**: PowerLib Java source, copied into robot projects as is.
- **`templates/replacements/`**: generic robot starter files (`RobotContainer`, etc.).
- **`templates/vendordeps/`**: the five pinned 2026 vendor JSON files. The ZIP build fails if
  there aren't exactly five.
- **`powerlib-dashboard/`**: Power Tool. `electron/` is the Electron main process and preload,
  `src/features/` holds one folder per feature, `src/components/` holds shared components, and
  `scripts/` holds the `check:*` scripts and fakes (`fake-robot.mjs`).
- **`distribution/project-overlay/`**: files dropped into the root of a robot project
  (launcher, `.gitignore`, `POWERLIB-START-HERE.md`).
- **`tests/`**: Java fixtures and PowerShell/Python release checks. Output goes under
  ignored `build/`.
- **`docs/`**: user and maintainer guides.

## React/TypeScript rules (required)

All React/TypeScript in `powerlib-dashboard/` must follow
`../Power-Tool-AGENTS/05-Power-Tool/React Code Rules.md` (when the vault is present). Read it
before writing or changing a component. In short:

- **One component per file.** The file name matches the component, with a named export and a
  `<Component>Props` type. Small private components (rows, cells) get their own file too.
- **Composition.** `<Feature>Panel.tsx` holds the state and puts small, single-job components
  together. Wrappers take `children`; use slots, not mode flags. Data logic goes in pure
  `<feature>Model.ts` / `<feature>Utils.ts` functions, not in components.
- **Reusability.** Search for an existing component before writing one. Anything used by two
  or more features goes in `src/components/`. Never copy-paste JSX. Shared components take data
  through props and don't read NetworkTables or `window.powerlib` themselves.
- Over about 150 lines a component file is probably doing too much. Over 250, split it.

If you're asked to change a file listed under "Files that don't follow the rules yet" in that
note, say so and offer to split it. Don't make it bigger.

## Agent files

`CLAUDE.md` only imports this file, so put new instructions here, not in `CLAUDE.md`.
Claude Code permissions live in `.claude/settings.json`; personal overrides go in
`.claude/settings.local.json` (git-ignored).

Skills live in `.agents/skills/<name>/` (Codex reads this). `.claude/skills/<name>` is a symlink
to the same folder for Claude Code. Edit the files under `.agents/skills/`. When you add a skill,
add the matching symlink. The release ZIP ships real copies at both paths.

## Git and pull requests

**Planned, not in use yet** (as of 2026-11-03). The team plans to work this way later; for now,
work happens on feature branches like `feature/Log-Viewer`. Don't flag missing issues or branch
names. Still never commit to `main` directly or merge a PR.

- Every change starts from a GitHub issue. Work on a branch off `main` named
  `feature/<issue-number>-<short-name>`, e.g. `feature/42-split-log-widgets`.
- One issue per branch and one pull request per branch, into `main`. The PR description
  includes `Closes #<issue-number>`.
- Never commit to `main` directly or merge a PR. The lead reviews and merges.
