package frc.powerlib.subsystems;

import static org.junit.Assert.*;
import com.ctre.phoenix6.StatusCode;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.Test;

public class ConfigurationQueueTest {
  @Test public void configurationRunsOffCallerAndCoalescesToLatestRequest() {
    var jobs = new ArrayList<Runnable>(); var writes = new ArrayList<String>();
    var queue = new ConfigurationQueue(jobs::add, () -> 0, error -> fail(error));
    assertFalse(queue.request("motor/gains", "one", () -> { writes.add("one"); return StatusCode.OK; }));
    assertFalse(queue.request("motor/gains", "two", () -> { writes.add("two"); return StatusCode.OK; }));
    assertTrue(writes.isEmpty()); assertEquals(1, jobs.size());
    jobs.remove(0).run(); assertEquals(List.of("two"), writes);
    assertTrue(queue.pending("motor/gains"));
    assertTrue(queue.request("motor/gains", "two", () -> { fail("Repeated write"); return StatusCode.OK; }));
    assertFalse(queue.pending("motor/gains"));
  }
  @Test public void failureDoesNotAcknowledgeAndRetriesAreBounded() {
    var jobs = new ArrayList<Runnable>(); var errors = new ArrayList<String>(); var now = new AtomicLong();
    var queue = new ConfigurationQueue(jobs::add, now::get, errors::add);
    queue.request("gain", "one", () -> { throw new IllegalStateException("disconnected"); });
    jobs.remove(0).run(); assertEquals(1, errors.size()); assertTrue(queue.pending("gain"));
    assertFalse(queue.request("gain", "one", () -> StatusCode.OK)); assertTrue(jobs.isEmpty());
    now.set(500_000_000); queue.request("gain", "one", () -> StatusCode.OK);
    assertEquals(1, jobs.size()); jobs.remove(0).run();
    assertTrue(queue.request("gain", "one", () -> StatusCode.OK));
  }
  @Test public void revertingBeforeAcknowledgementRestoresOldHardwareSettings() {
    var jobs = new ArrayList<Runnable>(); var writes = new ArrayList<String>();
    var queue = new ConfigurationQueue(jobs::add, () -> 0, error -> fail(error));
    queue.request("gain", "old", () -> { writes.add("old"); return StatusCode.OK; });
    jobs.remove(0).run(); assertTrue(queue.request("gain", "old", () -> StatusCode.OK));
    queue.request("gain", "new", () -> { writes.add("new"); return StatusCode.OK; });
    jobs.remove(0).run(); assertTrue(queue.pending("gain"));
    assertFalse(queue.request("gain", "old", () -> { writes.add("old"); return StatusCode.OK; }));
    jobs.remove(0).run(); assertEquals(List.of("old", "new", "old"), writes);
    assertTrue(queue.request("gain", "old", () -> StatusCode.OK));
  }
}
