package frc.powerlib.subsystems;

import com.ctre.phoenix6.StatusCode;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.LongSupplier;
import java.util.function.Supplier;

/** Coalesces config changes off the control loop; success must be acknowledged by the caller. */
final class ConfigurationQueue {
  private static final Executor WORKER = Executors.newSingleThreadExecutor(action -> {
    Thread thread = new Thread(action, "PowerLib configuration");
    thread.setDaemon(true);
    return thread;
  });
  private static final long RETRY_NANOS = 500_000_000L;
  private static final class Change {
    String requested, applied, acknowledged;
    Supplier<StatusCode> write;
    boolean running;
    long retryAfter;
  }
  private final Map<String, Change> changes = new HashMap<>();
  private final Executor executor;
  private final LongSupplier clock;
  private final Consumer<String> report;

  ConfigurationQueue(Consumer<String> report) { this(WORKER, System::nanoTime, report); }
  ConfigurationQueue(Executor executor, LongSupplier clock, Consumer<String> report) {
    this.executor = executor; this.clock = clock; this.report = report;
  }

  synchronized boolean pending(String key) {
    Change change = changes.get(key);
    return change != null && (change.running || !Objects.equals(change.requested, change.acknowledged));
  }

  synchronized boolean request(String key, String signature, Supplier<StatusCode> write) {
    Change change = changes.computeIfAbsent(key, ignored -> new Change());
    boolean replaced = !Objects.equals(signature, change.requested);
    change.requested = signature;
    change.write = write;
    if (!change.running && Objects.equals(signature, change.applied)) {
      change.acknowledged = signature;
      return true;
    }
    if (!change.running && (replaced || clock.getAsLong() >= change.retryAfter)) {
      change.running = true;
      executor.execute(() -> apply(key, change));
    }
    return false;
  }

  private void apply(String key, Change change) {
    String signature; Supplier<StatusCode> write;
    synchronized (this) { signature = change.requested; write = change.write; }
    String failure = null;
    try {
      StatusCode status = write.get();
      if (!status.isOK()) failure = status.toString();
    } catch (RuntimeException exception) { failure = exception.toString(); }
    synchronized (this) {
      if (failure == null) change.applied = signature;
      else {
        change.applied = null; // A failed write may have applied only part of the group.
        change.retryAfter = clock.getAsLong() + RETRY_NANOS;
      }
      change.running = false;
    }
    if (failure != null) report.accept("PowerLib config " + key + " failed: " + failure);
  }
}
