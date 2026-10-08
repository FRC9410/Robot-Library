# Telemetry contract (schema version 1)

`/PowerLib/Data` is a complete JSON frame published every 100 ms. It contains
`schemaVersion: 1`, a nonnegative integer `sequence`, finite `timestampSeconds`,
and `subsystems`, a map of owner names to metric maps. Each new valid frame replaces
the preceding frame, including fields removed from the map.

Owner names must be nonblank and must not contain `/`. Metric keys must be
nonblank; `/` is permitted inside a metric key. Values are booleans, strings,
finite numbers, null, or poses with finite `xMeters`, `yMeters`, and
`headingRadians`. Java nonfinite numbers and invalid poses become null; other
objects use their string representation. `Drive/Pose` is reserved for a pose or
null. Pose objects at other metric paths use the same representation.

The dashboard rejects malformed whole frames without refreshing their timestamps
and shows a diagnostic until a valid frame arrives. Connection resets discard
both cached readings and diagnostics. The typed AdvantageScope Drive pose is
published from the same frame. SignalLogger writes cached telemetry every 20 ms,
independently of the NetworkTables publication interval.
