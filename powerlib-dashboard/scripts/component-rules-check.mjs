// Checks Power Tool's React rules (one component per file, named exports, <Component>Props types,
// one hook per use<Name>.ts file, component files under 250 lines) for every file in src/ and dashboard/.
// Files that don't follow the rules yet are listed in `legacyFiles`; split one and remove its line.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folders = ["src", "dashboard"];
const maxComponentLines = 250;
const warnComponentLines = 150;

/** Files from before the rules, by path from powerlib-dashboard/. The check fails if one of them starts passing, so the list only shrinks. */
const legacyFiles = new Map([
  ["src/App.tsx", "3 components; AppContent is about 680 lines"],
  ["src/features/drive/DrivePanel.tsx", "several components (Field, CameraCanvas, CameraUrlSetting, CameraStream, DrivePanel)"],
  ["src/features/limelights/LimelightsPanel.tsx", "2 components: LimelightsPanel, LimelightConfiguration"],
  ["src/features/networktables/NetworkTablesPanel.tsx", "2 components: TopicTree, NetworkTablesPanel"],
  ["src/features/networktables/NetworkTablesContext.tsx", "provider and two hooks in one file; inline props type"],
  ["src/features/networktables/SaveTunedValuesDialog.tsx", "one component, but over 250 lines"],
  ["src/features/robot/RobotPanel.tsx", "props type is named Props"],
  ["src/features/robot/RobotTuningDrawer.tsx", "props type is named Props"]
]);

const files = folders.flatMap(folder => walk(path.join(root, folder))).filter(file => /\.(ts|tsx)$/.test(file) && !file.endsWith(".d.ts"));
const problems = new Map();
const warnings = [];
const report = (file, message) => problems.set(file, [...(problems.get(file) ?? []), message]);

for (const file of files) {
  const relative = path.relative(root, file).split(path.sep).join("/");
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const base = path.basename(file).replace(/\.(ts|tsx)$/, "");
  const lines = text.split(/\r?\n/).length;
  const declarations = topLevelFunctions(source);
  const components = declarations.filter(item => /^[A-Z]/.test(item.name) && containsJsx(item.body));
  const hooks = declarations.filter(item => item.exported && /^use[A-Z0-9]/.test(item.name));

  if (hasDefaultExport(source)) report(relative, "has a default export; use a named export");
  if (components.length > 1) report(relative, `has ${components.length} components (${components.map(item => item.name).join(", ")}); put each in its own file`);
  for (const component of components) {
    if (component.name !== base) report(relative, `component ${component.name} should live in ${component.name}.tsx`);
    if (!component.exported) report(relative, `component ${component.name} isn't exported; export it by name`);
    const props = component.params[0]?.type;
    if (props && ts.isTypeLiteralNode(props)) report(relative, `${component.name} declares its props inline; name the type ${component.name}Props`);
    else if (props && ts.isTypeReferenceNode(props) && props.typeName.getText(source) !== `${component.name}Props`) {
      report(relative, `${component.name}'s props type is ${props.typeName.getText(source)}; name it ${component.name}Props`);
    }
  }
  if (components.length > 0 && lines > maxComponentLines) report(relative, `is ${lines} lines; split a component file over ${maxComponentLines}`);
  else if (components.length > 0 && lines > warnComponentLines && !legacyFiles.has(relative)) warnings.push(`${relative} is ${lines} lines; over ${warnComponentLines} a component usually does more than one job`);
  for (const hook of hooks) {
    if (hook.name !== base) report(relative, `hook ${hook.name} should live in ${hook.name}.ts`);
  }
}

let failed = false;
for (const [file, reason] of legacyFiles) {
  if (!problems.has(file)) {
    console.error(`${file} now follows the rules (it was listed for: ${reason}); remove it from legacyFiles in scripts/component-rules-check.mjs`);
    failed = true;
  }
}
for (const [file, messages] of problems) {
  if (legacyFiles.has(file)) continue;
  for (const message of messages) console.error(`${file} ${message}`);
  failed = true;
}
for (const warning of warnings) console.warn(`warning: ${warning}`);
if (failed) {
  console.error("\nComponent rules check failed. The rules are in Power-Tool-AGENTS/05-Power-Tool/React Code Rules.md.");
  process.exit(1);
}
console.log(`Component rules checks passed (${files.length} files, ${legacyFiles.size} legacy files still to split).`);

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

/** Top-level `function X()` and `const X = () => …` (including `memo(() => …)`), with whether they're exported. */
function topLevelFunctions(source) {
  const found = [];
  for (const statement of source.statements) {
    const exported = Boolean(ts.getModifiers?.(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword));
    if (ts.isFunctionDeclaration(statement) && statement.name) {
      found.push({ name: statement.name.text, exported, params: statement.parameters, body: statement });
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        const fn = functionIn(declaration.initializer);
        if (ts.isIdentifier(declaration.name) && fn) found.push({ name: declaration.name.text, exported, params: fn.parameters, body: fn });
      }
    }
  }
  return found;
}

function functionIn(node) {
  if (!node) return null;
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) return node;
  if (ts.isCallExpression(node)) return node.arguments.map(functionIn).find(Boolean) ?? null;
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression?.(node)) return functionIn(node.expression);
  return null;
}

function containsJsx(node) {
  let found = false;
  const visit = child => {
    if (found) return;
    if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) { found = true; return; }
    ts.forEachChild(child, visit);
  };
  ts.forEachChild(node, visit);
  return found;
}

function hasDefaultExport(source) {
  return source.statements.some(statement => ts.isExportAssignment(statement) && !statement.isExportEquals
    || ts.getModifiers?.(statement)?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword));
}
