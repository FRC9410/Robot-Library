---
title: Maintaining This Vault
date: 2026-10-30
tags: [meta, agents]
aliases: [AGENTS, Vault rules]
---

# Maintaining This Vault

Rules for people and coding agents that change Robot-Library. The vault is only useful if it
matches the code, so updating it is part of finishing a change.

## When you change code

Changing React code in Power Tool? Follow the
[React Code Rules](05-Power-Tool/React%20Code%20Rules.md) first. The repo-root `CLAUDE.md`
points coding agents at them and at this note.

1. **Add a [CHANGELOG](09-Changelog/CHANGELOG.md) entry**, newest at the top, using the format
   at the top of that file. One entry per logical change, not per commit. **Code changes
   only:** edits that touch only vault notes don't get an entry.
2. **Update the note that owns the area you touched.** Use the [Home](README.md) map to find it.
   If a class, file, topic path, log key or default value named in a note changed, fix the note.
3. **New file or class?** Add it to its area note. New area? Create a note in the right folder
   and link it from that folder's `INDEX.md` and from [Home](README.md).
4. **Changed how two parts talk to each other** (NetworkTables topics, JSON files, IPC channels,
   log keys)? Update the matching note in [06-Data-Flows](06-Data-Flows/INDEX.md) too.
5. **Built something from the [Project Overview](11-Ideas/INDEX.md)?** Move its line from
   **Next** to **Built** (one row, a sentence or two). The details go in the area note, not there.

## When you talk about ideas

- Ideas go in the [Project Overview](11-Ideas/INDEX.md), not in notes of their own: one bullet
  under **Next** with what it is and why, and any open question under **Open questions**.
- Keep it short enough to read in two minutes. Drop an idea by deleting its line.
- A bigger plan that needs a checklist, like [2027 and Systemcore Readiness](11-Ideas/2027%20and%20Systemcore%20Readiness.md),
  can have its own note in `11-Ideas/`, linked from the Overview.

## Writing rules

- **Links between notes:** relative markdown links with spaces URL-encoded,
  e.g. `[Tuning](../03-PowerLib/Tuning.md)` or `[Telemetry Flow](../06-Data-Flows/Telemetry%20Flow.md)`.
  No `[[wikilinks]]`: GitHub doesn't render them.
- **Source files:** name them as inline code with the repo-relative path, e.g.
  `templates/powerlib/src/main/java/frc/powerlib/dashboard/DriveTelemetry.java`. Don't link
  them: the vault root is `Power-Tool-AGENTS/`, so Obsidian can't open files outside it and
  would create an empty note when the link is clicked.
- **Frontmatter** on every note: `title`, `date` (last meaningful update), `tags` as a YAML list.
- **End each note with a `Related:` line** linking the notes it builds on. Those links make the
  graph view and backlinks useful.
- **Diagrams:** Mermaid code blocks. Obsidian and GitHub both render them.
- **Describe what the code does now.** History belongs in the changelog.
- **Don't copy long docs.** Link or name `README.md`, `tests/TELEMETRY-CONTRACT.md`,
  `powerlib-dashboard/DRIVE-DASHBOARD.md` and summarize the parts that matter.

## Checking the vault

A copy of the linter is in the vault at `.tools/vault_lint.py`. It needs only Python 3.9+ with
the standard library. From the repo root:

```bash
python Power-Tool-AGENTS/.tools/vault_lint.py Power-Tool-AGENTS
```

On Windows, if `python` isn't found, use `py -3` instead (the Python launcher), or install
Python 3.9+ from python.org. It should report `errors 0` and no orphans. Exit code 1 means there are broken links or bad
frontmatter. Use `--help` to see the rules it applies.

The script comes from the MIT-licensed
[obsidian-notes](https://github.com/m4bwav/obsidian-notes) plugin; the license is in
`.tools/LICENSE-vault_lint.txt`. Obsidian hides dot-folders, so `.tools/` doesn't appear in the vault.

## Opening it

Obsidian → *Open folder as vault* → `Robot-Library/Power-Tool-AGENTS`. `.obsidian/app.json` is
committed (markdown links, relative paths). Per-machine files like `workspace.json` are
gitignored.

**Colors:**
- `.obsidian/snippets/power-tool-colors.css` gives each section folder its own color in the file tree and colors headings, tables and tags. It works in light and dark themes.
- `graph.json` holds matching graph-view color groups.
- `appearance.json` sets the accent to Power Tool yellow.
- **Adding a new top-level folder?** Add it to the snippet and to `graph.json` `colorGroups`.

Related: [Home](README.md), [CHANGELOG](09-Changelog/CHANGELOG.md)
