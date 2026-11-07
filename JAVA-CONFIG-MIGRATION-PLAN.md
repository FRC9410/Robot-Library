# Power Tool Java configuration migration

Java source is the authoritative robot configuration. Existing Save actions write the affected declarations and registrations immediately. Build and deploy remain separate actions. Handwritten code, state handler behavior and unrelated declarations are preserved.

This is the execution copy of the plan approved in the chat. The previously saved plan was absent from the checkout when implementation began.

## Scope

Retire `powerlib-subsystems.json`, `powerlib-constants.json`, their virtual Java overlays, and the deferred state-handler deletion queue from normal app operation. Read legacy files only through an explicit migration review, preserve unapplied saved settings, and archive originals with a source backup. Old generator entry points must refuse to overwrite migrated source.

Keep package manifests, vendor dependencies, PathPlanner data, dashboard templates and laptop preferences. Temporary tunable recovery JSON remains app-local and scoped by robot project and connection target. Recovery loads pending drafts; Apply sends them to the robot. It never becomes another source of code defaults.

## Delivery stages

1. **Source discovery:** parse declarations, constructors, factories, enums and registrations with retained source spans. Resolve unique local references; show unsupported expressions without inventing defaults. Preserve stable subsystem IDs in Java comments. Distinguish velocity and torque-velocity by their registered concrete classes.
2. **Targeted writes:** patch only affected expressions or owned structural declarations. Serialize project operations, check source revisions, stage recoverable multi-file transactions, and preserve external edits during rollback/recovery.
3. **Scalar configuration:** read/write custom constants, drivetrain values, cameras and localization directly in Java. Preserve comments, methods, optional values, signed ratios and existing runtime policy.
4. **Subsystem structure:** create/edit/delete all four mechanism types and maintain aliases, StateMachine instances, characterization and tunable registration. Keep source identities stable when changing a runtime name. Refuse ambiguous structural changes.
5. **States:** discover Java additions; create missing handler starters; preserve existing execute methods and priority; delete edited files only with confirmation and reference checks. Idle is implicit in Config, permanently present, and last in the enum and registry.
6. **Tuning and consumers:** save selected mechanism, sensor, default-position, torque feedforward, drivetrain, localization and custom values in a single source transaction. Keep live Apply and NetworkTables contracts unchanged. Feed Logs motor grouping from the Java inventory.
7. **Migration and UI:** review field differences between real Java and saved legacy values; preserve unsupported code and pending drafts; replace deferred-generation messages; refresh source models without silently rebasing unsaved edits.
8. **Installation and retirement:** distribute one editing engine, update fresh templates and installed tools, retire old JSON wrappers, and verify fresh and upgraded projects without recreating configuration JSON.

## Verification requirements

- Read the real installed test robot without consulting JSON or constructing robot hardware.
- Prove a single gain edit changes only its initializer and preserves custom code byte-for-byte.
- Test all four mechanism types, motor structure, optional values, type changes, sensors and signed ratios.
- Test edited states, manual Java additions, priority, non-Idle startup defaults, confirmation/cancel, reference conflicts and Idle invariants.
- Preserve the existing 60-value end-to-end tuning coverage against actual Java and compile with real WPILib/vendor dependencies.
- Test stale revisions, external edits, interrupted writes, rollback and malformed legacy files.
- Reconcile legacy Java/JSON conflicts before archiving; do not run the old generator as the migration step.
- Keep temporary tuning recovery isolated from code defaults and verify app restart without automatic replay.
- Build both Power Tool copies and the migrated `library-test-robot`. Keep `2026-Robot-Powerlib-Rewrite-powerlib-install` read-only as the settings reference.

## Implementation status

Completed in Robot-Library and installed into `E:/code/projects/library-test-robot/power-tool`.

- Java is authoritative for mechanisms, drivetrain values, constants, cameras, localization and states. Save writes source immediately; File > Build Robot compiles source without regeneration. Live Apply still uses the existing NetworkTables topics.
- The shared source engine preserves source identities, methods, comments, annotations, optional values and handler priority. Shared alias edits cannot silently change another setting. Stale drafts, reference conflicts and unsupported expressions fail without discarding the draft or overwriting unrelated source.
- Multiple selected tuning defaults save in one project transaction. Recovery journals handle interrupted writes, and rollback preserves later external edits.
- Migration compares fields against actual Java, supports explicitly adding missing camera/localization declarations to older Java, and isolates unsupported source expressions. It backs up full source and legacy documents before committing, then archives legacy files. Old generator switches refuse JSON replay.
- Temporary tuning JSON is restored under app user-data. Only successful variable publications are cached. A restarted renderer offers pending drafts and requires explicit Apply; profiles and endpoints remain isolated.
- Installer/update checks preserve custom dashboards and legacy documents until review. SkipNpmInstall preserves existing dependencies. Logs motor grouping uses the Java inventory.

### Installed test robot

The legacy settings matched Java, so migration imported zero conflicting values. The active `powerlib-subsystems.json` and `powerlib-constants.json` files were archived. Source and both originals are backed up at:

`E:/code/projects/library-test-robot/build/power-tool-migration/f0520d38-94fd-41a2-97c7-2dc29ab06686`

Migration added the Java-format marker and refreshed tunable registration; mechanism settings and handwritten robot behavior were retained. The production installed app reads six mechanisms, six states including implicit Idle, and three cameras. Saving them unchanged preserves every Java source byte and creates no configuration JSON.

### Validation

- Both Power Tool production builds pass; `library-test-robot` passes its real Gradle build.
- The desktop end-to-end check saves four mechanism types and all 60 tuning samples through real forms/preload/IPC, verifies Java values, then builds the disposable robot twice without changing source on the second build.
- Fresh installation and edited mechanism/state source compile with real WPILib/vendor dependencies. Reinstallation preserves custom robot autos and project dashboards.
- Source/migration checks cover single-field edits, motor/type changes, shared aliases, optional values, edited and manually added state handlers, opaque guards, confirmation/reference checks, malformed/stale files, partial-source diagnostics, failed writes and interrupted-save recovery.
- Native recovery checks reload a renderer, confirm failed publications are excluded, restore drafts without replay, require Apply and isolate profiles. Native mechanism, Vision/States, subscription, tuning, dashboard and Logs checks pass.

No deployment or commit was performed. The 2026 reference checkout was not modified. Arbitrary Java factories remain outside the bounded editor and must be edited in Java.
