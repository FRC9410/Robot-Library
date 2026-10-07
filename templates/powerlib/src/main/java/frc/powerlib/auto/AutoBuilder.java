package frc.powerlib.auto;

import edu.wpi.first.wpilibj.DriverStation;
import edu.wpi.first.wpilibj.DriverStation.Alliance;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.Commands;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import edu.wpi.first.wpilibj2.command.SubsystemBase;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.function.Supplier;

/** Publishes an autonomous chooser and builds a fresh command when autonomous starts. */
public final class AutoBuilder extends SubsystemBase implements AutoCloseable {
  public static final String DASHBOARD_KEY = "Auto Chooser";

  private final NTChooser<Supplier<Command>> chooser = new NTChooser<>("SmartDashboard/" + DASHBOARD_KEY);
  private record Routine(Supplier<Command> factory, Alliance alliance) {}

  private final Map<String, Routine> routines = new LinkedHashMap<>();
  private String defaultName = "None";
  private Optional<Alliance> displayedAlliance;
  private boolean optionsDirty = true;

  public AutoBuilder() {
    routines.put("None", new Routine(Commands::none, null));
    refreshOptions();
  }

  /** Register a factory, rather than a shared command instance or command group. */
  public AutoBuilder addAuto(String name, Supplier<Command> factory) {
    register(name, factory, null);
    return this;
  }

  /** Register a routine available only when WPILib reports the specified alliance. */
  public AutoBuilder addAuto(String name, Alliance alliance, Supplier<Command> factory) {
    register(name, factory, Objects.requireNonNull(alliance, "Alliance must not be null."));
    return this;
  }

  /** Replace the initial None default with a named autonomous routine. */
  public AutoBuilder setDefaultAuto(String name, Supplier<Command> factory) {
    register(name, factory, null);
    defaultName = name;
    optionsDirty = true;
    return this;
  }

  /** Use this default only for its alliance; otherwise the default is None. */
  public AutoBuilder setDefaultAuto(String name, Alliance alliance, Supplier<Command> factory) {
    register(name, factory, Objects.requireNonNull(alliance, "Alliance must not be null."));
    defaultName = name;
    optionsDirty = true;
    return this;
  }

  private void register(String name, Supplier<Command> factory, Alliance alliance) {
    if (name == null || name.isBlank()) {
      throw new IllegalArgumentException("Autonomous name must not be blank.");
    }
    Objects.requireNonNull(factory, "Autonomous factory must not be null.");
    if (routines.containsKey(name)) {
      throw new IllegalArgumentException("Duplicate autonomous name: " + name);
    }
    routines.put(name, new Routine(factory, alliance));
    optionsDirty = true;
  }

  private void refreshOptions() {
    Optional<Alliance> alliance = DriverStation.getAlliance();
    if (!optionsDirty && alliance.equals(displayedAlliance)) return;
    Map<String, Supplier<Command>> available = new LinkedHashMap<>();
    routines.forEach((name, routine) -> {
      if (routine.alliance() == null || alliance.filter(value -> value == routine.alliance()).isPresent()) {
        available.put(name, routine.factory());
      }
    });
    chooser.setOptions(available, available.containsKey(defaultName) ? defaultName : "None");
    displayedAlliance = alliance;
    optionsDirty = false;
  }

  /** Publish once after registering routines. Compatible with standard String Chooser widgets. */
  public void publish() {
    refreshOptions();
    chooser.publish();
  }

  @Override
  public void periodic() {
    refreshOptions();
    chooser.publishActive();
  }

  /** Call from RobotContainer.getAutonomousCommand(), once at autonomous initialization. */
  public Command getAutonomousCommand() {
    refreshOptions();
    chooser.publishActive();
    return Objects.requireNonNull(chooser.get().get(), "Autonomous factory returned null.");
  }

  @Override
  public void close() {
    CommandScheduler.getInstance().unregisterSubsystem(this);
    chooser.close();
  }
}
