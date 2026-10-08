package frc.powerlib;

import static org.junit.Assert.*;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.Test;

public class SharedDataTest {
  @Test public void legacyAndGroupedAccessReadTheSameValues() {
    PowerRobotContainer.setData("StoreTest/Position", 1.0, "rotations");
    PowerRobotContainer.setSubsystemData("StoreTest", "Position", 2.0);
    assertEquals(2, PowerRobotContainer.getData("StoreTest/Position", 0.0), 0);
    assertEquals("rotations", PowerRobotContainer.getSubsystemDataUnits("StoreTest", "Position"));
    PowerRobotContainer.setData("StoreTest/Position", 4.0);
    assertEquals("rotations", PowerRobotContainer.getSubsystemDataUnits("StoreTest", "Position"));
    PowerRobotContainer.setData("StoreUnscoped", 3);
    assertEquals(3, PowerRobotContainer.getData("StoreUnscoped"));
    assertEquals(3, PowerRobotContainer.getAllSubsystemData().get("Robot").get("StoreUnscoped"));
  }
  @Test public void callersCannotMutateOuterOrInnerMaps() {
    PowerRobotContainer.setSubsystemData("ReadOnlyTest", "Value", 1);
    var view = PowerRobotContainer.getAllSubsystemData();
    assertThrows(UnsupportedOperationException.class, () -> view.put("Injected", Map.of()));
    assertThrows(UnsupportedOperationException.class, () -> view.get("ReadOnlyTest").put("Injected", 2));
    PowerRobotContainer.setSubsystemData("ReadOnlyTest", "Value", 3);
    assertEquals(3, view.get("ReadOnlyTest").get("Value"));
  }
  @Test public void backgroundUpdatesFailBeforeMutatingData() throws Exception {
    PowerRobotContainer.setSubsystemData("ThreadTest", "Value", 1);
    var error = new AtomicReference<Throwable>();
    Thread worker = new Thread(() -> {
      try { PowerRobotContainer.setSubsystemData("ThreadTest", "Value", 2); }
      catch (Throwable failure) { error.set(failure); }
    });
    worker.start(); worker.join();
    assertTrue(error.get() instanceof IllegalStateException);
    assertEquals(1, PowerRobotContainer.getData("ThreadTest/Value"));
  }
  @Test public void tuningRevisionTracksRegistrationAndDisabledValuesStayCached() {
    String owner = "RevisionTest";
    long revision = PowerRobotContainer.getCommandVariablesRevision();
    PowerRobotContainer.setCommandVariableDefault(owner, "Speed", 1.0);
    assertEquals(revision + 1, PowerRobotContainer.getCommandVariablesRevision());
    PowerRobotContainer.updateCommandVariable(owner, "Speed", 2.0);
    assertEquals(revision + 1, PowerRobotContainer.getCommandVariablesRevision());
    PowerRobotContainer.setTuningEnabled(false);
    assertEquals(2, PowerRobotContainer.getCommandVariable(owner, "Speed", 1.0), 0);
    assertThrows(UnsupportedOperationException.class, () -> PowerRobotContainer.getAllCommandVariables().get(owner).clear());
    PowerRobotContainer.updateCommandVariable(owner, "Speed", Double.NaN);
    assertEquals(1, PowerRobotContainer.getCommandVariable(owner, "Speed", 1.0), 0);
  }
}
