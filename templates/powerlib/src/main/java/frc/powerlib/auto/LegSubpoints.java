package frc.powerlib.auto;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * Actions that run once while a drive leg is underway, such as state requests.
 *
 * <p>Each action runs as soon as the leg's progress reaches its fraction (0 to 1). Any action not
 * yet run when the leg finishes runs then, so loose end tolerances never skip one. Actions with the
 * same progress run in the order they were added.
 */
public final class LegSubpoints {
  private record Subpoint(double progress, Runnable action) {}

  private final List<Subpoint> subpoints = new ArrayList<>();
  private int next;

  public void add(double progress, Runnable action) {
    if (!Double.isFinite(progress) || progress < 0 || progress > 1) {
      throw new IllegalArgumentException("Subpoint progress must be between 0 and 1.");
    }
    subpoints.add(new Subpoint(progress, Objects.requireNonNull(action, "Subpoint action must not be null.")));
    subpoints.sort(Comparator.comparingDouble(Subpoint::progress));
  }

  public boolean isEmpty() { return subpoints.isEmpty(); }

  /** Start a new run of the leg; every action may run again. */
  public void reset() { next = 0; }

  /** Runs every action whose progress has been reached. */
  public void update(double progress) {
    while (next < subpoints.size() && subpoints.get(next).progress() <= progress) {
      subpoints.get(next++).action().run();
    }
  }

  /** Runs the remaining actions; call when the leg finishes normally. */
  public void finish() { update(1); }
}
