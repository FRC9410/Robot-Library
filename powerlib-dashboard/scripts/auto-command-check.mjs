import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";

/** Run the emitted Java with real WPILib scheduling and only hardware-owning robot classes replaced. */
export async function checkGeneratedCommands({ fixture, root, classes, jars, javaHome, states, autoName, native }) {
  const directory = path.join(fixture, "behavior");
  const source = path.join(directory, "src"); const output = path.join(directory, "classes");
  await fs.mkdir(output, { recursive: true });
  const write = async (relative, contents) => {
    const file = path.join(source, relative); await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, contents); return file;
  };
  const inputs = [];
  inputs.push(await write("frc/robot/subsystems/Swerve.java", `package frc.robot.subsystems;
public class Swerve extends edu.wpi.first.wpilibj2.command.SubsystemBase {
  public int seeds;
  public void resetPose(edu.wpi.first.math.geometry.Pose2d pose) { seeds++; }
}`));
  inputs.push(await write("frc/robot/subsystems/StateMachine.java", `package frc.robot.subsystems;
public class StateMachine extends edu.wpi.first.wpilibj2.command.SubsystemBase {
  public enum RobotState { ${states.join(", ")} }
  public final Swerve drivetrain = new Swerve();
  public final java.util.Map<Object, RobotState> requests = new java.util.IdentityHashMap<>();
  public RobotState actual;
  public int cleanups;
  public void requestState(RobotState state, Object owner) { requests.put(owner, state); }
  public void clearRequest(Object owner) { requests.remove(owner); cleanups++; }
  public RobotState getActualState() { return actual; }
}`));
  inputs.push(await write("frc/robot/commands/DriveToPose.java", `package frc.robot.commands;
public class DriveToPose extends edu.wpi.first.wpilibj2.command.Command {
  public static boolean allowFinish = true;
  public static int completed;
  private final java.util.List<Runnable> actions = new java.util.ArrayList<>();
  private boolean done;
  public DriveToPose(frc.robot.subsystems.Swerve drive, edu.wpi.first.math.geometry.Pose2d pose, frc.powerlib.auto.DriveConstraints constraints) { addRequirements(drive); }
  public DriveToPose atProgress(double progress, Runnable action) { actions.add(action); return this; }
  public DriveToPose withHeadingTolerance(edu.wpi.first.math.geometry.Rotation2d tolerance) { return this; }
  @Override public void initialize() { done = false; }
  @Override public void execute() { if (!done && allowFinish) { actions.forEach(Runnable::run); done = true; completed++; } }
  @Override public boolean isFinished() { return done; }
}`));
  const generated = path.join(root, "src/main/java/frc/robot/autos/GeneratedAutos.java");
  inputs.push(generated);
  inputs.push(await write("frc/robot/autos/GeneratedAutosCheck.java", `package frc.robot.autos;
import edu.wpi.first.hal.HAL;
import edu.wpi.first.wpilibj.simulation.DriverStationSim;
import edu.wpi.first.wpilibj.simulation.SimHooks;
import edu.wpi.first.wpilibj2.command.Command;
import edu.wpi.first.wpilibj2.command.CommandScheduler;
import frc.powerlib.auto.AutoBuilder;
import frc.robot.subsystems.StateMachine;
public class GeneratedAutosCheck {
  private static void check(boolean valid, String message) { if (!valid) throw new AssertionError(message); }
  private static void tick() { CommandScheduler.getInstance().run(); SimHooks.stepTiming(0.02); }
  private static void waitForRequest(StateMachine robot) {
    for (int i=0;i<30 && robot.requests.isEmpty();i++) tick();
    check(!robot.requests.isEmpty(), "Generated state request ran");
  }
  public static void main(String[] ignored) {
    check(HAL.initialize(500, 0), "HAL initialized"); SimHooks.pauseTiming();
    DriverStationSim.setDsAttached(true); DriverStationSim.setEnabled(true); DriverStationSim.notifyNewData();
    var robot = new StateMachine();
    try (var builder = new AutoBuilder()) {
      GeneratedAutos.register(builder, robot); builder.publish();
      var chooser = edu.wpi.first.networktables.NetworkTableInstance.getDefault().getTable("SmartDashboard/Auto Chooser");
      check(chooser.getEntry("default").getString("").equals("None"), "No generated routine is the default");
      Command none = builder.getAutonomousCommand(); CommandScheduler.getInstance().schedule(none); tick();
      check(robot.requests.isEmpty() && robot.drivetrain.seeds==0, "No selection runs no auto");
      chooser.getEntry("selected").setString(${JSON.stringify(autoName)});
      frc.robot.commands.DriveToPose.allowFinish = false;
      Command first = builder.getAutonomousCommand(); CommandScheduler.getInstance().schedule(first);
      for(int i=0;i<5;i++) tick();
      check(first.isScheduled() && robot.requests.isEmpty(), "Point actions do not execute before arrival");
      frc.robot.commands.DriveToPose.allowFinish = true;
      waitForRequest(robot);
      check(frc.robot.commands.DriveToPose.completed==2, "Point request runs only after its drive finishes");
      for(int i=0;i<5;i++) tick();
      check(first.isScheduled(), "Wait-for-state does not finish on a request alone");
      robot.actual = robot.requests.values().iterator().next();
      Object otherOwner = new Object(); robot.requestState(robot.actual, otherOwner);
      for(int i=0;i<150 && first.isScheduled();i++) tick();
      check(!first.isScheduled(), "Generated auto finishes after actual state and timed wait");
      check(robot.requests.size()==1 && robot.requests.containsKey(otherOwner), "Normal completion clears only the auto's request");
      robot.clearRequest(otherOwner);
      check(robot.drivetrain.seeds==1, "Simulation start pose is seeded once per run");
      Command second = builder.getAutonomousCommand(); check(first!=second, "Every run gets fresh commands");
      CommandScheduler.getInstance().schedule(second); waitForRequest(robot);
      robot.requestState(robot.actual, otherOwner);
      int before = robot.cleanups; second.cancel();
      check(robot.requests.size()==1 && robot.requests.containsKey(otherOwner) && robot.cleanups>before, "Cancellation clears only the auto's request");
      robot.clearRequest(otherOwner);
      robot.actual = null;
      Command third = builder.getAutonomousCommand(); CommandScheduler.getInstance().schedule(third);
      for(int i=0;i<150 && third.isScheduled();i++) tick();
      check(third.isScheduled(), "State wait stays active beyond the previously configured timeout");
      robot.actual = robot.requests.values().iterator().next();
      for(int i=0;i<150 && third.isScheduled();i++) tick();
      check(!third.isScheduled(), "State wait releases only when actual state is reached");
      check(robot.requests.isEmpty(), "Completion clears requests");
      check(robot.drivetrain.seeds==3, "Repeated runs seed their own simulation start");
      frc.robot.commands.DriveToPose.allowFinish = false;
      Command fourth = builder.getAutonomousCommand(); CommandScheduler.getInstance().schedule(fourth);
      for(int i=0;i<5;i++) tick(); fourth.cancel();
      check(robot.requests.isEmpty(), "Cancellation before arrival never executes point state actions");
    } finally { SimHooks.resumeTiming(); }
    System.out.println("Generated command behavior passed: request/actual state separation, indefinite state waits, normal/cancel cleanup, fresh factories, and simulation start.");
  }
}`));
  const classpath = [classes, ...jars].join(path.delimiter);
  const args = path.join(directory, "javac.args");
  await fs.writeFile(args, ["-encoding", "UTF-8", "-cp", classpath, "-d", output, ...inputs]
    .map(value => JSON.stringify(value.replaceAll("\\", "/"))).join("\n"));
  const compile = spawnSync(path.join(javaHome, "bin", "javac.exe"), [`@${args}`], { encoding: "utf8" });
  assert.equal(compile.status, 0, compile.stderr || compile.error?.message);
  const run = spawnSync(path.join(javaHome, "bin", "java.exe"), [`-Djava.library.path=${native}`, "-cp",
    [output, classes, ...jars].join(path.delimiter), "frc.robot.autos.GeneratedAutosCheck"], { encoding: "utf8", timeout: 20000 });
  assert.equal(run.status, 0, run.stdout + run.stderr + (run.error?.message ?? ""));
  process.stdout.write(run.stdout);
}
