const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const CodexLogMonitor = require("../agents/codex-log-monitor");
const codexConfig = require("../agents/codex");

// Helper: create a temp session dir with today's date structure
function makeTempSessionDir() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-test-"));
  const now = new Date();
  const dateDir = path.join(
    tmpDir,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  );
  fs.mkdirSync(dateDir, { recursive: true });
  return { tmpDir, dateDir };
}

// Helper: create a config pointing to our temp dir
function makeConfig(tmpDir) {
  return {
    ...codexConfig,
    logConfig: {
      ...codexConfig.logConfig,
      sessionDir: tmpDir,
      pollIntervalMs: 100,
      recoverExistingFiles: false,
    },
  };
}

const TEST_FILENAME = "rollout-2026-03-25T15-10-51-019d23d4-f1a9-7633-b9c7-758327137228.jsonl";
const EXPECTED_SID = "codex:019d23d4-f1a9-7633-b9c7-758327137228";

describe("CodexLogMonitor", () => {
  let tmpDir, dateDir, monitor;

  beforeEach(() => {
    const dirs = makeTempSessionDir();
    tmpDir = dirs.tmpDir;
    dateDir = dirs.dateDir;
  });

  afterEach(() => {
    if (monitor) monitor.stop();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("should extract session ID from filename", () => {
    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, () => {});
    assert.strictEqual(monitor._extractSessionId(TEST_FILENAME), EXPECTED_SID.replace(/^codex:/, ""));
  });

  it("uses session_meta for metadata without emitting an idle transition", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, '{"type":"session_meta","payload":{"cwd":"/projects/foo"}}\n');

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state, event, extra) => {
      assert.strictEqual(state, "thinking");
      assert.strictEqual(extra.cwd, "/projects/foo");
      done();
    });
    monitor.start();
    setTimeout(() => {
      fs.appendFileSync(testFile, '{"type":"event_msg","payload":{"type":"task_started"}}\n');
    }, 150);
  });

  it("should map task_started to thinking", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state) => {
      assert.strictEqual(state, "thinking");
      done();
    });
    monitor.start();
  });

  it("should map function_call to working", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state) => {
      assert.strictEqual(state, "working");
      done();
    });
    monitor.start();
  });

  it("should map task_complete to idle when no tools were used", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state, event) => {
      assert.strictEqual(state, "idle");
      assert.strictEqual(event, "event_msg:task_complete");
      done();
    });
    monitor.start();
  });

  it("should map task_complete to attention when tools were used", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command","arguments":"{\\"command\\":\\"ls\\"}"}}',
      '{"type":"event_msg","payload":{"type":"exec_command_end"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (sid, state) => {
      states.push(state);
      if (state === "attention") {
        assert.deepStrictEqual(states, ["attention"]);
        done();
      }
    });
    monitor.start();
  });

  it("should count web searches as tool activity at task completion", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"web_search_call"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (sid, state) => {
      states.push(state);
      if (state === "attention") {
        assert.deepStrictEqual(states, ["attention"]);
        done();
      }
    });
    monitor.start();
  });

  it("should map turn_aborted to idle", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
      '{"type":"event_msg","payload":{"type":"turn_aborted"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state) => {
      assert.strictEqual(state, "idle");
      done();
    });
    monitor.start();
  });

  it("should refresh activity for repeated working states", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (sid, state) => {
      states.push(state);
      if (state === "attention") {
        assert.deepStrictEqual(states, ["thinking", "working", "working", "working", "attention"]);
        done();
      }
    });
    monitor.start();
    setTimeout(() => {
      fs.appendFileSync(testFile, [
        '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
        '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
        '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
        '{"type":"event_msg","payload":{"type":"task_complete"}}',
      ].join("\n") + "\n");
    }, 150);
  });

  it("should ignore Codex subagent rollouts", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      JSON.stringify({
        type: "session_meta",
        payload: { cwd: "/tmp", thread_source: "subagent", source: { subagent: {} } },
      }),
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (_sid, state) => states.push(state));
    monitor.start();

    setTimeout(() => {
      assert.deepStrictEqual(states, []);
      done();
    }, 300);
  });

  it("should recover only the final active state from existing logs", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"custom_tool_call"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    config.logConfig.recoverExistingFiles = true;
    const states = [];
    monitor = new CodexLogMonitor(config, (_sid, state, _event, extra) => {
      states.push({ state, recovered: extra.recovered === true });
    });
    monitor.start();

    setTimeout(() => {
      assert.deepStrictEqual(states, [{ state: "working", recovered: true }]);
      done();
    }, 300);
  });

  it("keeps every chunk of a large startup rollout in recovery mode", () => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    const padding = JSON.stringify({ type: "response_item", payload: { type: "reasoning", text: "x".repeat(300000) } });
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      padding,
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");
    const config = makeConfig(tmpDir);
    config.logConfig.recoverExistingFiles = true;
    const states = [];
    monitor = new CodexLogMonitor(config, (_sid, state) => states.push(state));
    monitor._poll(true);
    fs.appendFileSync(testFile, [
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");
    monitor._poll(false);
    monitor._poll(false);
    assert.deepStrictEqual(states, [], "historical completion must remain silent across chunk boundaries");
  });

  it("coalesces a newly discovered completed rollout into one final notification", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");
    const states = [];
    monitor = new CodexLogMonitor(makeConfig(tmpDir), (_sid, state, event) => {
      states.push({ state, event });
      setTimeout(() => {
        assert.deepStrictEqual(states, [{ state: "attention", event: "event_msg:task_complete" }]);
        done();
      }, 20);
    });
    monitor.start();
  });

  it("forwards the source timestamp with a coalesced state", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    const occurredAt = "2026-08-07T09:35:05.469Z";
    fs.writeFileSync(testFile, [
      JSON.stringify({ type: "session_meta", payload: { cwd: "/tmp" } }),
      JSON.stringify({ timestamp: occurredAt, type: "event_msg", payload: { type: "task_started" } }),
    ].join("\n") + "\n");
    monitor = new CodexLogMonitor(makeConfig(tmpDir), (_sid, state, _event, extra) => {
      assert.strictEqual(state, "thinking");
      assert.strictEqual(extra.occurredAtMs, Date.parse(occurredAt));
      done();
    });
    monitor.start();
  });

  it("drains a large startup snapshot without waiting one poll interval per chunk", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    const padding = JSON.stringify({
      type: "response_item",
      payload: { type: "reasoning", text: "x".repeat(512 * 1024) },
    });
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      padding,
      '{"type":"event_msg","payload":{"type":"task_started"}}',
    ].join("\n") + "\n");
    const config = makeConfig(tmpDir);
    config.logConfig.recoverExistingFiles = true;
    config.logConfig.pollIntervalMs = 1000;
    config.logConfig.maxReadBytesPerPoll = 32 * 1024;
    const startedAt = Date.now();
    monitor = new CodexLogMonitor(config, (_sid, state) => {
      assert.strictEqual(state, "thinking");
      assert.ok(Date.now() - startedAt < 900, "recovery should drain through event-loop slices");
      done();
    });
    monitor.start();
  });

  it("should handle incremental writes (tail behavior)", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, '{"type":"session_meta","payload":{"cwd":"/tmp"}}\n');

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (sid, state) => {
      states.push(state);
      if (state === "thinking") {
        assert.deepStrictEqual(states, ["thinking"]);
        done();
      }
    });
    monitor.start();

    // Append after a delay (simulates Codex writing during session)
    setTimeout(() => {
      fs.appendFileSync(testFile, '{"type":"event_msg","payload":{"type":"task_started"}}\n');
    }, 200);
  });

  it("should ignore unmapped event types", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"event_msg","payload":{"type":"token_count"}}',
      '{"type":"response_item","payload":{"type":"reasoning"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state) => {
      // token_count and reasoning are ignored; the bootstrap emits only the
      // final no-tool completion state.
      assert.strictEqual(state, "idle");
      done();
    });
    monitor.start();
  });

  it("should skip old completed files (>2min mtime)", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"event_msg","payload":{"type":"task_complete"}}',
    ].join("\n") + "\n");
    // Backdate mtime to 10 minutes ago
    const oldTime = new Date(Date.now() - 600000);
    fs.utimesSync(testFile, oldTime, oldTime);

    const config = makeConfig(tmpDir);
    let called = false;
    monitor = new CodexLogMonitor(config, () => { called = true; });
    monitor.start();

    setTimeout(() => {
      assert.strictEqual(called, false, "should not have processed old file");
      done();
    }, 300);
  });

  it("recovers an active rollout that was quiet for more than two minutes at startup", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command"}}',
    ].join("\n") + "\n");
    const quietTime = new Date(Date.now() - 3 * 60 * 1000);
    fs.utimesSync(testFile, quietTime, quietTime);

    const config = makeConfig(tmpDir);
    config.logConfig.recoverExistingFiles = true;
    monitor = new CodexLogMonitor(config, (_sid, state, _event, extra) => {
      assert.strictEqual(state, "working");
      assert.strictEqual(extra.recovered, true);
      done();
    });
    monitor.start();
  });

  it("should detect a recently updated rollout file from a resumed session older than 30 calendar days", (_, done) => {
    const config = makeConfig(tmpDir);
    const now = new Date();
    const resumed = new Date(now);
    resumed.setDate(resumed.getDate() - 45);
    const yyyy = resumed.getFullYear();
    const mm = String(resumed.getMonth() + 1).padStart(2, "0");
    const dd = String(resumed.getDate()).padStart(2, "0");
    const dir = path.join(tmpDir, String(yyyy), mm, dd);
    fs.mkdirSync(dir, { recursive: true });

    const file = path.join(dir, "rollout-2026-04-01T23-36-24-019d49b0-4e0d-78c0-9173-7870f18db910.jsonl");
    fs.writeFileSync(file, JSON.stringify({
      timestamp: new Date().toISOString(),
      type: "event_msg",
      payload: { type: "task_started" },
    }) + "\n");

    monitor = new CodexLogMonitor(config, (sid, state) => {
      if (state === "thinking") {
        assert.match(sid, /^codex:/);
        done();
      }
    });
    monitor.start();
  });

  it("should handle corrupted JSON lines gracefully", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      'THIS IS NOT JSON',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, (sid, state) => {
      // Should skip corrupted line and publish the final valid state.
      assert.strictEqual(state, "thinking");
      done();
    });
    monitor.start();
  });

  it("skips valid JSON primitives without interrupting later records", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      "null",
      "42",
      '"text"',
      "[]",
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"task_started"}}',
    ].join("\n") + "\n");

    monitor = new CodexLogMonitor(makeConfig(tmpDir), (_sid, state) => {
      assert.strictEqual(state, "thinking");
      done();
    });
    monitor.start();
  });

  it("recovers immediately when a tracked rollout is truncated", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      JSON.stringify({ type: "session_meta", payload: { cwd: "/tmp", padding: "x".repeat(200) } }),
      '{"type":"event_msg","payload":{"type":"task_started"}}',
    ].join("\n") + "\n");
    const states = [];
    monitor = new CodexLogMonitor(makeConfig(tmpDir), (_sid, state) => states.push(state));
    monitor.start();
    setTimeout(() => {
      fs.writeFileSync(testFile, '{"type":"event_msg","payload":{"type":"turn_aborted"}}\n');
      monitor._pollFile(testFile, TEST_FILENAME, false);
      assert.equal(states.at(-1), "idle");
      done();
    }, 150);
  });

  it("closes a rollout descriptor when reading throws", () => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, '{"type":"session_meta","payload":{"cwd":"/tmp"}}\n');
    monitor = new CodexLogMonitor(makeConfig(tmpDir), () => {});
    const originalRead = fs.readSync;
    const originalClose = fs.closeSync;
    let closeCalls = 0;
    fs.readSync = () => { throw new Error("read failed"); };
    fs.closeSync = (...args) => { closeCalls++; return originalClose(...args); };
    try {
      monitor._pollFile(testFile, TEST_FILENAME, false);
    } finally {
      fs.readSync = originalRead;
      fs.closeSync = originalClose;
    }
    assert.equal(closeCalls, 1);
  });

  it("limits bytes read from a newly discovered large rollout per poll", () => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, `${"x".repeat(1024)}\n`);
    const config = makeConfig(tmpDir);
    config.logConfig.maxReadBytesPerPoll = 64;
    monitor = new CodexLogMonitor(config, () => {});
    monitor._pollFile(testFile, TEST_FILENAME, false);
    assert.equal(monitor._tracked.get(testFile).offset, 64);
  });

  it("should keep a long-running shell command working instead of guessing that it needs approval", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    // function_call with shell_command but no exec_command_end following
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/projects/foo"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"shell_command","arguments":"{\\"command\\":\\"rm -rf node_modules\\"}"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (_sid, state) => {
      states.push(state);
    });
    monitor.start();
    setTimeout(() => {
      assert.ok(!states.includes("codex-permission"), "should not have emitted codex-permission");
      assert.ok(states.includes("working"));
      done();
    }, 2500);
  });

  it("should NOT emit codex-permission for non-shell function calls", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    // web_search_call — not a shell command, no approval needed
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"web_search","arguments":"{\\"query\\":\\"test\\"}"}}',
    ].join("\n") + "\n");

    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (sid, state) => {
      states.push(state);
    });
    monitor.start();

    setTimeout(() => {
      assert.ok(!states.includes("codex-permission"), "should not emit for non-shell calls");
      done();
    }, 300);
  });

  it("keeps an explicitly in-flight turn tracked past the normal stale timeout", () => {
    const config = makeConfig(tmpDir);
    const states = [];
    monitor = new CodexLogMonitor(config, (_sid, state, event) => states.push({ state, event }));
    const tracked = {
      sessionId: EXPECTED_SID,
      cwd: "/tmp",
      lastEventTime: Date.now() - 301000,
      lastState: "working",
      turnInFlight: true,
      inFlightStartedAt: Date.now() - 301000,
      lastHeartbeatAt: 0,
      reported: true,
      isSubagent: false,
    };
    monitor._tracked.set("/tmp/in-flight.jsonl", tracked);
    monitor._cleanStaleFiles();
    assert.equal(monitor._tracked.has("/tmp/in-flight.jsonl"), true);
    assert.deepStrictEqual(states, [{ state: "working", event: "codex-heartbeat" }]);
  });

  it("keeps the source event timestamp when refreshing an in-flight turn", () => {
    const config = makeConfig(tmpDir);
    const updates = [];
    monitor = new CodexLogMonitor(config, (_sid, state, event, extra) => {
      updates.push({ state, event, occurredAtMs: extra.occurredAtMs });
    });
    const sourceEventAt = Date.now() - 60000;
    monitor._tracked.set("/tmp/in-flight-source-time.jsonl", {
      sessionId: EXPECTED_SID,
      cwd: "/tmp",
      lastEventTime: Date.now() - 301000,
      lastState: "thinking",
      lastEventOccurredAtMs: sourceEventAt,
      turnInFlight: true,
      inFlightStartedAt: Date.now() - 301000,
      lastHeartbeatAt: 0,
      reported: true,
      isSubagent: false,
    });

    monitor._cleanStaleFiles();

    assert.deepStrictEqual(updates, [{
      state: "thinking",
      event: "codex-heartbeat",
      occurredAtMs: sourceEventAt,
    }]);
  });

  it("stops immediate recovery draining when a rollout makes no progress", (_, done) => {
    const missingFile = path.join(dateDir, TEST_FILENAME);
    monitor = new CodexLogMonitor(makeConfig(tmpDir), () => {});
    monitor._tracked.set(missingFile, {
      offset: 0,
      recovering: true,
      recoveryTargetOffset: 1024,
    });
    let attempts = 0;
    const originalPollFile = monitor._pollFile.bind(monitor);
    monitor._pollFile = (...args) => {
      attempts++;
      return originalPollFile(...args);
    };

    monitor._scheduleRecoveryDrain();
    setTimeout(() => {
      assert.strictEqual(attempts, 1);
      done();
    }, 30);
  });

  it("should extract shell command from function_call arguments JSON", () => {
    const config = makeConfig(tmpDir);
    monitor = new CodexLogMonitor(config, () => {});
    // JSON string arguments
    assert.strictEqual(
      monitor._extractShellCommand({ name: "shell_command", arguments: '{"command":"ls -la"}' }),
      "ls -la"
    );
    // Object arguments
    assert.strictEqual(
      monitor._extractShellCommand({ name: "shell_command", arguments: { command: "git status" } }),
      "git status"
    );
    // Non-shell function
    assert.strictEqual(
      monitor._extractShellCommand({ name: "web_search", arguments: '{"query":"test"}' }),
      ""
    );
    // null/empty
    assert.strictEqual(monitor._extractShellCommand(null), "");
    assert.strictEqual(monitor._extractShellCommand({}), "");
  });

  it("should expose unmapped token-count records to incremental consumers", (_, done) => {
    const testFile = path.join(dateDir, TEST_FILENAME);
    fs.writeFileSync(testFile, [
      '{"type":"session_meta","payload":{"cwd":"/tmp"}}',
      '{"type":"event_msg","payload":{"type":"token_count","rate_limits":{}}}',
    ].join("\n") + "\n");

    monitor = new CodexLogMonitor(makeConfig(tmpDir), () => {}, (record, metadata) => {
      if (record.payload?.type !== "token_count") return;
      assert.strictEqual(metadata.sessionId, EXPECTED_SID);
      done();
    });
    monitor.start();
  });
});
