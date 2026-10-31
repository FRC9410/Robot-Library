package frc.robot.commands;

import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.ctre.phoenix6.swerve.SwerveRequest.ForwardPerspectiveValue;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.wpilibj2.command.Command;
import frc.powerlib.auto.DriveConstraints;
import frc.powerlib.auto.DriveToPoseController;
import frc.powerlib.auto.LegSubpoints;
import frc.robot.subsystems.Swerve;
import java.util.Objects;

/**
 * Drives to a blue-origin field pose and finishes inside the leg's end tolerances.
 *
 * <p>Used by Power Tool generated autos and as the AutoBuilder drive-to-point factory. Coordinates
 * are never flipped for the red alliance; build a mirrored auto for that side instead.
 */
public class DriveToPose extends Command {
  private final Swerve drivetrain;
  private final Pose2d target;
  private final DriveToPoseController controller;
  private final LegSubpoints subpoints = new LegSubpoints();
  private Translation2d start = Translation2d.kZero;
  private final SwerveRequest.FieldCentricFacingAngle request =
      new SwerveRequest.FieldCentricFacingAngle()
          .withForwardPerspective(ForwardPerspectiveValue.BlueAlliance)
          .withDriveRequestType(DriveRequestType.Velocity);

  public DriveToPose(Swerve drivetrain, Pose2d target) {
    this(drivetrain, target, DriveConstraints.DEFAULT);
  }

  public DriveToPose(Swerve drivetrain, Pose2d target, DriveConstraints constraints) {
    this.drivetrain = Objects.requireNonNull(drivetrain, "Drivetrain must not be null.");
    this.target = Objects.requireNonNull(target, "Target pose must not be null.");
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

  @Override
  public void initialize() {
    start = drivetrain.getState().Pose.getTranslation();
    subpoints.reset();
    controller.reset(fieldVelocity());
    execute();
  }

  @Override
  public void execute() {
    Translation2d position = drivetrain.getState().Pose.getTranslation();
    subpoints.update(DriveToPoseController.progress(start, position, target.getTranslation()));
    Translation2d velocity = controller.calculate(position, target.getTranslation());
    apply(velocity.getX(), velocity.getY());
  }

  @Override
  public boolean isFinished() {
    return controller.atGoal(drivetrain.getState().Pose.getTranslation(), fieldVelocity(), target.getTranslation());
  }

  @Override
  public void end(boolean interrupted) {
    // A following leg starts from the measured velocity, so stopping here does not break blending.
    apply(0, 0);
    if (!interrupted) subpoints.finish();
  }

  private void apply(double velocityX, double velocityY) {
    drivetrain.applyRequest(request
        .withVelocityX(velocityX)
        .withVelocityY(velocityY)
        .withTargetDirection(target.getRotation())
        .withMaxAbsRotationalRate(drivetrain.MAX_DRIVE_TO_POINT_ANGULAR_RATE),
        target.getRotation().getDegrees());
  }

  private Translation2d fieldVelocity() {
    var state = drivetrain.getState();
    return new Translation2d(state.Speeds.vxMetersPerSecond, state.Speeds.vyMetersPerSecond)
        .rotateBy(state.Pose.getRotation());
  }
}
