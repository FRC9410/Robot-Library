# MapleSimSwerveDrivetrain Template Reference

## IMPORTANT: This is NOT a library class

`MapleSimSwerveDrivetrain` does not exist in the MapleSim vendordep. It is a project-local
utility class that must be physically copied into the robot project.

Source: https://github.com/Shenzhen-Robotics-Alliance/CTRE-Swerve-MapleSim

Place the file at:
`src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java`

---

## Required Fix to the Template

The official template hardcodes the initial sim spawn pose as `new Pose2d()` which places
the robot at (0, 0) — outside the field boundary. Change this line:

```java
// WRONG — robot spawns outside the field
.withStartingPose(new Pose2d())
```

To:
```java
// CORRECT — robot spawns at center of blue alliance half
.withStartingPose(new Pose2d(2.0, 4.025, new Rotation2d(0)))
```

---

## How to Get the File

In Claude Code, fetch the source directly:

```bash
curl -o src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java \
  https://raw.githubusercontent.com/Shenzhen-Robotics-Alliance/CTRE-Swerve-MapleSim/main/src/main/java/frc/robot/utils/simulation/MapleSimSwerveDrivetrain.java
```

Then apply the starting pose fix described above.

---

## Package Declaration

Make sure the package at the top of the file matches the project:

```java
package frc.robot.utils.simulation;
```

---

## To Update in the Future

To get the latest version:
1. Fetch the updated file from the CTRE-Swerve-MapleSim repo
2. Re-apply the starting pose fix
3. Run `./gradlew build` to verify
