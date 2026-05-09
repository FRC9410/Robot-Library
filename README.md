# Robot-Library

Gradle plugin for installing Team 9410 robot project conventions and shared library files.

## Install from GitHub

Push this repository to GitHub, then create a Git tag that matches the library version in `build.gradle`:

```powershell
git tag 0.1.0
git push origin main --tags
```

In a robot project's `settings.gradle`, add a source dependency mapping. Replace the URL with your GitHub repository URL:

```gradle
sourceControl {
    gitRepository('https://github.com/YOUR_GITHUB_USERNAME/Robot-Library.git') {
        producesModule('org.team9410:robot-library')
    }
}
```

In the robot project's `build.gradle`, add the plugin to the buildscript classpath and apply it:

```gradle
buildscript {
    dependencies {
        classpath 'org.team9410:robot-library:0.1.0'
    }
}

apply plugin: 'org.team9410.robot-library'
```

Then run:

```powershell
.\gradlew installRobotLibrary
```

For now, the install task creates `src/main/java/frc/powerlib`.
