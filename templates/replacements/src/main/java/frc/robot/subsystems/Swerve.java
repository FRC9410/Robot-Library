package frc.robot.subsystems;

import static edu.wpi.first.units.Units.*;

import com.ctre.phoenix6.SignalLogger;
import com.ctre.phoenix6.Utils;
import com.ctre.phoenix6.swerve.SwerveDrivetrainConstants;
import com.ctre.phoenix6.swerve.SwerveModule.DriveRequestType;
import com.ctre.phoenix6.swerve.SwerveModuleConstants;
import com.ctre.phoenix6.swerve.SwerveRequest;
import com.ctre.phoenix6.swerve.utility.PhoenixPIDController;
import com.pathplanner.lib.auto.AutoBuilder;
import com.pathplanner.lib.config.PIDConstants;
import com.pathplanner.lib.config.RobotConfig;
import com.pathplanner.lib.controllers.PPHolonomicDriveController;
import edu.wpi.first.math.Matrix;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.math.kinematics.SwerveModuleState;
import edu.wpi.first.math.numbers.N1;
import edu.wpi.first.math.numbers.N3;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StructArrayPublisher;
import edu.wpi.first.networktables.StructPublisher;
import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj.Notifier;
import edu.wpi.first.wpilibj.RobotController;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Subsystem;
import edu.wpi.first.wpilibj2.command.sysid.SysIdRoutine;
import frc.powerlib.PowerRobotContainer;
import frc.robot.constants.SimConstants;
import frc.robot.constants.TunerConstants;
import frc.robot.constants.TunerConstants.TunerSwerveDrivetrain;
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import org.ironmaple.simulation.drivesims.configs.DriveTrainSimulationConfig;

/**
 * Class that extends the Phoenix 6 SwerveDrivetrain class and implements Subsystem so it can easily
 * be used in command-based projects.
 */
public class Swerve extends TunerSwerveDrivetrain implements Subsystem {
  private static final double kSimLoopPeriod = 0.005; // 5 ms
  private Notifier m_simNotifier = null;
  private double m_lastSimTime;
  private SwerveDriveSimulation m_driveSimulation = null;
  private final StructPublisher<Pose2d> posePublisher =
      NetworkTableInstance.getDefault().getStructTopic("Robot/Pose", Pose2d.struct).publish();
  private final StructArrayPublisher<SwerveModuleState> moduleStatePublisher =
      NetworkTableInstance.getDefault()
          .getStructArrayTopic("Robot/SwerveStates", SwerveModuleState.struct)
          .publish();

  /* Blue alliance sees forward as 0 degrees (toward red alliance wall) */
  private static final Rotation2d kBlueAlliancePerspectiveRotation = Rotation2d.kZero;
  /* Red alliance sees forward as 180 degrees (toward blue alliance wall) */
  private static final Rotation2d kRedAlliancePerspectiveRotation = Rotation2d.k180deg;
  /* Keep track if we've ever applied the operator perspective before or not */
  private boolean m_hasAppliedOperatorPerspective = false;

  /* Swerve requests to apply during SysId characterization */
  private final SwerveRequest.SysIdSwerveTranslation m_translationCharacterization =
      new SwerveRequest.SysIdSwerveTranslation();
  private final SwerveRequest.SysIdSwerveSteerGains m_steerCharacterization =
      new SwerveRequest.SysIdSwerveSteerGains();
  private final SwerveRequest.SysIdSwerveRotation m_rotationCharacterization =
      new SwerveRequest.SysIdSwerveRotation();

  private final PhoenixPIDController HEADING_CONTROLLER = new PhoenixPIDController(7, 0, 0);

  public double MAX_SPEED = TunerConstants.kSpeedAt12Volts.in(MetersPerSecond);
  public double MAX_ANGULAR_RATE =
      RotationsPerSecond.of(0.75)
          .in(RadiansPerSecond); // 0.75 rotations per second in radians per second unit
  public double MAX_DRIVE_TO_POINT_ANGULAR_RATE =
      RotationsPerSecond.of(0.5)
          .in(RadiansPerSecond); // 0.75 rotations per second in radians per second unit

  public final SwerveRequest.FieldCentric FIELD_RELATIVE =
      new SwerveRequest.FieldCentric()
          .withDeadband(MAX_SPEED * 0.1)
          .withRotationalDeadband(MAX_ANGULAR_RATE * 0.1)
          .withDriveRequestType(DriveRequestType.OpenLoopVoltage);

  public final SwerveRequest.RobotCentric ROBOT_RELATIVE =
      new SwerveRequest.RobotCentric()
          .withDeadband(MAX_SPEED * 0.1)
          .withRotationalDeadband(MAX_ANGULAR_RATE * 0.1)
          .withDriveRequestType(DriveRequestType.OpenLoopVoltage);

  public final SwerveRequest.FieldCentricFacingAngle DRIVE_AT_ANGLE =
      new SwerveRequest.FieldCentricFacingAngle()
          .withDeadband(MAX_SPEED * 0.1)
          .withRotationalDeadband(MAX_ANGULAR_RATE * 0.1)
          .withDriveRequestType(DriveRequestType.Velocity);

  /** Swerve request to apply during robot-centric path following */
  private final SwerveRequest.ApplyRobotSpeeds m_pathApplyRobotSpeeds =
      new SwerveRequest.ApplyRobotSpeeds();

  /* SysId routine for characterizing translation. This is used to find PID gains for the drive motors. */
  private final SysIdRoutine m_sysIdRoutineTranslation =
      new SysIdRoutine(
          new SysIdRoutine.Config(
              null, // Use default ramp rate (1 V/s)
              Volts.of(4), // Reduce dynamic step voltage to 4 V to prevent brownout
              null, // Use default timeout (10 s)
              // Log state with SignalLogger class
              state -> SignalLogger.writeString("SysIdTranslation_State", state.toString())),
          new SysIdRoutine.Mechanism(
              output -> setControl(m_translationCharacterization.withVolts(output)), null, this));

  /* SysId routine for characterizing steer. This is used to find PID gains for the steer motors. */
  private final SysIdRoutine m_sysIdRoutineSteer =
      new SysIdRoutine(
          new SysIdRoutine.Config(
              null, // Use default ramp rate (1 V/s)
              Volts.of(7), // Use dynamic voltage of 7 V
              null, // Use default timeout (10 s)
              // Log state with SignalLogger class
              state -> SignalLogger.writeString("SysIdSteer_State", state.toString())),
          new SysIdRoutine.Mechanism(
              volts -> setControl(m_steerCharacterization.withVolts(volts)), null, this));

  /*
   * SysId routine for characterizing rotation.
   * This is used to find PID gains for the FieldCentricFacingAngle HeadingController.
   * See the documentation of SwerveRequest.SysIdSwerveRotation for info on importing the log to SysId.
   */
  private final SysIdRoutine m_sysIdRoutineRotation =
      new SysIdRoutine(
          new SysIdRoutine.Config(
              /* This is in radians per second, but SysId only supports "volts per second" */
              Volts.of(Math.PI / 6).per(Second),
              /* This is in radians per second, but SysId only supports "volts" */
              Volts.of(Math.PI),
              null, // Use default timeout (10 s)
              // Log state with SignalLogger class
              state -> SignalLogger.writeString("SysIdRotation_State", state.toString())),
          new SysIdRoutine.Mechanism(
              output -> {
                /* output is actually radians per second, but SysId only supports "volts" */
                setControl(m_rotationCharacterization.withRotationalRate(output.in(Volts)));
                /* also log the requested output for SysId */
                SignalLogger.writeDouble("Rotational_Rate", output.in(Volts));
              },
              null,
              this));

  /* The SysId routine to test */
  private SysIdRoutine m_sysIdRoutineToApply = m_sysIdRoutineTranslation;

  /**
   * Constructs a CTRE SwerveDrivetrain using the specified constants.
   *
   * <p>This constructs the underlying hardware devices, so users should not construct the devices
   * themselves. If they need the devices, they can access them through getters in the classes.
   *
   * @param drivetrainConstants Drivetrain-wide constants for the swerve drive
   * @param modules Constants for each specific module
   */
  public Swerve(
      SwerveDrivetrainConstants drivetrainConstants, SwerveModuleConstants<?, ?, ?>... modules) {
    super(drivetrainConstants, modules);
    if (Utils.isSimulation()) {
      initSim();
    }
    DRIVE_AT_ANGLE.HeadingController = HEADING_CONTROLLER;
    DRIVE_AT_ANGLE.HeadingController.enableContinuousInput(-Math.PI, Math.PI);
    configureAutoBuilder();
  }

  /**
   * Constructs a CTRE SwerveDrivetrain using the specified constants.
   *
   * <p>This constructs the underlying hardware devices, so users should not construct the devices
   * themselves. If they need the devices, they can access them through getters in the classes.
   *
   * @param drivetrainConstants Drivetrain-wide constants for the swerve drive
   * @param odometryUpdateFrequency The frequency to run the odometry loop. If unspecified or set to
   *     0 Hz, this is 250 Hz on CAN FD, and 100 Hz on CAN 2.0.
   * @param modules Constants for each specific module
   */
  public Swerve(
      SwerveDrivetrainConstants drivetrainConstants,
      double odometryUpdateFrequency,
      SwerveModuleConstants<?, ?, ?>... modules) {
    super(drivetrainConstants, odometryUpdateFrequency, modules);
    if (Utils.isSimulation()) {
      initSim();
    }
    DRIVE_AT_ANGLE.HeadingController = HEADING_CONTROLLER;
    DRIVE_AT_ANGLE.HeadingController.enableContinuousInput(-Math.PI, Math.PI);
    configureAutoBuilder();
  }

  /**
   * Constructs a CTRE SwerveDrivetrain using the specified constants.
   *
   * <p>This constructs the underlying hardware devices, so users should not construct the devices
   * themselves. If they need the devices, they can access them through getters in the classes.
   *
   * @param drivetrainConstants Drivetrain-wide constants for the swerve drive
   * @param odometryUpdateFrequency The frequency to run the odometry loop. If unspecified or set to
   *     0 Hz, this is 250 Hz on CAN FD, and 100 Hz on CAN 2.0.
   * @param odometryStandardDeviation The standard deviation for odometry calculation in the form
   *     [x, y, theta], with units in meters and radians
   * @param visionStandardDeviation The standard deviation for vision calculation in the form [x, y,
   *     theta], with units in meters and radians
   * @param modules Constants for each specific module
   */
  public Swerve(
      SwerveDrivetrainConstants drivetrainConstants,
      double odometryUpdateFrequency,
      Matrix<N3, N1> odometryStandardDeviation,
      Matrix<N3, N1> visionStandardDeviation,
      SwerveModuleConstants<?, ?, ?>... modules) {
    super(
        drivetrainConstants,
        odometryUpdateFrequency,
        odometryStandardDeviation,
        visionStandardDeviation,
        modules);
    if (Utils.isSimulation()) {
      initSim();
    }
    DRIVE_AT_ANGLE.HeadingController = HEADING_CONTROLLER;
    DRIVE_AT_ANGLE.HeadingController.enableContinuousInput(-Math.PI, Math.PI);
    configureAutoBuilder();
  }

  public void applyRequest(SwerveRequest request) {
    setControl(request);
  }

  public void drive(double x, double y, double rotation, DriveMode mode) {

    switch (mode) {
      case SYS_ID:
        break;
      case FIELD_RELATIVE:
        applyRequest(
            FIELD_RELATIVE.withVelocityX(x).withVelocityY(y).withRotationalRate(-rotation));
        break;
      case ROBOT_RELATIVE:
        applyRequest(
            ROBOT_RELATIVE.withVelocityX(x).withVelocityY(y).withRotationalRate(-rotation));
        break;
      case ROTATION_LOCK:
        applyRequest(
            DRIVE_AT_ANGLE
                .withVelocityX(x)
                .withVelocityY(y)
                .withTargetDirection(Rotation2d.fromDegrees(rotation)));
        break;
      case DRIVE_TO_POINT:
        applyRequest(
            DRIVE_AT_ANGLE
                .withVelocityX(x)
                .withVelocityY(y)
                .withTargetDirection(Rotation2d.fromDegrees(rotation))
                .withMaxAbsRotationalRate(MAX_DRIVE_TO_POINT_ANGULAR_RATE));
        break;
    }
  }

  /**
   * Runs the SysId Quasistatic test in the given direction for the routine specified by {@link
   * #m_sysIdRoutineToApply}.
   *
   * @param direction Direction of the SysId Quasistatic test
   * @return Command to run
   */
  public Command sysIdQuasistatic(SysIdRoutine.Direction direction) {
    return m_sysIdRoutineToApply.quasistatic(direction);
  }

  /**
   * Runs the SysId Dynamic test in the given direction for the routine specified by {@link
   * #m_sysIdRoutineToApply}.
   *
   * @param direction Direction of the SysId Dynamic test
   * @return Command to run
   */
  public Command sysIdDynamic(SysIdRoutine.Direction direction) {
    return m_sysIdRoutineToApply.dynamic(direction);
  }

  @Override
  public void periodic() {
    /*
     * Periodically try to apply the operator perspective.
     * If we haven't applied the operator perspective before, then we should apply it regardless of DS state.
     * This allows us to correct the perspective in case the robot code restarts mid-match.
     * Otherwise, only check and apply the operator perspective if the DS is disabled.
     * This ensures driving behavior doesn't change until an explicit disable event occurs during testing.
     */
    if (!m_hasAppliedOperatorPerspective || DriverStation.isDisabled()) {
      DriverStation.getAlliance()
          .ifPresent(
              allianceColor -> {
                setOperatorPerspectiveForward(
                    allianceColor == Alliance.Red
                        ? kRedAlliancePerspectiveRotation
                        : kBlueAlliancePerspectiveRotation);
                m_hasAppliedOperatorPerspective = true;
              });
    }

    publishRobotPose();
  }

  private void publishRobotPose() {
    var state = getState();
    Pose2d pose = state.Pose;
    ChassisSpeeds speeds = state.Speeds;
    Rotation2d rotation = pose.getRotation();
    double xMeters = pose.getX();
    double yMeters = pose.getY();
    double rotationDegrees = rotation.getDegrees();

    PowerRobotContainer.setData("Swerve/Pose/XMeters", xMeters);
    PowerRobotContainer.setData("Swerve/Pose/YMeters", yMeters);
    PowerRobotContainer.setData("Swerve/Pose/RotationDegrees", rotationDegrees);
    PowerRobotContainer.setData("Swerve/Speeds/VXMetersPerSecond", speeds.vxMetersPerSecond);
    PowerRobotContainer.setData("Swerve/Speeds/VYMetersPerSecond", speeds.vyMetersPerSecond);
    PowerRobotContainer.setData("Swerve/Speeds/OmegaRadiansPerSecond", speeds.omegaRadiansPerSecond);

    posePublisher.set(pose);
    moduleStatePublisher.set(state.ModuleStates);

    SignalLogger.writeDouble("Swerve Pose X", xMeters, "meters");
    SignalLogger.writeDouble("Swerve Pose Y", yMeters, "meters");
    SignalLogger.writeDouble("Swerve Pose Rotation", rotationDegrees, "degrees");
    SignalLogger.writeDouble("Swerve Speed VX", speeds.vxMetersPerSecond, "meters per second");
    SignalLogger.writeDouble("Swerve Speed VY", speeds.vyMetersPerSecond, "meters per second");
    SignalLogger.writeDouble(
        "Swerve Speed Omega", speeds.omegaRadiansPerSecond, "radians per second");
  }

  private void initSim() {
    m_driveSimulation = new SwerveDriveSimulation(
        DriveTrainSimulationConfig.Default()
            .withRobotMass(Kilograms.of(SimConstants.ROBOT_MASS_KG))
            .withBumperSize(
                Meters.of(SimConstants.BUMPER_LENGTH_METERS),
                Meters.of(SimConstants.BUMPER_WIDTH_METERS)),
        new Pose2d());
    startSimThread();
  }

  private void startSimThread() {
    m_lastSimTime = Utils.getCurrentTimeSeconds();

    /* Run simulation at a faster rate so PID gains behave more reasonably */
    m_simNotifier =
        new Notifier(
            () -> {
              final double currentTime = Utils.getCurrentTimeSeconds();
              double deltaTime = currentTime - m_lastSimTime;
              m_lastSimTime = currentTime;

              SimulatedArena.getInstance().simulationPeriodic();
              /* use the measured time delta, get battery voltage from WPILib */
              updateSimState(deltaTime, RobotController.getBatteryVoltage());
              /* keep odometry in sync with MapleeSim physics */
              if (m_driveSimulation != null) {
                resetPose(m_driveSimulation.getSimulatedDriveTrainPose());
              }
            });
    m_simNotifier.startPeriodic(kSimLoopPeriod);
  }

  /**
   * Adds a vision measurement to the Kalman Filter. This will correct the odometry pose estimate
   * while still accounting for measurement noise.
   *
   * @param visionRobotPoseMeters The pose of the robot as measured by the vision camera.
   * @param timestampSeconds The timestamp of the vision measurement in seconds.
   */
  @Override
  public void addVisionMeasurement(Pose2d visionRobotPoseMeters, double timestampSeconds) {
    super.addVisionMeasurement(visionRobotPoseMeters, Utils.fpgaToCurrentTime(timestampSeconds));
  }

  /**
   * Adds a vision measurement to the Kalman Filter. This will correct the odometry pose estimate
   * while still accounting for measurement noise.
   *
   * <p>Note that the vision measurement standard deviations passed into this method will continue
   * to apply to future measurements until a subsequent call to {@link
   * #setVisionMeasurementStdDevs(Matrix)} or this method.
   *
   * @param visionRobotPoseMeters The pose of the robot as measured by the vision camera.
   * @param timestampSeconds The timestamp of the vision measurement in seconds.
   * @param visionMeasurementStdDevs Standard deviations of the vision pose measurement in the form
   *     [x, y, theta], with units in meters and radians.
   */
  @Override
  public void addVisionMeasurement(
      Pose2d visionRobotPoseMeters,
      double timestampSeconds,
      Matrix<N3, N1> visionMeasurementStdDevs) {
    super.addVisionMeasurement(
        visionRobotPoseMeters, Utils.fpgaToCurrentTime(timestampSeconds), visionMeasurementStdDevs);
  }

  public static enum DriveMode {
    ROBOT_RELATIVE,
    FIELD_RELATIVE,
    SYS_ID,
    ROTATION_LOCK,
    DRIVE_TO_POINT
  }

  public void configureAutoBuilder() {
    try {
      var config = RobotConfig.fromGUISettings();
      AutoBuilder.configure(
          () -> getState().Pose, // Supplier of current robot pose
          this::resetPose, // Consumer for seeding pose against auto
          () -> getState().Speeds, // Supplier of current robot speeds
          // Consumer of ChassisSpeeds and feedforwards to drive the robot
          (speeds, feedforwards) ->
              setControl(
                  m_pathApplyRobotSpeeds
                      .withSpeeds(ChassisSpeeds.discretize(speeds, 0.020))
                      .withWheelForceFeedforwardsX(feedforwards.robotRelativeForcesXNewtons())
                      .withWheelForceFeedforwardsY(feedforwards.robotRelativeForcesYNewtons())),
          new PPHolonomicDriveController(
              // PID constants for translation
              new PIDConstants(2.2, 0, 0),
              // PID constants for rotation
              new PIDConstants(7.0, 0, 0)),
          config,
          // Assume the path needs to be flipped for Red vs Blue, this is normally the case
          () -> DriverStation.getAlliance().orElse(Alliance.Blue) == Alliance.Red,
          this // Subsystem for requirements
          );
    } catch (Exception ex) {
      DriverStation.reportError(
          "Failed to load PathPlanner config and configure AutoBuilder", ex.getStackTrace());
    }
  }
}
