package frc.powerlib.subsystems.io;

import edu.wpi.first.math.system.plant.DCMotor;

/** Deterministic 20 ms mechanism model for control/readiness tests, not a calibrated digital twin. */
final class MechanismSimulation {
  private static final double DT = 0.02;
  private enum Mode { POSITION, VELOCITY, VOLTAGE }
  private final double freeSpeed;
  private Mode mode = Mode.VOLTAGE;
  private double target, volts, velocityLimit, accelerationLimit;
  double position, velocity;

  MechanismSimulation(double ratio, double cruiseVelocity, double acceleration) {
    freeSpeed = DCMotor.getKrakenX60(1).freeSpeedRadPerSec / (2 * Math.PI * Math.max(1e-9, Math.abs(ratio)));
    profile(cruiseVelocity, acceleration);
  }
  void profile(double cruiseVelocity, double acceleration) {
    velocityLimit = cruiseVelocity > 0 ? Math.min(cruiseVelocity, freeSpeed) : freeSpeed;
    accelerationLimit = acceleration > 0 ? acceleration : freeSpeed / 0.1;
  }
  void position(double target) { this.target = target; mode = Mode.POSITION; }
  void velocity(double target) { this.target = target; mode = Mode.VELOCITY; }
  void voltage(double volts) { this.volts = Math.max(-12, Math.min(12, volts)); mode = Mode.VOLTAGE; }
  void reset(double position) { this.position = position; velocity = 0; target = position; }
  void update() {
    double error = target - position;
    double desired = switch (mode) {
      case VOLTAGE -> volts / 12 * freeSpeed;
      case VELOCITY -> Math.max(-freeSpeed, Math.min(freeSpeed, target));
      case POSITION -> Math.copySign(Math.min(velocityLimit, Math.sqrt(2 * accelerationLimit * Math.abs(error))), error);
    };
    double change = (desired - velocity) * DT / 0.1;
    double limit = mode == Mode.VOLTAGE ? freeSpeed * DT / 0.1 : accelerationLimit * DT;
    velocity += Math.max(-limit, Math.min(limit, change));
    double movement = velocity * DT;
    if (mode == Mode.POSITION && Math.abs(movement) >= Math.abs(error) && Math.signum(movement) == Math.signum(error)) {
      position = target; velocity = 0;
    } else position += movement;
  }
  void limits(double minimum, double maximum) {
    position = Math.max(minimum, Math.min(maximum, position));
    if ((position <= minimum && velocity < 0) || (position >= maximum && velocity > 0)) velocity = 0;
  }
}
