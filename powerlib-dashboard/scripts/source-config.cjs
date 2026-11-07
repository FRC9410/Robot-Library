#!/usr/bin/env node
// The CLI and Electron app use the same source reader, migration and writer.
const path = require("node:path");
const fs = require("node:fs");
const { pathToFileURL } = require("node:url");
async function run() {
  let root;
  for (const start of [process.cwd(), __dirname]) {
    for (let current = path.resolve(start);; current = path.dirname(current)) {
      if (["build.gradle", "settings.gradle", "gradlew.bat"].some(name => fs.existsSync(path.join(current, name)))) { root = current; break; }
      if (path.dirname(current) === current) break;
    }
    if (root) break;
  }
  if (!root) throw Error("Run this command from a WPILib robot project.");
  const tool = path.resolve(__dirname, "..");
  const compiled = path.join(tool, "dist-electron", "java-config");
  if (!fs.existsSync(compiled)) throw Error("Build Power Tool first so its shared Java configuration service is available.");
  const load = name => import(pathToFileURL(path.join(compiled, `${name}.js`)).href);
  const action = process.argv[2] ?? "validate";
  if (action === "migration-preview") {
    const api = await load("legacyMigration");
    console.log(JSON.stringify(await api.readLegacyMigration(root), null, 2));
  } else if (action === "migration-apply") {
    const api = await load("legacyMigration");
    const revision = process.argv[3];
    const selected = (process.argv[4] ?? "").split(",").filter(Boolean);
    if (!revision) throw Error("Review migration-preview first, then pass its revision and selected change IDs.");
    console.log(JSON.stringify(await api.applyLegacyMigration(root, revision, selected, process.argv.includes("--confirm-state-deletions")), null, 2));
  } else if (action === "validate") {
    const api = await load("service");
    const [subsystems, states, vision, localization] = await Promise.all([api.readSubsystemDocument(root), api.readStateConfig(root), api.readVisionConfig(root), api.readLocalizationConfig(root)]);
    const errors = subsystems.subsystems.flatMap(item => item.sourceError ? [item.sourceError] : []);
    if (errors.length) throw Error(errors.join("\n"));
    console.log(`Java configuration: ${subsystems.subsystems.length} mechanisms, ${states.config.states.length} states, ${vision.vision.limelights.length} cameras. Localization heading limit ${localization.config.heading.maxTagDistanceMeters} m. No code was regenerated.`);
  } else throw Error("Use validate, migration-preview or migration-apply. Save configuration through Power Tool; JSON generation is retired.");
}
run().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
