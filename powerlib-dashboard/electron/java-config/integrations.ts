import { constantsDirectory, dashboardPath, robotSource, type SourceProject } from "./project.js";
import { closing, markerBlock, maskJava, replaceSpans, type Replacement } from "./source.js";
import { subsystemRecords } from "./subsystems.js";
import { characterizationTemplate } from "./characterizationTemplate.js";

export async function writeTunableRegistry(project: SourceProject) {
  const classes: string[] = [];
  for (const relative of await project.files(constantsDirectory)) {
    if (relative.endsWith("/GeneratedTunableConstants.java")) continue;
    const source = maskJava(await project.read(relative));
    if (/@(?:frc\.powerlib\.tuning\.)?TunableConstant\b/.test(source)) {
      const name = /\bclass\s+(\w+)\b/.exec(source)?.[1];
      if (name) classes.push(name);
    }
  }
  const file = `${constantsDirectory}/GeneratedTunableConstants.java`;
  let source = await project.read(file, true);
  if (!source) source = "package frc.robot.constants;\n\nimport frc.powerlib.tuning.TunableConstants;\n\npublic final class GeneratedTunableConstants {\n  private GeneratedTunableConstants() {}\n  public static void register() {\n  }\n}\n";
  const mask = maskJava(source);
  const method = /public\s+static\s+void\s+register\s*\(\s*\)\s*\{/.exec(mask);
  if (!method) throw Error("GeneratedTunableConstants.register() has a custom signature; repair it before adding tunables.");
  const open = method.index + method[0].length - 1;
  const end = closing(mask, open);
  const known = new Set<string>();
  const edits: Replacement[] = [];
  const pattern = /(?:frc\.powerlib\.tuning\.)?TunableConstants\.register\(\s*(\w+)\.class\s*\)\s*;/g;
  for (const match of mask.slice(open + 1, end).matchAll(pattern)) {
    if (!classes.includes(match[1]) || known.has(match[1])) edits.push({ start: open + 1 + match.index!, end: open + 1 + match.index! + match[0].length, text: "" });
    else known.add(match[1]);
  }
  const additions = classes.filter(name => !known.has(name));
  if (additions.length) edits.push({ start: end, end, text: additions.map(name => `    frc.powerlib.tuning.TunableConstants.register(${name}.class);`).join("\n") + "\n  " });
  await project.set(file, replaceSpans(source, edits));
}

export async function writeCharacterization(project: SourceProject) {
  const records = await subsystemRecords(project);
  const lines: string[] = [];
  for (const record of records.filter(record => !record.data.sourceError && ["velocity", "velocityTorque"].includes(record.data.type!))) {
    const relative = `${robotSource}/characterization/${record.className}Characterization.java`;
    if (!await project.read(relative, true)) {
      const source = characterizationTemplate.replaceAll('$($Metadata.PascalName)', record.className)
        .replace('$SubsystemIdMarkerPrefix$($Metadata.Id)', `// POWERLIB SUBSYSTEM ID: ${record.data.id}`)
        .replace('$GeneratedFileMarker', '// POWERLIB CHARACTERIZATION STARTER - custom code is preserved.');
      await project.set(relative, source + "\n");
    }
    const name = `${record.field}Characterization`;
    lines.push(`    var ${name} = new frc.robot.characterization.${record.className}Characterization(stateMachine.${record.field});`);
    for (const [label, method] of [["Quasistatic Forward", "quasistaticForward"], ["Quasistatic Reverse", "quasistaticReverse"], ["Dynamic Forward", "dynamicForward"], ["Dynamic Reverse", "dynamicReverse"]]) {
      lines.push(`    registerCharacterizationCommand(${JSON.stringify(record.data.name)}, "${label}", ${name}.${method}());`);
    }
  }
  await project.set(dashboardPath, markerBlock(await project.read(dashboardPath), "CHARACTERIZATION", lines.join("\n")));
}
