"""Extract the release over WPILib's actual stock Command Robot, check Git and build it."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import uuid
import zipfile

root = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser()
parser.add_argument('--zip', type=Path, default=root / 'build/distributions/Robot-Library-2026-Windows-x64.zip')
parser.add_argument('--wpilib', type=Path, default=Path(os.environ.get('PUBLIC', r'C:\Users\Public')) / 'wpilib/2026')
args = parser.parse_args()
fixture = root / 'build' / ('project-zip-check-' + uuid.uuid4().hex) / "new team's robot"
fixture.mkdir(parents=True)

with zipfile.ZipFile(args.wpilib / 'vsCodeExtensions/vscode-wpilib-2026.2.1.vsix') as sdk:
    for prefix, destination in [
        ('extension/resources/gradle/shared/', fixture),
        ('extension/resources/gradle/java/', fixture),
        ('extension/resources/java/src/templates/commandbasedskeleton/', fixture / 'src/main/java/frc/robot'),
    ]:
        for name in sdk.namelist():
            if not name.startswith(prefix) or name.endswith('/'):
                continue
            target = destination / name[len(prefix):]
            target.parent.mkdir(parents=True, exist_ok=True)
            content = sdk.read(name)
            if target.suffix in ['.java', '.gradle']:
                text = content.decode('utf-8').replace('###GRADLERIOREPLACE###', '2026.2.1').replace('###ROBOTCLASSREPLACE###', 'frc.robot.Main')
                text = text.replace('edu.wpi.first.wpilibj.templates.commandbasedskeleton', 'frc.robot')
                assert not re.search(r'###.*?###', text)
                content = text.encode('utf-8')
            target.write_bytes(content)
    vendors = fixture / 'vendordeps'
    vendors.mkdir()
    (vendors / 'WPILibNewCommands.json').write_bytes(sdk.read('extension/resources/vendordeps/WPILibNewCommands.json'))

prefs = fixture / '.wpilib/wpilib_preferences.json'
settings = json.loads(prefs.read_text())
settings['teamNumber'] = 1234
prefs.write_text(json.dumps(settings))
preserved_names = ['build.gradle', 'settings.gradle', 'gradlew', 'gradlew.bat', 'gradle/wrapper/gradle-wrapper.jar',
                   'gradle/wrapper/gradle-wrapper.properties', '.wpilib/wpilib_preferences.json',
                   'src/main/java/frc/robot/Main.java', 'src/main/java/frc/robot/Robot.java']
preserved = {name: (fixture / name).read_bytes() for name in preserved_names}
with zipfile.ZipFile(args.zip) as archive:
    names = archive.namelist()
    assert '.gitignore' in names and 'Power Tool.cmd' in names
    assert 'power-tool/launch.ps1' in names, 'ZIP omitted the privilege-aware startup helper'
    assert archive.read('logs/README.md') == (root / 'distribution/project-overlay/logs/README.md').read_bytes()
    integration_source = root / 'distribution/integrations'
    for path in integration_source.rglob('*'):
        if path.is_file():
            relative = path.relative_to(integration_source).as_posix()
            assert archive.read('integrations/' + relative) == path.read_bytes(), relative
            assert archive.read('power-tool/app/resources/integrations-catalog/' + relative) == path.read_bytes(), relative
    integration_catalog = json.loads(archive.read('integrations/mapping.json'))
    assert integration_catalog['schemaVersion'] == 1
    for integration_id, entry in integration_catalog['integrations'].items():
        assert entry['installationDirectory'] == integration_id
        for field in ['definition', 'installationDirectory']:
            relative = Path(entry[field])
            assert not relative.is_absolute() and '..' not in relative.parts, entry[field]
        definition = json.loads(archive.read('integrations/' + entry['definition']))
        assert definition['schemaVersion'] == 1 and definition['id'] == integration_id
        assert all(not server['enabledByDefault'] for server in definition['servers'].values())
    assert 'power-tool/app/Power Tool.exe' in names and 'power-tool/app/resources/app.asar' in names
    assert not any(name in names for name in preserved_names), 'ZIP would overwrite project-owned settings or entry points'
    assert not any(name.startswith(('build/', '.git/', 'power-tool/generated/')) for name in names)
    for tree in ['powerlib', 'replacements']:
        source = root / 'templates' / tree
        for path in source.rglob('*'):
            if path.is_file():
                name = path.relative_to(source).as_posix()
                assert archive.read(name) == path.read_bytes(), name
    for name in names:
        assert not Path(name).is_absolute() and '..' not in Path(name).parts
    archive.extractall(fixture)
for name, content in preserved.items():
    assert (fixture / name).read_bytes() == content, name

git_env = {**os.environ, 'GIT_CONFIG_GLOBAL': 'NUL'}
subprocess.run(['git', 'init', '-q', str(fixture)], check=True, env=git_env)
application_files = [p.relative_to(fixture).as_posix() for p in (fixture / 'power-tool/app').rglob('*') if p.is_file()]
ignored = subprocess.run(['git', 'check-ignore', '-z', '--stdin'], input='\0'.join(application_files) + '\0',
                         text=True, capture_output=True, cwd=fixture, env=git_env, check=True).stdout.rstrip('\0').split('\0')
assert set(ignored) == set(application_files), 'Some bundled application files are not ignored'
log_extensions = ['log', 'wpilog', 'wpilog.part', 'hoot', 'hoot.part', 'rlog', 'dslog', 'dsevents', 'jfr']
for name in ['integrations/README.md', 'integrations/mcp-wpilib/pyproject.toml',
             'integrations/mcp-wpilib/.venv/local-dependency', 'integrations/settings.json',
             'integrations/mcp-wpilib/config.json', 'logs/practice/run.txt',
             *(f'recordings/run.{extension}' for extension in log_extensions)]:
    assert subprocess.run(['git', 'check-ignore', '-q', name], cwd=fixture, env=git_env).returncode == 0, name
for name in ['src/main/java/frc/robot/RobotContainer.java', 'vendordeps/ChoreoLib2026.json',
             'gradle/wrapper/gradle-wrapper.jar', 'power-tool/generated/powerlib-autos.json',
             'logs/README.md', 'integrations/mapping.json', 'integrations/wpilib.json']:
    assert subprocess.run(['git', 'check-ignore', '-q', name], cwd=fixture, env=git_env).returncode == 1, name
print(f'ZIP layout, template contents, project/team preservation and Git exclusions passed ({len(application_files)} application files).', flush=True)

env = {**os.environ, 'JAVA_HOME': str(args.wpilib / 'jdk')}
with (fixture / 'build-check.log').open('w', encoding='utf-8') as log:
    result = subprocess.run([str(fixture / 'gradlew.bat'), '--offline', '--no-daemon', '--console=plain', 'build', 'simulateExternalJavaRelease'],
                            cwd=fixture, env=env, stdout=log, stderr=subprocess.STDOUT)
if result.returncode:
    print((fixture / 'build-check.log').read_text(encoding='utf-8')[-10000:])
    raise SystemExit(result.returncode)
(root / 'build/project-zip-check-result.json').write_text(json.dumps({'fixture': str(fixture), 'zip': str(args.zip)}))
print(f'Extracted stock robot built and prepared simulation successfully: {fixture}')
