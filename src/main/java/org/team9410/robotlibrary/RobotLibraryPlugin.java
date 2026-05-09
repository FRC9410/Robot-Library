package org.team9410.robotlibrary;

import org.gradle.api.Plugin;
import org.gradle.api.Project;

public class RobotLibraryPlugin implements Plugin<Project> {
    @Override
    public void apply(Project project) {
        project.getTasks().register("installRobotLibrary", task -> {
            task.setGroup("robot library");
            task.setDescription("Installs Team 9410 robot library files into this robot project.");

            task.doLast(action -> {
                project.mkdir(project.file("src/main/java/frc/9410lib"));
            });
        });
    }
}
