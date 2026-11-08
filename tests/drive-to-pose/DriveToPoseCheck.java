package frc.robot.commands;

import com.ctre.phoenix6.swerve.SwerveRequest;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.auto.DriveConstraints;
import frc.robot.subsystems.Swerve;
import java.util.ArrayList;
import java.util.List;

public final class DriveToPoseCheck {
  private static int checks;
  private static void check(boolean value, String message) {
    checks++;
    if (!value) throw new AssertionError(message);
  }
  private static void near(double actual, double expected, String message) {
    check(Math.abs(actual - expected) < 1e-8, message + ": " + actual + " != " + expected);
  }
  private static SwerveRequest.FieldCentricFacingAngle request(Swerve drive) {
    return (SwerveRequest.FieldCentricFacingAngle) drive.lastRequest;
  }
  private static void stopped(Swerve drive) {
    check(drive.lastRequest instanceof SwerveRequest.ApplyRobotSpeeds, "Ending must replace the heading request");
    var speeds = ((SwerveRequest.ApplyRobotSpeeds) drive.lastRequest).Speeds;
    near(speeds.vxMetersPerSecond, 0, "Stopped X");
    near(speeds.vyMetersPerSecond, 0, "Stopped Y");
    near(speeds.omegaRadiansPerSecond, 0, "Stopped rotation");
    check(drive.headingDegrees == null, "Ending clears heading telemetry");
  }

  public static void main(String[] args) {
    check(HAL.initialize(500, 0), "HAL initializes");
    actualCommandTracksWithinLimits();
    measuredVelocityAndHeadingRequests();
    delayedTurnsAtEnteredPercentages();
    optionalHeadingCompletion();
    facingArrivalKeepsApproachHeading();
    branchHandoffStopsTurning();
    normalAndInterruptedSubpoints();
    schedulerCancellation();
    invalidArguments();
    System.out.println("DriveToPose command checks passed (" + checks + " assertions): motion limits, measured velocity, heading, requirements, progress, reuse, and stop/cancel behavior.");
  }

  private static void actualCommandTracksWithinLimits() {
    var drive = new Swerve();
    var target = new Pose2d(3, 1, Rotation2d.fromDegrees(90));
    var limits = new DriveConstraints(1.5, 2, 0.05, 0.1);
    var command = new DriveToPose(drive, target, limits);
    check(command.getRequirements().contains(drive), "Command owns the drivetrain");
    command.initialize();
    check(drive.lastRequest == null, "Initialization does not advance the controller twice in its first scheduler cycle");
    var velocity = Translation2d.kZero;
    int cycles = 0;
    while (!command.isFinished()) {
      command.execute();
      var applied = request(drive);
      check(applied.ForwardPerspective == SwerveRequest.ForwardPerspectiveValue.BlueAlliance, "Coordinates stay blue-origin");
      var next = new Translation2d(applied.VelocityX, applied.VelocityY);
      check(next.getNorm() <= 1.5 + 1e-8, "Speed stays within the leg limit");
      check(next.minus(velocity).getNorm() / 0.02 <= 2 + 1e-8, "Acceleration stays within the leg limit");
      velocity = next;
      var state = drive.getState();
      state.Pose = new Pose2d(state.Pose.getTranslation().plus(velocity.times(0.02)), state.Pose.getRotation());
      state.Speeds = ChassisSpeeds.fromFieldRelativeSpeeds(velocity.getX(), velocity.getY(), 0, state.Pose.getRotation());
      check(++cycles < 1000, "Ideal tracking reaches the target");
    }
    check(drive.getState().Pose.getTranslation().getDistance(target.getTranslation()) <= 0.05, "Finishes inside position tolerance");
    check(velocity.getNorm() <= 0.1, "Finishes inside velocity tolerance");
    command.end(false); stopped(drive);
  }

  private static void measuredVelocityAndHeadingRequests() {
    var drive = new Swerve();
    drive.getState().Pose = new Pose2d(0, 0, Rotation2d.fromDegrees(90));
    drive.getState().Speeds = new ChassisSpeeds(1, 0, 0);
    var command = new DriveToPose(drive, new Pose2d(0, 5, Rotation2d.kZero));
    command.initialize(); command.execute();
    near(request(drive).VelocityX, 0, "Measured robot X rotates into field Y");
    check(request(drive).VelocityY >= 1, "New legs carry measured velocity");
    command.end(true); stopped(drive);

    drive.getState().Pose = new Pose2d(); drive.getState().Speeds = new ChassisSpeeds();
    command = new DriveToPose(drive, new Pose2d(4, 0, Rotation2d.fromDegrees(90)))
        .turningAfter(0.5).withMaxTurnRate(0.7);
    command.initialize(); command.execute();
    near(request(drive).TargetDirection.getDegrees(), 0, "Delayed turn holds start heading");
    near(request(drive).MaxAbsRotationalRate, 0.7, "Per-leg angular rate reaches CTRE");
    drive.getState().Pose = new Pose2d(2, 0, Rotation2d.kZero); command.execute();
    near(request(drive).TargetDirection.getDegrees(), 90, "Turn starts at the requested progress");
    command.end(true);
    command = new DriveToPose(drive, new Pose2d(4, 0, Rotation2d.kZero)).facing(new Translation2d(2, 4));
    command.initialize(); command.execute();
    near(request(drive).TargetDirection.getDegrees(), 90, "Face-point heading uses current pose");
    near(request(drive).MaxAbsRotationalRate, drive.MAX_DRIVE_TO_POINT_ANGULAR_RATE, "Default turn rate uses drivetrain tuning");
    command.end(true); stopped(drive);
  }

  private static void delayedTurnsAtEnteredPercentages() {
    var drive = new Swerve();
    for (double threshold : new double[] {.1, .5, .8}) {
      var start = new Translation2d(5.8, 2.47);
      var end = new Translation2d(2.07, 2.47);
      var command = new DriveToPose(drive, new Pose2d(end, Rotation2d.fromDegrees(45))).turningAfter(threshold);
      drive.getState().Pose = new Pose2d(start, Rotation2d.fromDegrees(90));
      command.initialize(); command.execute();
      near(request(drive).TargetDirection.getDegrees(), 90, "Delayed turn holds the start heading at leg start");
      drive.getState().Pose = new Pose2d(start.interpolate(end, threshold - .001), Rotation2d.fromDegrees(90)); command.execute();
      near(request(drive).TargetDirection.getDegrees(), 90, "Delayed turn holds until the entered percentage");
      drive.getState().Pose = new Pose2d(start.interpolate(end, threshold + .001), Rotation2d.fromDegrees(90)); command.execute();
      near(request(drive).TargetDirection.getDegrees(), 45, "Delayed turn changes heading after the entered percentage");
      command.end(true);
    }
  }

  private static void normalAndInterruptedSubpoints() {
    var drive = new Swerve();
    List<String> events = new ArrayList<>();
    var command = new DriveToPose(drive, new Pose2d(4, 0, Rotation2d.kZero), new DriveConstraints(1, 1, 0.5, 1))
        .atProgress(0.25, () -> events.add("early")).atProgress(0.99, () -> events.add("late"));
    command.initialize();
    drive.getState().Pose = new Pose2d(1, 0, Rotation2d.kZero); command.execute(); command.execute();
    check(events.equals(List.of("early")), "Progress actions run only once");
    drive.getState().Pose = new Pose2d(3.6, 0, Rotation2d.kZero);
    check(command.isFinished(), "Loose tolerance releases before the exact destination");
    command.end(false);
    check(events.equals(List.of("early", "late")), "Normal completion flushes unreached subpoints");
    stopped(drive);
    drive.getState().Pose = new Pose2d(); command.initialize();
    drive.getState().Pose = new Pose2d(1, 0, Rotation2d.kZero); command.execute(); command.end(true);
    check(events.equals(List.of("early", "late", "early")), "Reuse resets progress; interruption skips remaining actions");
    stopped(drive);
  }

  private static void optionalHeadingCompletion() {
    var drive = new Swerve();
    var target = new Pose2d(2, 1, Rotation2d.fromDegrees(179));
    drive.getState().Pose = new Pose2d(2, 1, Rotation2d.kZero);
    var command = new DriveToPose(drive, target);
    command.initialize();
    check(command.isFinished(), "Heading completion stays opt-in");
    command = new DriveToPose(drive, target).withHeadingTolerance(Rotation2d.fromDegrees(5));
    command.initialize(); command.execute();
    check(!command.isFinished(), "Position and speed alone cannot finish an opted-in leg");
    near(request(drive).TargetDirection.getDegrees(), 179, "Continues requesting target heading at destination");
    drive.getState().Pose = new Pose2d(2, 1, Rotation2d.fromDegrees(-175));
    check(!command.isFinished(), "Wrapped heading outside tolerance keeps waiting");
    drive.getState().Pose = new Pose2d(2, 1, Rotation2d.fromDegrees(-179));
    check(command.isFinished(), "Shortest wrapped heading inside tolerance completes");
    drive.getState().Speeds = new ChassisSpeeds(0.2, 0, 0);
    check(!command.isFinished(), "Heading does not bypass measured-speed tolerance");
    drive.getState().Speeds = new ChassisSpeeds();
    drive.getState().Pose = new Pose2d(2.2, 1, Rotation2d.fromDegrees(-179));
    check(!command.isFinished(), "Heading does not bypass distance tolerance");
    command.end(true); stopped(drive);
    drive.getState().Pose = new Pose2d(2, 1, Rotation2d.kZero);
    command.initialize(); check(!command.isFinished(), "Reuse still waits for heading");
    command.end(true); stopped(drive);

    command = new DriveToPose(drive, new Pose2d(2, 1, Rotation2d.kZero))
        .facing(new Translation2d(2, 3)).withHeadingTolerance(Rotation2d.fromDegrees(5));
    command.initialize(); check(!command.isFinished(), "Face-point completion uses commanded heading, not pose heading");
    drive.getState().Pose = new Pose2d(2, 1, Rotation2d.fromDegrees(90));
    check(command.isFinished(), "Facing the field point completes");
    command.end(false);

    drive.getState().Pose = new Pose2d();
    command = new DriveToPose(drive, new Pose2d(2, 0, Rotation2d.fromDegrees(90)))
        .turningAfter(0.5).withHeadingTolerance(Rotation2d.fromDegrees(5));
    command.initialize(); drive.getState().Pose = new Pose2d(2, 0, Rotation2d.kZero);
    check(!command.isFinished(), "Delayed turn completion evaluates the destination heading even before execute");
    drive.getState().Pose = new Pose2d(2, 0, Rotation2d.fromDegrees(90));
    check(command.isFinished(), "Delayed turn finishes aligned"); command.end(false);
  }

  private static void facingArrivalKeepsApproachHeading() {
    var drive = new Swerve();
    var destination = new Translation2d(7.8, 3.49);
    var command = new DriveToPose(drive, new Pose2d(destination, Rotation2d.fromDegrees(90)))
        .facing(destination).withHeadingTolerance(Rotation2d.fromDegrees(5));
    drive.getState().Pose = new Pose2d(7.8, 3.0, Rotation2d.fromDegrees(90));
    command.initialize(); command.execute();
    near(request(drive).TargetDirection.getDegrees(), 90, "Faces destination while approaching");
    drive.getState().Speeds = new ChassisSpeeds(.12, 0, 0);
    for (var position : List.of(new Translation2d(7.8, 3.47), new Translation2d(7.801, 3.491),
        new Translation2d(7.79, 3.50), new Translation2d(7.81, 3.48))) {
      drive.getState().Pose = new Pose2d(position, Rotation2d.fromDegrees(90)); command.execute();
      near(request(drive).TargetDirection.getDegrees(), 90, "Arrival noise cannot reverse the face-point heading");
      check(!command.isFinished(), "Facing arrival still waits for measured translational speed");
    }
    drive.getState().Speeds = new ChassisSpeeds();
    check(command.isFinished(), "Stable heading lets arrival finish without an extra turn");
    command.end(false); stopped(drive);

    drive.getState().Pose = new Pose2d(7.8, 4, Rotation2d.fromDegrees(-90));
    command.initialize(); command.execute();
    near(request(drive).TargetDirection.getDegrees(), -90, "A new run resets the held arrival heading");
    command.end(true);

    // A field point passed during a longer leg must still be faced from its other side.
    var passing = new DriveToPose(drive, new Pose2d(7.8, 5, Rotation2d.fromDegrees(90))).facing(destination);
    drive.getState().Pose = new Pose2d(7.8, 3.4, Rotation2d.fromDegrees(90));
    passing.initialize(); passing.execute();
    near(request(drive).TargetDirection.getDegrees(), 90, "Faces a spot before passing it");
    drive.getState().Pose = new Pose2d(7.8, 3.6, Rotation2d.fromDegrees(90)); passing.execute();
    near(request(drive).TargetDirection.getDegrees(), -90, "Passing a face point still updates the bearing");
    passing.end(true);
  }

  private static void branchHandoffStopsTurning() {
    DriverStationSim.setDsAttached(true); DriverStationSim.setEnabled(true); DriverStationSim.notifyNewData();
    var drive = new Swerve();
    var destination = new Translation2d(7.8, 3.49);
    var reached = new java.util.concurrent.atomic.AtomicBoolean();
    var release = new java.util.concurrent.atomic.AtomicBoolean();
    var command = edu.wpi.first.wpilibj2.command.Commands.sequence(
        new DriveToPose(drive, new Pose2d(destination, Rotation2d.fromDegrees(90))).facing(destination),
        edu.wpi.first.wpilibj2.command.Commands.either(
            edu.wpi.first.wpilibj2.command.Commands.waitUntil(release::get),
            edu.wpi.first.wpilibj2.command.Commands.none(),
            () -> { reached.set(true); return true; }));
    drive.getState().Pose = new Pose2d(7.8, 3.0, Rotation2d.fromDegrees(90));
    CommandScheduler.getInstance().schedule(command); CommandScheduler.getInstance().run();
    drive.getState().Pose = new Pose2d(7.801, 3.491, Rotation2d.fromDegrees(90));
    drive.getState().Speeds = new ChassisSpeeds();
    CommandScheduler.getInstance().run();
    check(reached.get(), "Arrival reaches the branch without chasing the face-point bearing");
    for (int i = 0; i < 10; i++) { CommandScheduler.getInstance().run(); stopped(drive); }
    release.set(true); CommandScheduler.getInstance().run();
    check(!command.isScheduled(), "The selected branch arm completes normally");

    var nextLeg = new DriveToPose(drive, new Pose2d(7.8, 5.77, Rotation2d.fromDegrees(90)));
    var continuing = edu.wpi.first.wpilibj2.command.Commands.sequence(
        new DriveToPose(drive, new Pose2d(destination, Rotation2d.fromDegrees(90))).facing(destination),
        edu.wpi.first.wpilibj2.command.Commands.either(nextLeg,
            edu.wpi.first.wpilibj2.command.Commands.none(), () -> true));
    drive.getState().Pose = new Pose2d(7.8, 3.0, Rotation2d.fromDegrees(90));
    CommandScheduler.getInstance().schedule(continuing); CommandScheduler.getInstance().run();
    drive.getState().Pose = new Pose2d(7.801, 3.491, Rotation2d.fromDegrees(90));
    CommandScheduler.getInstance().run(); CommandScheduler.getInstance().run();
    near(request(drive).TargetDirection.getDegrees(), 90, "Then drive continues with the approach heading");
    check(request(drive).VelocityY > 0, "Then drive continues toward its next destination");
    continuing.cancel(); stopped(drive);
    DriverStationSim.setEnabled(false); DriverStationSim.notifyNewData();
  }

  private static void schedulerCancellation() {
    DriverStationSim.setDsAttached(true); DriverStationSim.setEnabled(true); DriverStationSim.notifyNewData();
    var drive = new Swerve();
    var command = new DriveToPose(drive, new Pose2d(4, 0, Rotation2d.fromDegrees(90)));
    CommandScheduler.getInstance().schedule(command); CommandScheduler.getInstance().run();
    check(command.isScheduled(), "Scheduler starts the command");
    command.cancel();
    check(!command.isScheduled(), "Scheduler cancels the command"); stopped(drive);
    DriverStationSim.setEnabled(false); DriverStationSim.notifyNewData();
  }

  private static void invalidArguments() {
    var drive = new Swerve();
    try { new DriveToPose(drive, new Pose2d(Double.NaN, 0, Rotation2d.kZero)); throw new AssertionError("Nonfinite target accepted"); }
    catch (IllegalArgumentException expected) { checks++; }
    for (double invalid : new double[] { 0, -1, Double.NaN, Double.POSITIVE_INFINITY }) {
      try { new DriveToPose(drive, new Pose2d()).withMaxTurnRate(invalid); throw new AssertionError("Invalid turn rate accepted"); }
      catch (IllegalArgumentException expected) { checks++; }
    }
    for (double invalid : new double[] { 0, -1, 181, Double.NaN, Double.POSITIVE_INFINITY }) {
      try { new DriveToPose(drive, new Pose2d()).withHeadingTolerance(Rotation2d.fromDegrees(invalid)); throw new AssertionError("Invalid heading tolerance accepted"); }
      catch (IllegalArgumentException expected) { checks++; }
    }
  }
}
