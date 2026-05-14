// Copyright (c) FIRST and other WPILib contributors.
// Open Source Software; you can modify and/or share it under the terms of
// the WPILib BSD license file in the root directory of this project.

package frc.robot.simulation;

import static edu.wpi.first.units.Units.Degrees;
import static edu.wpi.first.units.Units.Kilograms;
import static edu.wpi.first.units.Units.Meters;
import static edu.wpi.first.units.Units.MetersPerSecond;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.math.geometry.Translation2d;
import edu.wpi.first.math.geometry.Translation3d;
import edu.wpi.first.math.kinematics.ChassisSpeeds;
import edu.wpi.first.networktables.BooleanSubscriber;
import edu.wpi.first.networktables.IntegerPublisher;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import frc.robot.subsystems.StateMachine;
import org.dyn4j.geometry.Geometry;
import org.ironmaple.simulation.IntakeSimulation;
import org.ironmaple.simulation.IntakeSimulation.IntakeSide;
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.drivesims.SwerveDriveSimulation;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation;
import org.ironmaple.simulation.gamepieces.GamePieceProjectile;

public class PowerSimManager {
  private final StateMachine stateMachine;
  private final SwerveDriveSimulation swerveSim;
  private final NetworkTable simTable = NetworkTableInstance.getDefault().getTable("PowerLib/Sim");

  // POWERLIB GENERATED SIM FIELDS START - DO NOT DELETE
  // POWERLIB GENERATED SIM FIELDS END - DO NOT DELETE

  public PowerSimManager(StateMachine stateMachine) {
    this.stateMachine = stateMachine;
    this.swerveSim = stateMachine.drivetrain.getDriveSimulation();
    if (swerveSim != null) {
      initSubsystemSimulations();
    }
  }

  private void initSubsystemSimulations() {
    // POWERLIB GENERATED SIM INIT START - DO NOT DELETE
    // POWERLIB GENERATED SIM INIT END - DO NOT DELETE
  }

  public void periodic() {
    if (swerveSim == null) {
      return;
    }

    // POWERLIB GENERATED SIM PERIODIC START - DO NOT DELETE
    // POWERLIB GENERATED SIM PERIODIC END - DO NOT DELETE
  }

  private IntakeSimulation createIntakeSimulation(
      String gamePieceType,
      String intakeKind,
      String intakeSide,
      double intakeWidthMeters,
      double intakeExtensionMeters,
      int intakeCapacity) {
    IntakeSide side = IntakeSide.valueOf(intakeSide);
    if ("inTheFrame".equals(intakeKind)) {
      return IntakeSimulation.InTheFrameIntake(
          gamePieceType, swerveSim, Meters.of(intakeWidthMeters), side, intakeCapacity);
    }

    return IntakeSimulation.OverTheBumperIntake(
        gamePieceType,
        swerveSim,
        Meters.of(intakeWidthMeters),
        Meters.of(intakeExtensionMeters),
        side,
        intakeCapacity);
  }

  private void updateIntakeControl(
      IntakeSimulation intakeSimulation,
      boolean requested,
      BooleanSubscriber runningSubscriber,
      IntegerPublisher heldPublisher) {
    if (intakeSimulation == null) {
      return;
    }

    if (requested || runningSubscriber.get()) {
      intakeSimulation.startIntake();
    } else {
      intakeSimulation.stopIntake();
    }
    heldPublisher.set(intakeSimulation.getGamePiecesAmount());
  }

  private void launchProjectile(
      String gamePieceType,
      Translation2d shooterOffset,
      double launchHeightMeters,
      double launchSpeedMetersPerSecond,
      double launchAngleDegrees,
      Translation3d target,
      Translation3d targetTolerance,
      boolean becomesGamePieceOnGround) {
    Pose2d robotPose = stateMachine.drivetrain.getState().Pose;
    Rotation2d shooterFacing = robotPose.getRotation();
    ChassisSpeeds robotSpeeds = swerveSim.getDriveTrainSimulatedChassisSpeedsFieldRelative();

    GamePieceProjectile projectile =
        new GamePieceProjectile(
            createGamePieceInfo(gamePieceType),
            robotPose.getTranslation(),
            shooterOffset,
            robotSpeeds,
            shooterFacing,
            Meters.of(launchHeightMeters),
            MetersPerSecond.of(launchSpeedMetersPerSecond),
            Degrees.of(launchAngleDegrees))
            .withTargetPosition(() -> target)
            .withTargetTolerance(targetTolerance);

    if (becomesGamePieceOnGround) {
      projectile.enableBecomesGamePieceOnFieldAfterTouchGround();
    }

    SimulatedArena.getInstance().addGamePieceProjectile(projectile);
  }

  private GamePieceOnFieldSimulation.GamePieceInfo createGamePieceInfo(String gamePieceType) {
    // POWERLIB GENERATED GAME PIECE INFO START - DO NOT DELETE
    // POWERLIB GENERATED GAME PIECE INFO END - DO NOT DELETE

    return new GamePieceOnFieldSimulation.GamePieceInfo(
        gamePieceType,
        Geometry.createCircle(0.09),
        Meters.of(0.18),
        Kilograms.of(0.25),
        0.1,
        0.1,
        0.3);
  }

  // POWERLIB GENERATED SIM METHODS START - DO NOT DELETE
  // POWERLIB GENERATED SIM METHODS END - DO NOT DELETE
}
