package frc.powerlib.controls;

import static org.junit.Assert.*;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.button.Trigger;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;

public class ButtonBindingsTest {
  private final CommandScheduler scheduler = CommandScheduler.getInstance();

  @Before public void initialize() {
    assertTrue(HAL.initialize(500, 0));
    scheduler.getDefaultButtonLoop().clear();
    DriverStationSim.setDsAttached(true);
    DriverStationSim.setEnabled(true);
    DriverStationSim.notifyNewData();
  }

  @After public void close() {
    scheduler.cancelAll();
    scheduler.getDefaultButtonLoop().clear();
    DriverStationSim.resetData();
  }

  @Test public void functionsRunOnceOnEachEdge() {
    var held = new AtomicBoolean();
    int[] edges = new int[2];
    ButtonBindings.bindFunctions(new Trigger(held::get), () -> edges[0]++, () -> edges[1]++);
    scheduler.run();
    assertArrayEquals(new int[] {0, 0}, edges);
    held.set(true);
    scheduler.run(); scheduler.run();
    assertArrayEquals(new int[] {1, 0}, edges);
    held.set(false);
    scheduler.run(); scheduler.run();
    assertArrayEquals(new int[] {1, 1}, edges);
  }

  @Test public void stateButtonsKeepDistinctStableOwnersAcrossPressesAndReleases() {
    var left = new AtomicBoolean();
    var right = new AtomicBoolean();
    Map<Object, String> requests = new HashMap<>();
    ButtonBindings.bindStates(new Trigger(left::get), "INTAKING", "IDLE",
        (state, owner) -> requests.put(owner, state));
    ButtonBindings.bindStates(new Trigger(right::get), "SHOOTING", "IDLE",
        (state, owner) -> requests.put(owner, state));
    left.set(true); scheduler.run();
    Object leftOwner = requests.keySet().iterator().next();
    right.set(true); scheduler.run();
    assertEquals(2, requests.size());
    assertTrue(requests.containsValue("SHOOTING"));
    left.set(false); scheduler.run();
    assertEquals("IDLE", requests.get(leftOwner));
    assertTrue(requests.containsValue("SHOOTING"));
    left.set(true); scheduler.run();
    assertEquals(2, requests.size());
    assertEquals("INTAKING", requests.get(leftOwner));
    right.set(false); scheduler.run();
    assertTrue(requests.containsValue("INTAKING"));
    assertTrue(requests.containsValue("IDLE"));
  }

  @Test public void pressOnlyCanRunWhileDisabledWithoutAddingAReleaseAction() {
    DriverStationSim.setEnabled(false);
    DriverStationSim.notifyNewData();
    var held = new AtomicBoolean();
    int[] actions = new int[3];
    ButtonBindings.bindFunctions(new Trigger(held::get), () -> actions[0]++, true);
    ButtonBindings.bindFunctions(new Trigger(held::get), () -> actions[1]++, () -> actions[2]++);
    held.set(true); scheduler.run(); scheduler.run();
    assertArrayEquals(new int[] {1, 0, 0}, actions);
    held.set(false); scheduler.run();
    assertArrayEquals(new int[] {1, 0, 0}, actions);
    held.set(true); scheduler.run();
    assertArrayEquals(new int[] {2, 0, 0}, actions);
  }
}
