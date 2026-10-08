package frc.powerlib.tuning;

import static org.junit.Assert.*;
import org.junit.Test;

public class TuningCadenceTest {
  @Test public void fiftyRobotLoopsPerformFiveTuningUpdates() {
    var cadence = new TuningCadence();
    int updates = 0;
    for (int loop = 0; loop < 50; loop++) {
      if (cadence.isDue(loop * 0.02)) updates++;
    }
    assertEquals(5, updates);
  }

  @Test public void repeatedCallsDoNotRunExtraWorkAndMissedUpdatesDoNotBurst() {
    var cadence = new TuningCadence();
    assertTrue(cadence.isDue(0));
    assertFalse(cadence.isDue(0));
    assertFalse(cadence.isDue(0.199));
    assertTrue(cadence.isDue(0.2));
    assertTrue(cadence.isDue(5));
    assertFalse(cadence.isDue(5));
    assertFalse(cadence.isDue(5.19));
    assertTrue(cadence.isDue(5.2));
  }
}
