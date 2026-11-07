import path from "node:path";
import { SourceProject, constantsDirectory, sourceOperation } from "./java-config/project.js";
import { subsystemRecords } from "./java-config/subsystems.js";
import { customStart, customEnd, javaFields, maskJava, replaceSpans } from "./java-config/source.js";
import { isNumericType, validateRow } from "./java-config/constantValidation.js";
import { localizationNames, swervePaths } from "./java-config/scalars.js";
import { writeTunableRegistry } from "./java-config/integrations.js";
export type ConstantRow = {
    originalName: string | null;
    name: string;
    type: string;
    value: string;
    custom: boolean;
    tunable: boolean;
};
export type ConstantsFile = {
    id: string;
    name: string;
    kind: "subsystem" | "robot";
    path: string;
    exists: boolean;
    source: string;
    constants: ConstantRow[];
    error?: string;
};
type Target = Pick<ConstantsFile, "id" | "name" | "kind" | "path"> & {
    relative: string;
    className: string;
};
const numeric = (name: string) => Object.hasOwn(swervePaths, name);
function declarations(source: string) { return javaFields(source).map(field => ({ ...field, originalName: field.name })); }
async function targets(project: SourceProject): Promise<Target[]> {
    const records = await subsystemRecords(project);
    const result: Target[] = records.filter(record => record.file).map(record => ({ id: 'subsystem:' + record.className, name: record.className, kind: 'subsystem', className: record.className + 'Constants', relative: record.file, path: path.join(project.root, record.file) }));
    for (const file of await project.files(constantsDirectory)) {
        if (file.endsWith('/GeneratedTunableConstants.java') || file.endsWith('/TunerConstants.java') || result.some(item => item.relative === file))
            continue;
        const match = /^(\w+)Constants\.java$/.exec(path.basename(file));
        if (match)
            result.push({ id: 'robot:' + match[1], name: match[1], kind: 'robot', className: match[1] + 'Constants', relative: file, path: path.join(project.root, file) });
    }
    return result;
}
export async function readConstantsProject(project: SourceProject): Promise<ConstantsFile[]> {
    return Promise.all((await targets(project)).map(async (target) => {
        let source = '';
        try {
            source = await project.read(target.relative);
            const constants = declarations(source).filter(row => (target.kind === 'robot' || row.custom || row.tunable) && !(target.id === 'robot:Vision' && localizationNames.includes(row.name)))
                .map(({ start, end, expression, ...row }) => ({ ...row, custom: row.custom || target.kind === 'subsystem' && row.tunable, tunable: row.tunable || target.id === 'robot:Swerve' && numeric(row.name) }));
            return { ...target, exists: true, source, constants };
        }
        catch (error) {
            return { ...target, exists: !!source, source, constants: [], error: error instanceof Error ? error.message : String(error) };
        }
    }));
}
export function readConstantsFiles(root: string) { return sourceOperation(root, readConstantsProject); }
function declaration(row: ConstantRow, target: Target) {
    const tunable = row.tunable && !(target.id === 'robot:Swerve' && numeric(row.name));
    return (tunable ? '@frc.powerlib.tuning.TunableConstant\n  ' : '') + 'public static ' + (tunable ? 'volatile' : 'final') + ' ' + row.type + ' ' + row.name + ' = ' + row.value + ';';
}
export async function writeConstantsProject(project: SourceProject, id: string, expectedSource: string, rows: ConstantRow[]) {
    const target = (await targets(project)).find(item => item.id === id);
    if (!target)
        throw Error('This constants class is not editable in Power Tool.');
    const file = (await readConstantsProject(project)).find(item => item.id === id)!;
    if (file.error)
        throw Error(file.error);
    const editable = (source: string) => declarations(source).filter(row => (target.kind === 'robot' || row.custom || row.tunable) && !(id === 'robot:Vision' && localizationNames.includes(row.name)));
    const comparable = (source: string) => JSON.stringify(editable(source).map(({ name, type, value, tunable }) => ({ name, type, value, tunable })));
    if (comparable(file.source) !== comparable(expectedSource))
        throw Error('This file changed since it was loaded. Refresh before saving; your draft has been kept.');
    if (!Array.isArray(rows))
        throw Error('Invalid constants list.');
    const originals = new Map(editable(file.source).map(row => [row.name, row]));
    const all = declarations(file.source);
    const names = new Set(all.filter(row => !originals.has(row.name)).map(row => row.name));
    const used = new Set<string>();
    rows = rows.map(row => { const original = row.originalName === null ? undefined : originals.get(row.originalName); return { ...row, name: !original || row.name !== original.name ? row.name.replace(/\s/g, '_').toUpperCase() : row.name, tunable: row.originalName === null ? isNumericType(row.type) : row.tunable }; });
    for (const row of rows) {
        const original = row.originalName === null ? undefined : originals.get(row.originalName);
        validateRow(row, original);
        if (names.has(row.name))
            throw Error('Duplicate constant ' + row.name);
        names.add(row.name);
        if (row.originalName !== null) {
            if (!original || used.has(row.originalName))
                throw Error('Unknown or duplicate original constant.');
            used.add(row.originalName);
            if (!original.custom && !original.tunable && (row.name !== original.name || row.type !== original.type))
                throw Error(row.name + ' is required by robot code.');
        }
        if (id === 'robot:Vision' && localizationNames.includes(row.name))
            throw Error('Localization defaults are edited through Localization tuning.');
    }
    for (const original of originals.values())
        if (!original.custom && !original.tunable && !used.has(original.name))
            throw Error(original.name + ' is required by robot code.');
    const edits = [];
    const removed = [];
    for (const original of originals.values()) {
        const row = rows.find(item => item.originalName === original.name);
        if (!row || row.name !== original.name)
            removed.push(original.name);
        if (!row) {
            edits.push({ start: original.start, end: original.end, text: '' });
            continue;
        }
        const sameMode = row.tunable === (original.tunable || id === 'robot:Swerve' && numeric(row.name));
        if (row.name === original.name && row.type === original.type && sameMode) {
            if (row.value !== original.value)
                edits.push({ ...original.expression, text: row.value });
        }
        else
            edits.push({ start: original.start, end: original.end, text: declaration(row, target) });
    }
    let source = replaceSpans(file.source, edits);
    const additions = rows.filter(row => row.originalName === null);
    if (additions.length) {
        if (!source.includes(customStart)) {
            const end = maskJava(source).lastIndexOf('}');
            source = source.slice(0, end) + '  ' + customStart + '\n  ' + customEnd + '\n' + source.slice(end);
        }
        const end = source.indexOf(customEnd);
        source = source.slice(0, end) + additions.map(row => declaration(row, target)).join('\n  ') + '\n  ' + source.slice(end);
    }
    for (const relative of await project.files()) {
        const mask = maskJava(relative === target.relative ? source : await project.read(relative));
        for (const name of removed) {
            const pattern = relative === target.relative ? new RegExp('\\b' + name + '\\b') : new RegExp('\\b(?:' + target.className + '|Constants\\.' + target.className.replace(/Constants$/, '') + ')\\s*\\.\\s*' + name + '\\b');
            if (pattern.test(mask))
                throw Error('Cannot remove or rename ' + name + '; ' + relative + ' still references it.');
        }
    }
    await project.set(target.relative, source);
    await writeTunableRegistry(project);
}
export function saveConstantsFile(root: string, id: string, source: string, rows: ConstantRow[]) { return sourceOperation(root, async (project) => { await writeConstantsProject(project, id, source, rows); return (await readConstantsProject(project)).find(item => item.id === id)!; }); }
