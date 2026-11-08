package frc.powerlib.auto;

import static org.junit.Assert.*;
import edu.wpi.first.math.geometry.Translation2d;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public class LegSubpointsTest {
  @Test public void runsEachActionOnceInProgressOrder() {
    List<String> events = new ArrayList<>();
    var subpoints = new LegSubpoints();
    subpoints.add(0.75, () -> events.add("late"));
    subpoints.add(0.25, () -> events.add("early"));
    subpoints.add(0.25, () -> events.add("early second"));
    subpoints.update(0.1);
    assertEquals(List.of(), events);
    subpoints.update(0.5);
    assertEquals(List.of("early", "early second"), events);
    subpoints.update(0.6);
    assertEquals(2, events.size());
    subpoints.update(1);
    assertEquals(List.of("early", "early second", "late"), events);
  }

  @Test public void finishRunsWhatTheLegSkipped() {
    List<String> events = new ArrayList<>();
    var subpoints = new LegSubpoints();
    subpoints.add(0.9, () -> events.add("intake"));
    subpoints.update(0.6);
    subpoints.finish();
    subpoints.finish();
    assertEquals(List.of("intake"), events);
  }

  @Test public void resetAllowsANewRun() {
    List<String> events = new ArrayList<>();
    var subpoints = new LegSubpoints();
    subpoints.add(0, () -> events.add("start"));
    subpoints.update(0);
    subpoints.reset();
    subpoints.update(0);
    assertEquals(List.of("start", "start"), events);
  }

  @Test public void rejectsProgressOutsideTheLeg() {
    var subpoints = new LegSubpoints();
    assertThrows(IllegalArgumentException.class, () -> subpoints.add(-0.1, () -> {}));
    assertThrows(IllegalArgumentException.class, () -> subpoints.add(1.1, () -> {}));
    assertThrows(IllegalArgumentException.class, () -> subpoints.add(Double.NaN, () -> {}));
    assertThrows(NullPointerException.class, () -> subpoints.add(0.5, null));
    assertTrue(subpoints.isEmpty());
  }

  @Test public void progressProjectsOntoTheLeg() {
    Translation2d start = new Translation2d(1, 1);
    Translation2d target = new Translation2d(5, 1);
    assertEquals(0, DriveToPoseController.progress(start, start, target), 1e-9);
    assertEquals(0.5, DriveToPoseController.progress(start, new Translation2d(3, 2), target), 1e-9);
    assertEquals(1, DriveToPoseController.progress(start, new Translation2d(7, 1), target), 1e-9);
    assertEquals(0, DriveToPoseController.progress(start, new Translation2d(0, 1), target), 1e-9);
    assertEquals(1, DriveToPoseController.progress(target, target, target), 1e-9);
  }
}
