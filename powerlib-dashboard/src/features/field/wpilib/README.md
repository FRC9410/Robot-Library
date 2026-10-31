# WPILib field definitions

These files are unmodified copies of WPILib's official welded-perimeter field definitions from
[`fields/src/main/native/resources/org/wpilib/fields/frc`](https://github.com/wpilibsuite/allwpilib/tree/c610ffd17fb144e7348af48caad7f3944a7765b6/fields/src/main/native/resources/org/wpilib/fields/frc)
at allwpilib commit `c610ffd17fb144e7348af48caad7f3944a7765b6` (BSD license, FIRST and WPILib contributors).

Each JSON file holds the field image's calibrated corner pixels (`field-image`), the field size in meters
(`field-dimensions`) and the official AprilTag layout (`field-tags`). These are the same layouts robot code
loads with `AprilTagFields` (for example `k2026RebuiltWelded`). Power Tool maps the corner pixels onto the
blue-origin field so poses, auto points and tags line up with the drawing. Only welded fields are included;
they match FIRST's official drawings and Championship fields, and AndyMark fields differ by about 2 cm.

The 2026 image is drawn from the scoring table side with the red alliance on the left, like FIRST's
FE-2026 drawings. Power Tool turns it 180° about the field center for the blue-origin view, which
`npm run check:fields` confirms leaves every tag on a symmetric partner. The 2025 image is drawn as
published.

The simplified 2026 drawing (`../rebuiltDrawing.ts`) uses FIRST's 2026 Game Manual section 5 and Field
Dimension Drawings FE-2026 rev B. `npm run check:fields` checks its hubs, trenches, towers and outposts
against the AprilTag layout here.

To update, replace these files with newer copies from WPILib and run `npm run check:fields`.
