package frc.powerlib.characterization;

import edu.wpi.first.wpilibj2.command.Subsystem;
import java.util.List;
import java.util.function.DoubleConsumer;
import java.util.function.DoubleSupplier;

record CharacterizationTarget(String id, String group, String name, String kind,
    Subsystem owner, DoubleConsumer voltage, Runnable stop, List<Motor> motors) {
  record Motor(String name, DoubleSupplier voltage, DoubleSupplier position,
      DoubleSupplier velocity, DoubleSupplier current) {}
}
