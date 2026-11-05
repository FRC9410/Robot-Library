import { Alert } from "@mui/material";
import { gridColumns } from "./autoColumns";
import { AutoField } from "./components/AutoField";
import { AutoHeader } from "./components/AutoHeader";
import { AutoListPane } from "./components/AutoListPane";
import { AutoMessageSnackbar } from "./components/AutoMessageSnackbar";
import { AutoReplayBar } from "./components/AutoReplayBar";
import { CameraDialog } from "./components/CameraDialog";
import { ColumnSplitter } from "./components/ColumnSplitter";
import { DocumentActions } from "./components/DocumentActions";
import { FieldToolbar } from "./components/FieldToolbar";
import { GeneratedCode } from "./components/GeneratedCode";
import { Pane } from "./components/Pane";
import { ReplayPill } from "./components/ReplayPill";
import { ShortcutsDialog } from "./components/ShortcutsDialog";
import { StepsPane } from "./components/StepsPane";
import { useAutoBuilder } from "./useAutoBuilder";
import { useColumnLayout } from "./useColumnLayout";
import "./autos.css";
import "./autoBuilder.css";

/**
 * The Autos tab: the autos on the left, the selected auto on the field (or as code) with its replay
 * in the middle, and its steps and the selected step's settings on the right.
 */
export function AutoBuilderPanel() {
  const builder = useAutoBuilder();
  const [columns, setColumns] = useColumnLayout();
  const { api, files, document, history, saving, selection, analysis, playback, moment, editor, run, runs } = builder;
  const { auto } = selection;
  const autoIssues = analysis.autoIssues;

  return (
    <div className="ab-root" style={{ gridTemplateColumns: gridColumns(columns) }}>
      <AutoListPane collapsed={!columns.leftOpen} loading={files.loading} document={document} selectedAutoId={selection.selectedAutoId}
        issues={analysis.issues} durations={analysis.autoDurations} canAddPoint={auto !== null && !analysis.viewingMirror}
        onSelect={builder.selectAuto} autos={editor.autos} points={editor.points} />

      <ColumnSplitter side="left" layout={columns} onChange={setColumns} />

      <section className="ab-main">
        {files.error && <Alert severity={api ? "error" : "info"}>{files.error}</Alert>}
        <Pane className="ab-workspace" label="Selected auto">
          <AutoHeader auto={auto} issues={autoIssues.filter(issue => !issue.stepId)} onRename={editor.autos.rename}
            onAlliance={editor.autos.setAlliance} onSymmetry={builder.setSymmetry} onDefault={checked => auto && editor.autos.setDefault(auto.id, checked)}
            actions={<DocumentActions saveState={saving.saveState} dirty={saving.dirty} canSave={Boolean(api)} canUndo={history.canUndo}
              canRedo={history.canRedo} onUndo={history.undo} onRedo={history.redo} onReload={builder.reload} />} />
          <FieldToolbar view={builder.view} auto={auto} mirror={analysis.mirror} showingMirror={analysis.viewingMirror} run={run}
            recording={run !== undefined && run === runs.recording} showRun={runs.showActual} robotConnected={Boolean(builder.livePose)}
            showTags={builder.showTags} tagsAvailable={builder.layout !== null} onView={builder.setView} onShowMirror={builder.showMirrorCopy}
            onToggleRun={runs.toggleActual} onClearRun={runs.clearRun} onPointAtRobot={() => builder.livePose && editor.field.addPointAt(builder.livePose)}
            onToggleTags={builder.toggleTags} onOpenCameras={() => builder.setCamerasOpen(true)} onOpenShortcuts={() => builder.setShortcutsOpen(true)} />
          <div className="ab-stage">
            {builder.view === "code"
              ? <GeneratedCode document={document} project={analysis.project} />
              : <AutoField auto={analysis.routeAuto} field={builder.field} layout={builder.layout} robot={files.robot} stateColor={analysis.stateColor}
                selectedStepIds={selection.selection} driveNumbers={analysis.driveNumbers} ghosts={analysis.ghosts} replay={analysis.replay}
                pose={moment.pose ?? builder.livePose} replaying={playback.time !== null} onSelectSteps={selection.selectSteps}
                onAddPoint={editor.field.addPoint} onMovePoints={editor.field.movePoints} onChangeHeading={editor.field.changeHeading}
                onChangeSubpoint={editor.field.changeSubpoint} onChangeFace={editor.field.changeFace}
                points={analysis.viewingMirror ? [] : document.points} onAddFromPoint={editor.points.driveTo}
                actual={run && (run === runs.recording || runs.showActual) ? run.points : undefined} vision={builder.visionOverlay} />}
            {builder.view === "field" && moment.frame && <ReplayPill speed={moment.frame.speed} state={moment.state} />}
          </div>
          <AutoReplayBar replay={analysis.replay} playback={playback} activeStepId={moment.activeStepId} period={document.periodSeconds}
            stateColor={analysis.stateColor} stepColor={builder.stepColor} stepNumber={stepId => analysis.stepNumbers.get(stepId)}
            robotCheck={builder.robotCheck} vision={analysis.vision ?? undefined} onPeriod={editor.autos.setPeriod} onSelectStep={selection.selectStep} />
        </Pane>
      </section>

      <ColumnSplitter side="right" layout={columns} onChange={setColumns} />

      <StepsPane collapsed={!columns.rightOpen} auto={auto} stepCount={builder.stepCount} selection={selection.selection} selectedStep={builder.selectedStep}
        choices={builder.choices} activeStepId={moment.activeStepId} durations={analysis.durations} issues={autoIssues} stateColor={analysis.stateColor}
        driveNumbers={analysis.driveNumbers} states={files.states} points={document.points} mirrored={analysis.viewingMirror} legInfo={builder.legInfo}
        drivetrain={files.loading ? undefined : analysis.drivetrain} checks={files.checks} period={document.periodSeconds} reachedAt={builder.reachedAt}
        onSelectSteps={selection.selectSteps} onShowArm={builder.showArm} steps={editor.steps} pointActions={editor.points} />

      <CameraDialog open={builder.camerasOpen} cameras={document.cameras} robotCameraNames={files.vision?.cameraNames ?? []}
        onChange={editor.autos.setCameras} onClose={() => builder.setCamerasOpen(false)} />
      <ShortcutsDialog open={builder.shortcutsOpen} onClose={() => builder.setShortcutsOpen(false)} />
      <AutoMessageSnackbar message={builder.message} onClose={() => builder.setMessage(null)} />
    </div>
  );
}
