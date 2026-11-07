# Robot-Library

Team 9410's robot library: PowerLib (Java, `templates/powerlib/`), the installer and generator
scripts, and Power Tool (Electron + React + MUI, `powerlib-dashboard/`).

The docs for people and agents are in an Obsidian vault kept **outside this repo**, next to it
at `../Power-Tool-AGENTS/` (not every checkout has it). If it's there, start at
`../Power-Tool-AGENTS/README.md` to find the note for the area you're changing. If it isn't,
skip the vault steps below; the React rules summary in this file still applies.

## Before you change code

- Follow `../Power-Tool-AGENTS/Maintaining This Vault.md`: add a CHANGELOG entry for code
  changes and update the note that owns the area you touched.
- Run the checks listed in `../Power-Tool-AGENTS/07-Testing/Change to Tests Map.md`.

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

## Git and pull requests

**Planned, not in use yet** (as of 2026-11-03). The team plans to work this way later; for now,
work happens on feature branches like `feature/Log-Viewer`. Don't flag missing issues or branch
names. Still never commit to `main` directly or merge a PR.

- Every change starts from a GitHub issue. Work on a branch off `main` named
  `feature/<issue-number>-<short-name>`, e.g. `feature/42-split-log-widgets`.
- One issue per branch and one pull request per branch, into `main`. The PR description
  includes `Closes #<issue-number>`.
- Never commit to `main` directly or merge a PR. The lead reviews and merges.
