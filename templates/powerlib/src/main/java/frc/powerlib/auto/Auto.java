package frc.powerlib.auto;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj2.command.Command;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Function;
import java.util.function.Supplier;

/** Defines an ordered auto; driving commands and mechanism commands are created for each run. */
public final class Auto {
  private interface Step {
    Command build(Function<Pose2d, Command> driveToPoint);
  }

  private record CommandStep(Supplier<Command> factory) implements Step {
    @Override public Command build(Function<Pose2d, Command> driveToPoint) {
      return factory.get();
    }
  }

  private record DriveStep(Pose2d point) implements Step {
    @Override public Command build(Function<Pose2d, Command> driveToPoint) {
      return driveToPoint.apply(point);
    }
  }

  private final String name;
  private Alliance alliance;
  private final List<Step> steps = new ArrayList<>();
  private List<Pose2d> path = List.of();
  private int nextPoint;

  public Auto(String name) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("Autonomous name must not be blank.");
    }
    this.name = name;
  }

  public String getName() { return name; }

  public Optional<Alliance> getAlliance() { return Optional.ofNullable(alliance); }

  /** Limits chooser availability; coordinates stay in their original field frame. */
  public Auto withAlliance(Alliance alliance) {
    this.alliance = Objects.requireNonNull(alliance, "Alliance must not be null.");
    return this;
  }

  /** Defines destinations consumed by toNextPoint(); this call adds no driving steps. */
  public Auto withPath(Pose2d... points) {
    if (nextPoint != path.size()) {
      throw new IllegalStateException(name + ": consume the remaining path points before replacing the path.");
    }
    Objects.requireNonNull(points, "Path must not be null.");
    List<Pose2d> replacement = new ArrayList<>(points.length);
    for (Pose2d point : points) replacement.add(requirePoint(point));
    path = List.copyOf(replacement);
    nextPoint = 0;
    return this;
  }

  /** Appends a destination directly without advancing the withPath() cursor. */
  public Auto addDriveToPoint(Pose2d point) {
    steps.add(new DriveStep(requirePoint(point)));
    return this;
  }

  /** Appends the next path destination; the previous step must finish before driving starts. */
  public Auto toNextPoint() {
    if (nextPoint >= path.size()) {
      throw new IllegalStateException(name + ": no path point at index " + nextPoint + ".");
    }
    addDriveToPoint(path.get(nextPoint));
    nextPoint++;
    return this;
  }

  /** Appends a command factory. Each call to the factory must return a fresh command. */
  public Auto addCommand(Supplier<Command> factory) {
    steps.add(new CommandStep(Objects.requireNonNull(factory, "Command factory must not be null.")));
    return this;
  }

  /** Builds a command-only auto. Use build(driveToPoint) when the auto includes destinations. */
  public Command build() { return commandFactory(null).get(); }

  /** Builds a fresh sequence using the supplied drive-command factory for every destination. */
  public Command build(Function<Pose2d, Command> driveToPoint) {
    return commandFactory(driveToPoint).get();
  }

  /** Capture the definition when it is registered, keeping later builder edits out of the chooser. */
  Supplier<Command> commandFactory(Function<Pose2d, Command> driveToPoint) {
    if (nextPoint != path.size()) {
      throw new IllegalStateException(name + ": " + (path.size() - nextPoint)
          + " path points have no toNextPoint() step.");
    }
    List<Step> definition = List.copyOf(steps);
    if (driveToPoint == null && definition.stream().anyMatch(step -> step instanceof DriveStep)) {
      throw new IllegalStateException(name + ": configure a drive-to-point command factory before building.");
    }
    return () -> {
      CommandBuilder sequence = new CommandBuilder();
      for (Step step : definition) sequence.command(() -> step.build(driveToPoint));
      return sequence.build().withName(name);
    };
  }

  private Pose2d requirePoint(Pose2d point) {
    if (point == null || !Double.isFinite(point.getX()) || !Double.isFinite(point.getY())
        || !Double.isFinite(point.getRotation().getRadians())) {
      throw new IllegalArgumentException(name + ": destinations must have a finite X, Y and heading.");
    }
    return point;
  }
}
