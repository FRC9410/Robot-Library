package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.Subsystem;
import java.util.ArrayList;
import java.util.List;
import org.junit.Before;
import org.junit.Test;

public class AutoTest {
  private static final Pose2d A = new Pose2d(1, 2, new Rotation2d());
  private static final Pose2d B = new Pose2d(3, 4, Rotation2d.fromDegrees(90));

  private static final class RecordingCommand extends Command {
    private final String label;
    private final List<String> events;
    private int remaining;
    private boolean interrupted;

    RecordingCommand(String label, List<String> events, int cycles, Subsystem... requirements) {
      this.label = label;
      this.events = events;
      remaining = cycles;
      addRequirements(requirements);
    }

    @Override public void initialize() { events.add(label); }
    @Override public void execute() { remaining--; }
    @Override public boolean isFinished() { return remaining <= 0; }
    @Override public void end(boolean interrupted) { this.interrupted = interrupted; }
  }

  @Before public void initialize() { assertTrue(HAL.initialize(500, 0)); }

  private static void finish(Command command) {
    command.initialize();
    for (int i = 0; i < 30 && !command.isFinished(); i++) command.execute();
    assertTrue("Sequence must finish", command.isFinished());
    command.end(false);
  }

  @Test public void directAndCursorStylesRunTheSameOrderedSequence() {
    List<String> directEvents = new ArrayList<>();
    List<String> cursorEvents = new ArrayList<>();
    Auto direct = new Auto("Direct")
        .addCommand(() -> new RecordingCommand("intake", directEvents, 2))
        .addDriveToPoint(A)
        .addCommand(() -> new RecordingCommand("spin", directEvents, 1))
        .addCommand(() -> new RecordingCommand("wait", directEvents, 2))
        .addDriveToPoint(B);
    Auto cursor = new Auto("Cursor").withPath(A, B)
        .addCommand(() -> new RecordingCommand("intake", cursorEvents, 2))
        .toNextPoint()
        .addCommand(() -> new RecordingCommand("spin", cursorEvents, 1))
        .addCommand(() -> new RecordingCommand("wait", cursorEvents, 2))
        .toNextPoint();
    finish(direct.build(point -> new RecordingCommand(point.equals(A) ? "A" : "B", directEvents, 2)));
    finish(cursor.build(point -> new RecordingCommand(point.equals(A) ? "A" : "B", cursorEvents, 2)));
    assertEquals(List.of("intake", "A", "spin", "wait", "B"), directEvents);
    assertEquals(directEvents, cursorEvents);
  }

  @Test public void sequenceWaitsForDriveCompletionBeforeStartingTheNextCommand() {
    List<String> events = new ArrayList<>();
    Command command = new Auto("Wait for arrival").addDriveToPoint(A)
        .addCommand(() -> new RecordingCommand("shoot", events, 1))
        .build(point -> new RecordingCommand("drive", events, 2));
    command.initialize();
    assertEquals(List.of("drive"), events);
    command.execute();
    assertEquals(List.of("drive"), events);
    command.execute();
    assertEquals(List.of("drive", "shoot"), events);
    command.execute();
    assertTrue(command.isFinished());
    command.end(false);
  }

  @Test public void directDestinationsDoNotConsumeThePathCursorAndTheInputArrayIsCopied() {
    Pose2d[] points = {A, B};
    Auto auto = new Auto("Mixed").withPath(points).toNextPoint().addDriveToPoint(A).toNextPoint();
    points[1] = A;
    List<Pose2d> visited = new ArrayList<>();
    finish(auto.build(point -> Commands.runOnce(() -> visited.add(point))));
    assertEquals(List.of(A, A, B), visited);
  }

  @Test public void everyBuildCreatesFreshCommandsAndKeepsDrivetrainRequirements() {
    List<Command> created = new ArrayList<>();
    Subsystem drive = new Subsystem() {};
    Auto auto = new Auto("Repeatable").addCommand(() -> {
      Command command = Commands.none();
      created.add(command);
      return command;
    }).addDriveToPoint(A);
    java.util.function.Function<Pose2d, Command> factory = point -> {
      Command command = Commands.runOnce(() -> {}, drive);
      created.add(command);
      return command;
    };
    Command first = auto.build(factory);
    Command second = auto.build(factory);
    assertNotSame(first, second);
    assertNotSame(created.get(0), created.get(2));
    assertNotSame(created.get(1), created.get(3));
    assertTrue(first.getRequirements().contains(drive));
    assertTrue(second.getRequirements().contains(drive));
    assertEquals("Repeatable", first.getName());
    finish(first);
    finish(second);
  }

  @Test public void interruptingTheAutoInterruptsItsActiveDriveAndSkipsFutureSteps() {
    List<String> events = new ArrayList<>();
    var drive = new RecordingCommand("drive", events, 100);
    Command command = new Auto("Interrupted").addDriveToPoint(A)
        .addCommand(() -> new RecordingCommand("shoot", events, 1)).build(point -> drive);
    command.initialize();
    command.execute();
    command.end(true);
    assertTrue(drive.interrupted);
    assertEquals(List.of("drive"), events);
  }

  @Test public void incompleteOrOverrunPathsFailWithTheAutoName() {
    Auto auto = new Auto("Blue pickup").withPath(A);
    IllegalStateException incomplete = assertThrows(IllegalStateException.class,
        () -> auto.build(point -> Commands.none()));
    assertTrue(incomplete.getMessage().contains("Blue pickup"));
    assertThrows(IllegalStateException.class, () -> auto.withPath(B));
    auto.toNextPoint();
    IllegalStateException overrun = assertThrows(IllegalStateException.class, auto::toNextPoint);
    assertTrue(overrun.getMessage().contains("Blue pickup"));
    assertTrue(overrun.getMessage().contains("index 1"));
    assertThrows(IllegalStateException.class, () -> new Auto("No path").toNextPoint());
  }

  @Test public void missingDriveFactoryFailsBeforeTheAutoCanBeRegistered() {
    assertThrows(IllegalStateException.class, () -> new Auto("Needs driving").addDriveToPoint(A).build());
    try (AutoBuilder chooser = new AutoBuilder()) {
      assertThrows(IllegalStateException.class, () -> chooser.addAuto(new Auto("Needs driving").addDriveToPoint(A)));
    }
  }

  @Test public void malformedDefinitionsAndNullFactoryResultsAreRejected() {
    assertThrows(IllegalArgumentException.class, () -> new Auto(" "));
    assertThrows(IllegalArgumentException.class, () -> new Auto(null));
    Auto auto = new Auto("Invalid");
    assertThrows(NullPointerException.class, () -> auto.addCommand(null));
    assertThrows(NullPointerException.class, () -> auto.withAlliance(null));
    assertThrows(NullPointerException.class, () -> auto.withPath((Pose2d[]) null));
    assertThrows(IllegalArgumentException.class, () -> auto.addDriveToPoint(null));
    assertThrows(IllegalArgumentException.class,
        () -> auto.withPath(new Pose2d(Double.NaN, 0, new Rotation2d())));
    assertThrows(IllegalArgumentException.class,
        () -> auto.addDriveToPoint(new Pose2d(0, 0, Rotation2d.fromRadians(Double.NaN))));
    assertThrows(NullPointerException.class, () -> new Auto("Null command").addCommand(() -> null).build());
    assertThrows(NullPointerException.class, () -> new Auto("Null drive").addDriveToPoint(A).build(point -> null));
  }

  @Test public void emptyAndCommandOnlyAutosNeedNoDriveFactory() {
    finish(new Auto("Empty").build());
    List<String> events = new ArrayList<>();
    finish(new Auto("Actions only").addCommand(() -> Commands.runOnce(() -> events.add("action"))).build());
    assertEquals(List.of("action"), events);
  }
}
