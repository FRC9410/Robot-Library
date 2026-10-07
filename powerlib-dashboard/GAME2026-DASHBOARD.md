# 2026 game dashboard

The 2026 Game tab uses the existing dashboard shell and NT4 connection. Drive, Robot, Tuning, Subsystems, Constants and NetworkTables remain available. The layout follows the supplied reference: mode/hub clocks, battery and robot state; field and three camera views; autonomous chooser and shot checklist; drivetrain and six mechanism tiles; status footer.

Installed Electron reads `power-tool/generated/powerlib-game-2026.json` for field dimensions, hub positions and route previews. The bundled template contains the verified pre-May-1 reference; Crew tools reports missing/invalid project JSON. Route previews use the robot-acknowledged chooser selection. They never reset odometry or execute an auto. The field illustration is a schematic drawn in the configured blue-origin coordinate frame.

Only `/SmartDashboard/Auto Chooser` is used for autonomous selection. Options and alliance filtering come from PowerLib AutoBuilder. Selection is available only with fresh Drive telemetry reporting Disabled, waits for the robot's `active` acknowledgment, and reports timeout/failure. No routine names are invented by the live dashboard.

Drive telemetry uses the existing drive template. Game topics live under `/PowerLib/Subsystems/Game2026/Data`: `Heartbeat`, `State`, `ShotRequested`, `FeedReady`, `VelocityReady`, `HoodReady`, `Aligned`, `CalibratedRange`, `Target`, `HeadingError`, `HubDistance`, `VisionAccepted`, `AutoStatus`, `AutoReason`, `ShotStatus`. The rewrite publishes readiness from the same controller decisions that gate feeding. A fresh Game2026 heartbeat and fresh Drive heartbeat are both required. Missing/stale values show a dash or unknown, never a fabricated ready state. Readiness rows are inactive unless a shot is requested. Fresh accepted vision frames do not imply that the robot has been pose-seeded.

Optional `HubActive` and `HubTimeSeconds` remain unknown unless the robot supplies them. No match-shift activation algorithm is inferred. Mechanism metrics use PowerLib `Data/Velocity`, `Data/Position`, and `Data/Connected`. Position values are displayed in rotations, matching the actual IO despite the legacy units metadata. Meters indicate magnitude relative to display scales, not percent readiness or remaining travel.

Camera streams use discovered CameraPublisher/explicit Limelight topics. Crew tools supports saved HTTP/HTTPS stream overrides for left/right/turret, retry, display-only field flip and JSON snapshot export. Unsupported cameras stay Offline. Settings are local to the laptop and do not change robot calibration.

For a fixture-only local preview, start Vite and open `http://127.0.0.1:5174/?preview=2026` (use the port Vite reports). Preview is development-only, is visibly labeled, prevents the app's NT4 connection, and never publishes autonomous selections. Production builds use real telemetry. Run `npm run check:game`, `npm run check:drive`, and the standard renderer/Electron build to verify the template.
