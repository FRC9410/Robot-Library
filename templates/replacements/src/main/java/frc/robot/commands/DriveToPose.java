package frc.robot.commands;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.ctre.phoenix6.swerve.SwerveRequest.ForwardPerspectiveValue;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.Command;
import frc.powerlib.auto.DriveConstraints;
import frc.powerlib.auto.DriveToPoseController;
import frc.powerlib.auto.LegHeading;
import frc.powerlib.auto.LegSubpoints;
import frc.robot.subsystems.Swerve;
import java.util.Objects;

/**
 * Drives to a blue-origin field pose and finishes inside the leg's position and speed tolerances.
 * Heading completion is optional; enable it with {@link #withHeadingTolerance(Rotation2d)}.
 *
 * <p>Used by Power Tool generated autos and as the AutoBuilder drive-to-point factory. Coordinates
 * are never flipped for the red alliance; build a mirrored auto for that side instead.
 */
public class DriveToPose extends Command {
  private final Swerve drivetrain;
  private final Pose2d target;
  private final DriveToPoseController controller;
  private final LegSubpoints subpoints = new LegSubpoints();
  private final LegHeading heading = new LegHeading();
  /** Max turn rate in radians per second; NaN uses the drivetrain's drive-to-point rate. */
  private double maxTurnRate = Double.NaN;
  /** Radians; NaN preserves position-and-speed-only completion. */
  private double headingTolerance = Double.NaN;
  private Translation2d start = Translation2d.kZero;
  private Rotation2d startHeading = Rotation2d.kZero;
  private Rotation2d heldHeading = Rotation2d.kZero;
  private final SwerveRequest.FieldCentricFacingAngle request =
      new SwerveRequest.FieldCentricFacingAngle()
          .withForwardPerspective(ForwardPerspectiveValue.BlueAlliance)
          .withDriveRequestType(DriveRequestType.Velocity);
  private final SwerveRequest.ApplyRobotSpeeds stopRequest =
      new SwerveRequest.ApplyRobotSpeeds().withSpeeds(new ChassisSpeeds());

  public DriveToPose(Swerve drivetrain, Pose2d target) {
    this(drivetrain, target, DriveConstraints.DEFAULT);
  }

  public DriveToPose(Swerve drivetrain, Pose2d target, DriveConstraints constraints) {
    this.drivetrain = Objects.requireNonNull(drivetrain, "Drivetrain must not be null.");
    this.target = Objects.requireNonNull(target, "Target pose must not be null.");
    if (!Double.isFinite(target.getX()) || !Double.isFinite(target.getY())
        || !Double.isFinite(target.getRotation().getRadians())) {
      throw new IllegalArgumentException("Target pose must be finite.");
    }
    controller = new DriveToPoseController(constraints);
    // Share the tuned heading controller with the drivetrain's facing-angle request.
    request.HeadingController = drivetrain.DRIVE_AT_ANGLE.HeadingController;
    addRequirements(drivetrain);
  }

  /**
   * Runs an action once the robot is this fraction (0 to 1) of the way along the leg, measured
   * along the straight line from where the leg started. If the leg finishes first, it runs then.
   */
  public DriveToPose atProgress(double progress, Runnable action) {
    subpoints.add(progress, action);
    return this;
  }

  /** Keep the robot's front pointed at this field point (such as a goal) for the whole leg. */
  public DriveToPose facing(Translation2d point) {
    heading.face(point);
    return this;
  }

  /** Hold the starting heading until the leg is this fraction (0 to 1) done, then turn to the target heading. */
  public DriveToPose turningAfter(double progress) {
    heading.turnAfter(progress);
    return this;
  }

  /** Limits how fast this leg turns, in radians per second. */
  public DriveToPose withMaxTurnRate(double radiansPerSecond) {
    if (!Double.isFinite(radiansPerSecond) || radiansPerSecond <= 0) {
      throw new IllegalArgumentException("Max turn rate must be a finite, positive number.");
    }
    maxTurnRate = radiansPerSecond;
    return this;
  }

  /** Also wait for the commanded heading, within this positive tolerance of at most 180 degrees. */
  public DriveToPose withHeadingTolerance(Rotation2d tolerance) {
    double radians = Objects.requireNonNull(tolerance, "Heading tolerance must not be null.").getRadians();
    if (!Double.isFinite(radians) || radians <= 0 || radians > Math.PI) {
      throw new IllegalArgumentException("Heading tolerance must be greater than 0 and at most 180 degrees.");
    }
    headingTolerance = radians;
    return this;
  }

  @Override
  public void initialize() {
    var pose = drivetrain.getState().Pose;
    start = pose.getTranslation();
    startHeading = pose.getRotation();
    heldHeading = startHeading;
    heading.reset();
    subpoints.reset();
    controller.reset(fieldVelocity());
  }

  @Override
  public void execute() {
    Translation2d position = drivetrain.getState().Pose.getTranslation();
    double progress = DriveToPoseController.progress(start, position, target.getTranslation());
    subpoints.update(progress);
    heldHeading = heading.target(position, progress, startHeading, target.getRotation());
    Translation2d velocity = controller.calculate(position, target.getTranslation());
    apply(velocity.getX(), velocity.getY());
  }

  @Override
  public boolean isFinished() {
    var pose = drivetrain.getState().Pose;
    if (!controller.atGoal(pose.getTranslation(), fieldVelocity(), target.getTranslation())) return false;
    if (Double.isNaN(headingTolerance)) return true;
    double progress = DriveToPoseController.progress(start, pose.getTranslation(), target.getTranslation());
    Rotation2d commandedHeading = heading.target(pose.getTranslation(), progress, startHeading, target.getRotation());
    return Math.abs(pose.getRotation().minus(commandedHeading).getRadians()) <= headingTolerance;
  }

  @Override
  public void end(boolean interrupted) {
    // Clear the heading request too: cancellation must not leave the robot turning.
    // A following leg starts from measured velocity, preserving blending through the handoff.
    drivetrain.applyRequest(stopRequest);
    if (!interrupted) subpoints.finish();
  }

  private void apply(double velocityX, double velocityY) {
    drivetrain.applyRequest(request
        .withVelocityX(velocityX)
        .withVelocityY(velocityY)
        .withTargetDirection(heldHeading)
        .withMaxAbsRotationalRate(Double.isNaN(maxTurnRate) ? drivetrain.MAX_DRIVE_TO_POINT_ANGULAR_RATE : maxTurnRate),
        heldHeading.getDegrees());
  }

  private Translation2d fieldVelocity() {
    var state = drivetrain.getState();
    return new Translation2d(state.Speeds.vxMetersPerSecond, state.Speeds.vyMetersPerSecond)
        .rotateBy(state.Pose.getRotation());
  }
}
