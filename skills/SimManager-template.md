# SimManager.java Template

Use researched or user-provided game piece values to fill this template. When a season year is
provided, record source URLs in `sim-config.md` for dimensions, mass, and spawn positions.

## Critical API Corrections

1. `GamePieceInfo` is a nested record inside `GamePieceOnFieldSimulation`.
   Import: `import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation.GamePieceInfo;`
2. Shape is a dyn4j `Convex` object:
   - Cylinder: `new Circle(Inches.of(radius).in(Meters))`
   - Box: `new Rectangle(Inches.of(length).in(Meters), Inches.of(width).in(Meters))`
3. `gamePieceHeight` is a `Distance`. Use `Inches.of(...)` or `Meters.of(...)`, not `.in(Meters)`.
4. `getGamePiecesArrayByType()` returns `Pose3d[]`. Use `StructArrayPublisher<Pose3d>`.
5. Do not add `SimManager.update()`. Physics runs in `Robot.simulationPeriodic()` through the drivetrain wrapper.

## Full File Template

```java
package frc.robot.utils.simulation;

import static edu.wpi.first.units.Units.*;

import edu.wpi.first.math.geometry.Pose2d;
import edu.wpi.first.math.geometry.Pose3d;
import edu.wpi.first.math.geometry.Rotation2d;
import edu.wpi.first.networktables.NetworkTableInstance;
import edu.wpi.first.networktables.StructArrayPublisher;
import org.dyn4j.geometry.Circle;
import org.dyn4j.geometry.Rectangle;
import org.ironmaple.simulation.SimulatedArena;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation;
import org.ironmaple.simulation.gamepieces.GamePieceOnFieldSimulation.GamePieceInfo;

public class SimManager {
  {{GAME_PIECE_TYPE_CONSTANTS}}

  {{GAME_PIECE_INFO_CONSTANTS}}

  {{GAME_PIECE_PUBLISHERS}}

  private SimManager() {}

  public static void initialize() {
    {{INIT_PUBLISHERS}}
    SimulatedArena.getInstance().resetFieldForAuto();
    spawnGamePieces();
  }

  public static void resetField() {
    SimulatedArena.getInstance().resetFieldForAuto();
    spawnGamePieces();
  }

  public static void publishPoses() {
    {{PUBLISH_POSES_BODY}}
  }

  private static void spawnGamePieces() {
    {{SPAWN_GAME_PIECES_BODY}}
  }
}
```

## Examples

Type constant:

```java
private static final String BALL_TYPE = "Ball";
```

Cylinder game piece:

```java
private static final GamePieceInfo BALL_INFO =
    new GamePieceInfo(
        BALL_TYPE,
        new Circle(Inches.of(3.0).in(Meters)),
        Inches.of(6.0),
        Kilograms.of(0.227),
        0.8,
        0.8,
        0.3);
```

Box game piece:

```java
private static final GamePieceInfo CORAL_INFO =
    new GamePieceInfo(
        CORAL_TYPE,
        new Rectangle(Inches.of(12.0).in(Meters), Inches.of(8.0).in(Meters)),
        Inches.of(6.0),
        Kilograms.of(0.18),
        0.8,
        0.8,
        0.3);
```

Publisher:

```java
private static StructArrayPublisher<Pose3d> ballPosesPublisher;
```

Initialize publisher:

```java
ballPosesPublisher =
    NetworkTableInstance.getDefault()
        .getStructArrayTopic("Simulation/BallPoses", Pose3d.struct)
        .publish();
```

Publish poses:

```java
if (ballPosesPublisher != null) {
  ballPosesPublisher.set(SimulatedArena.getInstance().getGamePiecesArrayByType(BALL_TYPE));
}
```

Spawn pieces:

```java
SimulatedArena.getInstance()
    .addGamePiece(new GamePieceOnFieldSimulation(BALL_INFO, new Pose2d(2.0, 2.5, new Rotation2d())));
SimulatedArena.getInstance()
    .addGamePiece(new GamePieceOnFieldSimulation(BALL_INFO, new Pose2d(2.0, 5.5, new Rotation2d())));
```
