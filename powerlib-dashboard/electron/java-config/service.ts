import path from "node:path";
import { digest, sourceOperation, stateMachinePath, type SourceProject } from "./project.js";
import { subsystemRecords, writeSubsystems } from "./subsystems.js";
import { readSwerve, writeSwerve, readVision, writeVision, readLocalization, writeLocalization } from "./scalars.js";
import { readStates, writeStates } from "./states.js";
import { writeCharacterization, writeTunableRegistry } from "./integrations.js";
import { readConstantsProject, writeConstantsProject, type ConstantRow } from "../constantsFiles.js";
import type { GeneratedSubsystem, GeneratedSwerveConstants } from "./configTypes.js";
import type { VisionConfig } from "../visionConfig.js";
import type { StateConfig } from "../stateConfig.js";
import type { LocalizationConfig } from "../localizationConfig.js";

export async function readSubsystemProject(project: SourceProject) {
  const source = await project.read(stateMachinePath, true);
  const subsystems = (await subsystemRecords(project)).map(record => record.data);
  const read = source ? await readSwerve(project).catch(error => ({ config: {}, diagnostics: [String(error)] })) : { config: {}, diagnostics: [] };
  return { path: path.join(project.root, stateMachinePath), exists: !!source, subsystems, swerve: read.config, swerveError: read.diagnostics.join(" "), revision: digest(source) };
}

export function readSubsystemDocument(root: string) { return sourceOperation(root, readSubsystemProject); }
export function saveSubsystemDocument(root: string, subsystems: GeneratedSubsystem[], swerve?: GeneratedSwerveConstants, revision?: string, deleted?: string[]) {
  return sourceOperation(root, async project => {
    await project.assertRevision(stateMachinePath, revision);
    const before = (await subsystemRecords(project)).map(record => ({ id: record.data.id, type: record.data.type, name: record.data.name }));
    await writeSubsystems(project, subsystems, deleted);
    if (swerve) await writeSwerve(project, swerve);
    if (JSON.stringify(before) !== JSON.stringify(subsystems.map(data => ({ id: data.id, type: data.type, name: data.name })))) await writeCharacterization(project);
    await writeTunableRegistry(project);
    return readSubsystemProject(project);
  });
}
export function readVisionConfig(root: string) { return sourceOperation(root, readVision); }
export function saveVisionConfig(root: string, config: VisionConfig) { return sourceOperation(root, async project => { await writeVision(project, config); return readVision(project); }); }
export function readStateConfig(root: string) { return sourceOperation(root, readStates); }
export function saveStateConfig(root: string, config: StateConfig) { return sourceOperation(root, async project => { await writeStates(project, config); return readStates(project); }); }
export function readLocalizationConfig(root: string) { return sourceOperation(root, readLocalization); }
export function saveLocalizationConfig(root: string, config: LocalizationConfig) { return sourceOperation(root, async project => { await writeLocalization(project, config); return readLocalization(project); }); }

export type TunedSourceSave = {
  subsystems?: GeneratedSubsystem[]; swerve?: GeneratedSwerveConstants; localization?: LocalizationConfig;
  constants?: Array<{ id: string; source: string; constants: ConstantRow[] }>;
};
export function saveTunedSourceValues(root: string, changes: TunedSourceSave) {
  return sourceOperation(root, async project => {
    if (changes.subsystems) await writeSubsystems(project, changes.subsystems);
    if (changes.swerve) await writeSwerve(project, changes.swerve);
    if (changes.localization) await writeLocalization(project, changes.localization);
    for (const file of changes.constants ?? []) await writeConstantsProject(project, file.id, file.source, file.constants);
    await writeTunableRegistry(project);
    return { ...(await readSubsystemProject(project)), localization: await readLocalization(project).then(result => result.config).catch(() => null), constants: await readConstantsProject(project) };
  });
}
