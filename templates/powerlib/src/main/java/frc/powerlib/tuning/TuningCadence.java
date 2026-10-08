package frc.powerlib.tuning;

import edu.wpi.first.wpilibj.Timer;

/** Limits tuning work to 5 Hz without slowing the mechanism's control or feedback loop. */
public final class TuningCadence {
  public static final double INTERVAL_SECONDS = 0.2;
  private double nextUpdate;

  public boolean isDue() {
    return isDue(Timer.getFPGATimestamp());
  }

  public boolean isDue(double now) {
    if (now + 1.0e-9 < nextUpdate) return false;
    nextUpdate = now + INTERVAL_SECONDS;
    return true;
  }
}
