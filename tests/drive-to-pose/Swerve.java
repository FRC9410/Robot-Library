package frc.robot.subsystems;

import com.ctre.phoenix6.swerve.SwerveRequest;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.wpilibj2.command.SubsystemBase;

/** Only hardware IO is replaced; the tested command and CTRE request types are production code. */
public class Swerve extends SubsystemBase {
  public static final class State {
    public Pose2d Pose = new Pose2d();
    public ChassisSpeeds Speeds = new ChassisSpeeds();
  }
  private final State state = new State();
  public final SwerveRequest.FieldCentricFacingAngle DRIVE_AT_ANGLE = new SwerveRequest.FieldCentricFacingAngle();
  public double MAX_DRIVE_TO_POINT_ANGULAR_RATE = Math.PI;
  public SwerveRequest lastRequest;
  public Double headingDegrees;
  public State getState() { return state; }
  public void applyRequest(SwerveRequest request) { applyRequest(request, null); }
  public void applyRequest(SwerveRequest request, Double heading) { lastRequest = request; headingDegrees = heading; }
}
