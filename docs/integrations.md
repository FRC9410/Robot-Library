# Power Tool integration catalog

**File → Settings → Integrations** lists the optional packages available to this robot project. **Install** downloads the complete source tree at the catalog's pinned commit using Git and its existing credentials. Keep Git and `uv` on PATH. `uv` prepares the Python environment and locked dependencies on the first start.

After installation, use the package checkbox to select or clear all servers. Expand the package to choose individual servers or edit their settings. Checking a server starts it immediately using the saved inputs for this robot project. Power Tool also starts all checked servers when it opens. Unchecking a running server stops it. **Copy MCP URL** gives you a local Streamable HTTP endpoint for a running server. Add it to your MCP client as an HTTP server. The URL includes a private access token and stays the same across launches of this project.

Power Tool loads the project catalog at launch, falling back to the bundled catalog for older projects. The mapping supplies the package entries. Each definition supplies the server rows, field labels, input types, defaults, and launch settings. [mapping.json](../distribution/integrations/mapping.json) · [wpilib.json](../distribution/integrations/wpilib.json)

**Uninstall** stops the package's servers and moves its installed folder to the trash. The catalog and saved inputs stay available for a later install. Reinstalled servers start unchecked.

When **Live Robot Data** is selected and connected to the same host and port as Power Tool, the app shares its WPILib NetworkTables connection and shows **MCP** in the connection badge. Power Tool checks the connection every 250 ms by default and falls back to its built-in client if the shared connection becomes unavailable. In **File → Connection Settings**, set the WPILib heartbeat and the live data update interval. The live data interval defaults to 100 ms and applies with either client. The MCP server's public write settings still govern tools called by assistants.

## Release layout

The release packager copies `distribution/integrations/` into the archive as `integrations/`. Expanding that archive into a clean robot project supplies:

```text
integrations/
  mapping.json
  wpilib.json
```

In `mapping.json`, the keys under `integrations` are stable package IDs. Each entry identifies the approved source `repository`, a commit `revision`, a `definition` JSON file relative to the catalog folder, and an `installationDirectory` directly under `integrations/`. The definition's `id` and directory name match the catalog key. Power Tool installs WPILib under `integrations/mcp-wpilib/` with `pyproject.toml` at that root. On launch, it relocates earlier installs from `integrations/installed/` and keeps the previous Python environment under a backup name so `uv` can build a fresh one.

The shipped project `.gitignore` allows teams to track `integrations/mapping.json` and `integrations/wpilib.json`. It ignores the rest of the folder, including downloaded source, dependencies, and local settings. Robot-Library ships the starting catalog from `distribution/integrations/`. Power Tool saves your server selections, input values, and local MCP port and access token in `integrations/settings.json`.

## What maps to what

The top-level `id` identifies the installed package, regardless of its folder name. Each key in `servers` is a stable server ID. A manager can show that entry's `name` and `description` with an enable switch. All entries have `enabledByDefault: false`; installation and enabling are separate actions. Store user selections and settings outside this manifest so an integration update preserves them.

Each server maps directly to a public command already declared in the external project's `pyproject.toml`. The Python paths below explain the current implementation; Power Tool launches the commands and does not depend on those paths:

| Server ID | Command | Existing entry point |
|---|---|---|
| `wpilib-nt4` | `mcp-wpilib-nt4` | `src/mcp_wpilib_nt4/cli.py` → `main()` |
| `wpilib-wpilog` | `mcp-wpilib-wpilog` | `src/mcp_wpilib_wpilog/cli.py` → `main()` |
| `wpilib-sim` | `mcp-wpilib-sim` | `src/mcp_wpilib_sim/cli.py` → `main()` |
| `wpilib-vscode` | `mcp-wpilib-vscode` | `src/mcp_wpilib_vscode/cli.py` → `main()` |
| `jfr` | `mcp-jfr` | `src/mcp_jfr/cli.py` → `main()` |

No extra launcher scripts are needed. `uv` resolves those commands from the project, using its locked dependencies without the development dependency group. The manifest's `requirements` describe the required launcher and Python version; it does not install them itself.

## Reading version 1

1. Parse JSON and require a supported `schemaVersion` (currently `1`).
2. List the entries under `servers` without executing their commands. Resolve each `documentation` path relative to the downloaded integration folder, not the catalog folder.
3. For an enabled server, collect only the `inputs` referenced by that server. Use an input's `default` if no value was saved; otherwise request its value. Required inputs used only by disabled servers do not block other servers.
4. Resolve the placeholders below in each argument and environment value. Convert integer inputs to strings for environment variables. Reject missing values and enforce declared input types and numeric bounds before launch.
5. Start `command` with the resolved `args` as an argument array and the resolved `env` merged into the process environment. Do not build a shell command or use shell interpolation. The manager performs placeholder replacement; the server and shell do not.

| Placeholder | Supplied by |
|---|---|
| `${integrationDir}` | Manager: absolute path to the extracted external project folder containing its `pyproject.toml` |
| `${robotProjectDir}` | Manager: absolute path to the current robot project |
| `${nt4Host}` | Saved connection setting, or `127.0.0.1` for local simulation |
| `${nt4Port}` | Saved connection setting, or the normal NT4 port `5810` |
| `${logDirectory}` | Robot log folder, defaulting to the project's `logs/` |
| `${jfrDirectory}` | Java profiling folder, defaulting to `integrations/recordings/` |

The NT4 host and port are integration settings. Use the robot's address for hardware. The MCP project's fake robot uses port `5820`. Power Tool creates the log and profiling folders if needed when their servers start.

The upstream commands speak stdio. Power Tool keeps one stdio MCP client connected to each enabled server and forwards tools, prompts, and resources through a loopback Streamable HTTP endpoint. The endpoint is available while Power Tool and that server are running.

Keep Power Tool's server IDs stable when changing labels. If the external project adds or renames a public command, update the definition and test the new pinned revision before shipping it. Python filenames behind an existing command can change independently.
