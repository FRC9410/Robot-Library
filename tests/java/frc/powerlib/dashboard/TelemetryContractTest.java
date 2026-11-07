package frc.powerlib.dashboard;

import static org.junit.Assert.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Rotation2d;
import frc.powerlib.PowerRobotContainer;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.BeforeClass;
import org.junit.Test;

public class TelemetryContractTest {
  @BeforeClass public static void initialize() { assertTrue(HAL.initialize(500, 0)); }
  @Test public void javaSnapshotFixtureIncludesAllSupportedValues() throws Exception {
    var drive = new HashMap<String, Object>();
    drive.put("Pose", new Pose2d(2, 3, Rotation2d.fromRadians(0.5)));
    drive.put("BatteryVolts", 12); drive.put("Enabled", true); drive.put("ActualState", "READY");
    drive.put("HeadingSetpointDegrees", Double.NaN); drive.put("Optional", null);
    var values = Map.of("Drive", (Map<String, Object>) drive, "Vision",
        Map.<String, Object>of("EstimatedPose", new Pose2d(4, 5, Rotation2d.fromRadians(0.25))));
    String json = SubsystemTelemetry.encodeSnapshot(values, 1, 0.1);
    var decoded = new ObjectMapper().readTree(json);
    assertTrue(decoded.at("/subsystems/Drive/HeadingSetpointDegrees").isNull());
    assertEquals(4, decoded.at("/subsystems/Vision/EstimatedPose/xMeters").asDouble(), 0);
    Files.writeString(Path.of(System.getProperty("powerlib.fixtureRoot"), "telemetry-frame.json"), json);
  }
  @Test public void ownerAndMetricNamesAreValidatedBeforePublishing() {
    assertThrows(IllegalArgumentException.class, () -> PowerRobotContainer.setSubsystemData("Intake/Wrist", "Position", 1));
    assertThrows(IllegalArgumentException.class, () -> PowerRobotContainer.setSubsystemData("Wrist", " ", 1));
  }
  @Test public void swerveModulesAreLoggedOnlyWhenEveryReadingIsFinite() {
    var good = new edu.wpi.first.math.kinematics.SwerveModuleState(1.5, Rotation2d.fromDegrees(30));
    assertTrue(DriveTelemetry.validModules(new edu.wpi.first.math.kinematics.SwerveModuleState[] {good, good, good, good}));
    assertFalse(DriveTelemetry.validModules(null));
    assertFalse(DriveTelemetry.validModules(new edu.wpi.first.math.kinematics.SwerveModuleState[0]));
    assertFalse(DriveTelemetry.validModules(new edu.wpi.first.math.kinematics.SwerveModuleState[] {
        good, new edu.wpi.first.math.kinematics.SwerveModuleState(Double.NaN, Rotation2d.kZero)}));
    assertFalse(DriveTelemetry.validModules(new edu.wpi.first.math.kinematics.SwerveModuleState[] {good, null}));
  }
  @Test public void logsRunEveryLoopWhileNetworkPublicationIsThrottled() {
    int[] logs = {0};
    for (int index = 0; index < 50; index++) SubsystemTelemetry.publish(index * 0.02, data -> logs[0]++);
    assertEquals(50, logs[0]);
  }
}
