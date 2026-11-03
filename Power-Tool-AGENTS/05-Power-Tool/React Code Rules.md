---
title: React Code Rules
date: 2026-11-02
tags: [power-tool, react, rules, agents]
aliases: [Code Rules, React Rules]
---

# React Code Rules

Rules for every React/TypeScript change in Power Tool: `powerlib-dashboard/src/` and the
team-owned `powerlib-dashboard/dashboard/`. They apply to people and coding agents alike.
A change that breaks one of them isn't finished.

The three rules are **one component per file**, **composition** and **reusability**. The
Subsystems tab (`src/features/subsystems/components/`) already follows all three; copy its shape.

## 1. One component per file

- Each `.tsx` file holds **exactly one** React component. That includes small private ones like
  a table row: `StatusRow` gets its own `StatusRow.tsx`, even if only one file uses it.
- The file name matches the component: `MechanismPlot` lives in `MechanismPlot.tsx`.
- Use a named export, `export function MechanismPlot(…)`. No default exports (the codebase uses none).
- The props type goes right above the component and is named `<Component>Props`:

  ```tsx
  type MechanismPlotProps = {
    mechanism: LogMechanism;
    time: number;
  };

  export function MechanismPlot({ mechanism, time }: MechanismPlotProps) {
  ```
- Plain helper functions (formatting, math) may stay in the file if only that component uses
  them. Helpers used by more than one file move to the feature's model or utils file.
- Custom hooks go in their own file named after the hook: `useLogPlayback.ts`.

## 2. Composition

Build a screen out of small components that each do one job, then put them together.

- **The panel puts the pieces together.** `<Feature>Panel.tsx` holds the screen's top-level state
  and lays out child components. It passes data down through props and gets changes back through
  `on…` callbacks. It doesn't draw charts, tables or forms itself.
- **One job per component.** If you need "and" to say what a component does ("draws the graph
  and picks the view and shows the legend"), split it.
- **Wrappers take `children`.** A card, panel or section frame takes `children` instead of
  knowing what goes inside it.
- **Use slots, not mode flags.** To let callers change part of a component, take a render prop
  or child, as `DrivePanel` does with `renderTopCards` and `renderSidebar`. Don't add a
  `mode="logs" | "drive"` prop that switches the component's insides.
- **Logic goes outside components.** Turning signals or topics into display data belongs in
  pure functions in `<feature>Model.ts` or `<feature>Utils.ts` (like `driveModel.ts` and
  `logModel.ts`). Those are what the `scripts/*-check.mjs` checks test. Components call them and
  render the result.
- **Size check:** a component file over about **150 lines** usually does more than one job.
  Over **250**, split it.

## 3. Reusability

- **Look before you write.** Search `src/components/` and the other features for something
  that already does the job. Extend it with a prop or slot instead of copying it.
- **Shared means `src/components/`.** A component used by two or more features moves to
  `src/components/<Component>.tsx`. Feature-only components stay in
  `src/features/<feature>/components/`.
- **No copy-pasted JSX.** If the same block of markup appears twice, make it a component.
- **Shared components don't know where data comes from.** They take values through props.
  NetworkTables topic paths, `window.powerlib` calls and log signal names belong in the feature
  that uses the component, not in the component.

## Folder layout

```text
src/
  components/                 shared by two or more features
  features/<feature>/
    <Feature>Panel.tsx        the screen; composes everything below
    components/               one component per file
    use<Thing>.ts             hooks, one per file
    <feature>Model.ts         pure data logic (tested by scripts/*-check.mjs)
    <feature>Utils.ts         small pure helpers
    types.ts                  shared types for the feature
```

To add a tab, follow "Adding a tab" in [Tabs and Features](Tabs%20and%20Features.md) and use this layout.

## Checking a change

- `npm run build` in `powerlib-dashboard/` must pass (type-check + bundle).
- Run the checks for the area from [Change to Tests Map](../07-Testing/Change%20to%20Tests%20Map.md).
- A refactor that only splits or moves components must not change what the tab shows or does.
- Update [Tabs and Features](Tabs%20and%20Features.md) when file or component names change.

## Files that don't follow the rules yet

As of 2026-11-02. Remove a row once its file is split.

| File | Problem |
|---|---|
| `src/features/drive/DrivePanel.tsx` | 5 components: `Field`, `CameraCanvas`, `CameraUrlSetting`, `CameraStream`, `DrivePanel` |
| `src/App.tsx` | 3 components; `AppContent` is about 680 lines (app bar, tabs, dialogs, connection, Update Code) |
| `src/features/networktables/SaveTunedValuesDialog.tsx` | One component, but 767 lines |
| `src/features/networktables/NetworkTablesPanel.tsx` | 2 components: `TopicTree`, `NetworkTablesPanel` |
| `src/features/limelights/LimelightsPanel.tsx` | 2 components: `LimelightsPanel`, `LimelightConfiguration` |

**Reuse to fix:** the Drive tab's `Field` and the Logs tab's `components/FieldView.tsx` both draw the field.
They should become one shared `src/components/FieldView.tsx`.

Related: [Tabs and Features](Tabs%20and%20Features.md), [Power Tool Architecture](Power%20Tool%20Architecture.md), [Custom Dashboard](Custom%20Dashboard.md), [Maintaining This Vault](../Maintaining%20This%20Vault.md)
