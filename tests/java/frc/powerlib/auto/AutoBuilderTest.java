package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.hal.AllianceStationID;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.networktables.NetworkTable;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class AutoBuilderTest {
  private final NetworkTable table = NetworkTableInstance.getDefault().getTable("SmartDashboard/Auto Chooser");

  @Before public void initialize() {
    assertTrue(HAL.initialize(500, 0));
    DriverStationSim.setDsAttached(true);
    DriverStationSim.setAllianceStationId(AllianceStationID.Blue1);
    DriverStationSim.notifyNewData();
  }

  @After public void close() { DriverStationSim.resetData(); }

  private static void finish(Command command) {
    command.initialize();
    for (int i = 0; i < 20 && !command.isFinished(); i++) command.execute();
    assertTrue(command.isFinished());
    command.end(false);
  }

  @Test public void chooserUsesItsDriveFactoryAndCapturesTheRegisteredDefinition() {
    List<String> events = new ArrayList<>();
    Pose2d destination = new Pose2d();
    try (AutoBuilder chooser = new AutoBuilder(point -> Commands.runOnce(() -> events.add("drive")))) {
      Auto auto = new Auto("Pickup").withAlliance(Alliance.Blue).withPath(destination)
          .addCommand(() -> Commands.runOnce(() -> events.add("intake"))).toNextPoint();
      chooser.addAuto(auto);
      auto.addCommand(() -> Commands.runOnce(() -> events.add("later edit"))).withAlliance(Alliance.Red);
      chooser.publish();
      table.getEntry("selected").setString("Pickup");
      Command first = chooser.getAutonomousCommand();
      finish(first);
      Command second = chooser.getAutonomousCommand();
      finish(second);
      assertNotSame(first, second);
      assertEquals(List.of("intake", "drive", "intake", "drive"), events);
      assertEquals("Pickup", table.getEntry("active").getString(""));
    }
  }

  @Test public void allianceTagsFilterDefinitionsAndUnavailableDefaultsFallBackToNone() {
    try (AutoBuilder chooser = new AutoBuilder()) {
      chooser.setDefaultAuto(new Auto("Blue").withAlliance(Alliance.Blue));
      chooser.addAuto(new Auto("Red").withAlliance(Alliance.Red));
      chooser.addAuto(new Auto("Shared"));
      chooser.publish();
      table.getEntry("selected").setString("Blue");
      assertEquals(List.of("None", "Blue", "Shared"), Arrays.asList(table.getEntry("options").getStringArray(new String[0])));
      assertEquals("Blue", chooser.getAutonomousCommand().getName());
      DriverStationSim.setAllianceStationId(AllianceStationID.Red1);
      DriverStationSim.notifyNewData();
      chooser.periodic();
      assertEquals(List.of("None", "Red", "Shared"), Arrays.asList(table.getEntry("options").getStringArray(new String[0])));
      assertEquals("None", table.getEntry("default").getString(""));
      chooser.getAutonomousCommand();
      assertEquals("None", table.getEntry("active").getString(""));
    }
  }

  @Test public void legacyFactoriesStillWorkAndDuplicateNamesAreRejected() {
    try (AutoBuilder chooser = new AutoBuilder()) {
      chooser.setDefaultAuto("Legacy", Commands::none);
      chooser.addAuto(new Auto("New"));
      assertThrows(IllegalArgumentException.class, () -> chooser.addAuto(new Auto("Legacy")));
      chooser.publish();
      table.getEntry("selected").setString("Legacy");
      assertNotSame(chooser.getAutonomousCommand(), chooser.getAutonomousCommand());
    }
  }
}
