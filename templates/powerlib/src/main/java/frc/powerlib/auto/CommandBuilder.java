package frc.powerlib.auto;

import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.SequentialCommandGroup;
import edu.wpi.first.wpilibj2.command.Subsystem;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;

/** Builds sequential autonomous routines from factories so each build owns fresh commands. */
public final class CommandBuilder {
  private final List<Supplier<Command>> steps = new ArrayList<>();

  public CommandBuilder command(Supplier<Command> factory) {
    steps.add(Objects.requireNonNull(factory, "Command factory must not be null."));
    return this;
  }

  public CommandBuilder runOnce(Runnable action, Subsystem... requirements) {
    Objects.requireNonNull(action, "Action must not be null.");
    Subsystem[] ownedRequirements = requirements.clone();
    return command(() -> Commands.runOnce(action, ownedRequirements));
  }

  public CommandBuilder waitSeconds(double seconds) {
    if (!Double.isFinite(seconds) || seconds < 0) {
      throw new IllegalArgumentException("Wait duration must be a finite, non-negative number.");
    }
    return command(() -> Commands.waitSeconds(seconds));
  }

  public SequentialCommandGroup build() {
    Command[] commands = steps.stream()
        .map(factory -> Objects.requireNonNull(factory.get(), "Command factory returned null."))
        .toArray(Command[]::new);
    return new SequentialCommandGroup(commands);
  }
}
