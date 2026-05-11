package frc.powerlib.subsystems;

import edu.wpi.first.wpilibj.RobotBase;
import frc.powerlib.configs.VelocitySubsystemConfig;
import frc.powerlib.subsystems.io.VelocitySubsystemIO;
import frc.powerlib.subsystems.io.VelocitySubsystemIOSim;
import frc.powerlib.subsystems.io.VelocityTorqueSubsystemIOReal;

public class VelocityTorqueSubsystem extends VelocitySubsystem {
  public VelocityTorqueSubsystem(VelocitySubsystemConfig config) {
    super(config);
  }

  public VelocityTorqueSubsystem(VelocitySubsystemConfig config, VelocitySubsystemIO io) {
    super(config, io);
  }

  @Override
  protected VelocitySubsystemIO createDefaultIO() {
    return RobotBase.isSimulation() ? new VelocitySubsystemIOSim() : new VelocityTorqueSubsystemIOReal(this);
  }
}
