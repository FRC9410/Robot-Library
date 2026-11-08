package frc.powerlib.characterization;

import edu.wpi.first.util.datalog.DataLogWriter;
import edu.wpi.first.util.datalog.DoubleLogEntry;
import edu.wpi.first.wpilibj.RobotBase;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

/** One closed, self-contained WPILOG per test; never downloads an unrelated Phoenix session. */
final class CharacterizationRecorder implements AutoCloseable {
  private final DataLogWriter log;
  private final List<CharacterizationTarget.Motor> motors;
  private final DoubleLogEntry[][] entries;
  final String file;
  CharacterizationRecorder(String id, List<CharacterizationTarget.Motor> motors) throws IOException {
    Path root = RobotBase.isSimulation() ? Path.of("logs")
        : Files.isDirectory(Path.of("/U")) ? Path.of("/U/logs") : Path.of("/home/lvuser/logs");
    Path folder = root.resolve("power-tool-characterization");
    Files.createDirectories(folder);
    file = folder.resolve(id + ".wpilog").toString().replace('\\', '/');
    log = new DataLogWriter(file);
    this.motors = motors;
    entries = new DoubleLogEntry[motors.size()][4];
    String[] fields = {"voltage", "position", "velocity", "current"};
    for (int i = 0; i < motors.size(); i++) for (int j = 0; j < fields.length; j++) {
      entries[i][j] = new DoubleLogEntry(log, "Characterization/" + i + "/" + fields[j]);
    }
  }
  void sample(long timestamp) {
    for (int i = 0; i < motors.size(); i++) {
      var motor = motors.get(i);
      entries[i][0].append(motor.voltage().getAsDouble(), timestamp);
      entries[i][1].append(motor.position().getAsDouble(), timestamp);
      entries[i][2].append(motor.velocity().getAsDouble(), timestamp);
      entries[i][3].append(motor.current().getAsDouble(), timestamp);
    }
  }
  @Override public void close() { log.flush(); log.close(); }
}
