package frc.powerlib.controls;

import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.Subsystem;
import edu.wpi.first.wpilibj2.command.button.Trigger;
import java.util.Objects;
import java.util.function.BiConsumer;

/** Paired press/release bindings. State bindings have a stable owner per button. */
public final class ButtonBindings {
  private ButtonBindings() {}

  public static void bindFunctions(Trigger button, Runnable onPress, Runnable onRelease,
      Subsystem... requirements) {
    Objects.requireNonNull(button);
    Objects.requireNonNull(onPress);
    Objects.requireNonNull(onRelease);
    bindFunctions(button, onPress, false, requirements);
    button.onFalse(Commands.runOnce(onRelease, requirements));
  }

  /** Press-only action; runWhenDisabled permits scheduling while the robot is disabled. */
  public static void bindFunctions(Trigger button, Runnable onPress, boolean runWhenDisabled,
      Subsystem... requirements) {
    Objects.requireNonNull(button);
    Objects.requireNonNull(onPress);
    button.onTrue(Commands.runOnce(onPress, requirements).ignoringDisable(runWhenDisabled));
  }

  public static <S> void bindStates(Trigger button, S onPress, S onRelease,
      BiConsumer<S, Object> requestState) {
    Objects.requireNonNull(onPress);
    Objects.requireNonNull(onRelease);
    Objects.requireNonNull(requestState);
    Object owner = new Object();
    bindFunctions(button, () -> requestState.accept(onPress, owner),
        () -> requestState.accept(onRelease, owner));
  }
}
