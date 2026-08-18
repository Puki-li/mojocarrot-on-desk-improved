const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  CodexQuotaSource,
  createThresholdCycleKey,
  findLatestQuota,
  findLatestQuotaAsync,
  parseQuotaLine,
  parseQuotaObject,
  selectLongestWindow,
} = require("../agents/codex-quota");

function makeTokenCount({
  timestamp = "2026-08-06T10:00:00.000Z",
  primary = null,
  secondary = null,
  limitId = "codex",
} = {}) {
  return {
    timestamp,
    type: "event_msg",
    payload: {
      type: "token_count",
      rate_limits: {
        limit_id: limitId,
        primary,
        secondary,
      },
    },
  };
}

function quotaWindow(usedPercent, windowMinutes, resetsAt) {
  return {
    used_percent: usedPercent,
    window_minutes: windowMinutes,
    resets_at: resetsAt,
  };
}

describe("Codex quota parser", () => {
  it("parses a weekly quota into remaining percent and cycle metadata", () => {
    const record = makeTokenCount({
      primary: quotaWindow(42, 10080, 1786172497),
    });

    const quota = parseQuotaObject(record);

    assert.strictEqual(quota.usedPercent, 42);
    assert.strictEqual(quota.remainingPercent, 58);
    assert.strictEqual(quota.windowMinutes, 10080);
    assert.strictEqual(quota.resetsAtMs, 1786172497000);
    assert.strictEqual(quota.resetAtIso, new Date(1786172497000).toISOString());
    assert.strictEqual(quota.cycleId, "codex:10080:1786172497");
    assert.strictEqual(
      createThresholdCycleKey(quota, 20),
      "codex:10080:1786172497:remaining-20"
    );
    assert.strictEqual(quota.observedAtMs, Date.parse("2026-08-06T10:00:00.000Z"));
  });

  it("selects the longest window and ignores shorter limits", () => {
    const limits = {
      primary: quotaWindow(75, 300, 1786000000),
      secondary: quotaWindow(31, 10080, 1786172497),
    };

    const selected = selectLongestWindow(limits);
    const quota = parseQuotaObject(makeTokenCount({
      primary: limits.primary,
      secondary: limits.secondary,
    }));

    assert.strictEqual(selected.windowMinutes, 10080);
    assert.strictEqual(quota.usedPercent, 31);
    assert.strictEqual(quota.remainingPercent, 69);
    assert.strictEqual(quota.windowLabel, "rate_limits.secondary");
  });

  it("tolerates corrupt, unrelated, and incomplete records", () => {
    assert.strictEqual(parseQuotaLine("not-json"), null);
    assert.strictEqual(parseQuotaLine(""), null);
    assert.strictEqual(parseQuotaObject({ type: "event_msg", payload: { type: "task_started" } }), null);
    assert.strictEqual(parseQuotaObject(makeTokenCount({
      primary: { used_percent: 20, window_minutes: 10080 },
    })), null);
    assert.strictEqual(parseQuotaObject(makeTokenCount({
      primary: quotaWindow(20, 10080, 100000000000000),
    })), null);
  });

  it("clamps malformed percentages to a usable display range", () => {
    const over = parseQuotaObject(makeTokenCount({
      primary: quotaWindow(125, 10080, 1786172497),
    }));
    const under = parseQuotaObject(makeTokenCount({
      primary: quotaWindow(-5, 10080, 1786172497),
    }));

    assert.strictEqual(over.usedPercent, 100);
    assert.strictEqual(over.remainingPercent, 0);
    assert.strictEqual(under.usedPercent, 0);
    assert.strictEqual(under.remainingPercent, 100);
  });

  it("ignores model-specific quota pools in the main Codex quota parser", () => {
    const record = makeTokenCount({
      limitId: "codex_bengalfox",
      primary: quotaWindow(0, 10080, 1787652314),
    });
    const spark = parseQuotaObject(record);
    const explicitlySelected = parseQuotaObject(record, {
      expectedLimitId: "codex_bengalfox",
    });

    assert.strictEqual(spark, null);
    assert.strictEqual(explicitlySelected.remainingPercent, 100);
  });
});

describe("Codex quota data source", () => {
  let tmpDir;
  let sessionDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "codex-quota-test-"));
    sessionDir = path.join(tmpDir, "2026", "08", "06");
    fs.mkdirSync(sessionDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("finds the newest valid quota across rollout logs at startup", () => {
    const olderFile = path.join(sessionDir, "rollout-older.jsonl");
    const newerFile = path.join(sessionDir, "rollout-newer.jsonl");
    fs.writeFileSync(olderFile, JSON.stringify(makeTokenCount({
      timestamp: "2026-08-06T09:00:00.000Z",
      primary: quotaWindow(20, 10080, 1786172497),
    })) + "\n");
    fs.writeFileSync(newerFile, [
      "{corrupt",
      JSON.stringify(makeTokenCount({
        timestamp: "2026-08-06T11:00:00.000Z",
        primary: quotaWindow(44, 10080, 1786172497),
      })),
      "{partial",
    ].join("\n"));

    const quota = findLatestQuota({ sessionDir: tmpDir });

    assert.strictEqual(quota.remainingPercent, 56);
    assert.strictEqual(quota.sourceFile, newerFile);
  });

  it("falls back to an older file when the newest log has no usable quota", () => {
    const validFile = path.join(sessionDir, "rollout-valid.jsonl");
    const corruptFile = path.join(sessionDir, "rollout-corrupt.jsonl");
    fs.writeFileSync(validFile, JSON.stringify(makeTokenCount({
      primary: quotaWindow(12, 10080, 1786172497),
    })) + "\n");
    fs.writeFileSync(corruptFile, "{broken}\n");
    const future = new Date(Date.now() + 5000);
    fs.utimesSync(corruptFile, future, future);

    const quota = findLatestQuota({ sessionDir: tmpDir });

    assert.strictEqual(quota.usedPercent, 12);
    assert.strictEqual(quota.sourceFile, validFile);
  });

  it("keeps the main quota when a newer file contains a separate model pool", async () => {
    const mainFile = path.join(sessionDir, "rollout-main.jsonl");
    const sparkFile = path.join(sessionDir, "rollout-spark.jsonl");
    fs.writeFileSync(mainFile, JSON.stringify(makeTokenCount({
      timestamp: "2026-08-06T10:00:00.000Z",
      primary: quotaWindow(62, 10080, 1787196831),
    })) + "\n");
    fs.writeFileSync(sparkFile, JSON.stringify(makeTokenCount({
      timestamp: "2026-08-06T10:05:00.000Z",
      limitId: "codex_bengalfox",
      primary: quotaWindow(0, 10080, 1787652314),
    })) + "\n");

    const syncQuota = findLatestQuota({ sessionDir: tmpDir });
    const asyncQuota = await findLatestQuotaAsync({ sessionDir: tmpDir });

    assert.strictEqual(syncQuota.limitId, "codex");
    assert.strictEqual(syncQuota.remainingPercent, 38);
    assert.strictEqual(asyncQuota.limitId, "codex");
    assert.strictEqual(asyncQuota.remainingPercent, 38);
  });

  it("returns null when the session directory is missing", () => {
    assert.strictEqual(findLatestQuota({ sessionDir: path.join(tmpDir, "missing") }), null);
  });

  it("bounds startup discovery to recent date directories", () => {
    const calls = [];
    const fsImpl = Object.create(fs);
    fsImpl.readdirSync = (directory, options) => {
      calls.push(directory);
      return fs.readdirSync(directory, options);
    };
    findLatestQuota({
      sessionDir: tmpDir,
      fs: fsImpl,
      recentDays: 2,
      now: new Date(2026, 7, 7),
    });
    assert.deepStrictEqual(calls, [
      path.join(tmpDir, "2026", "08", "07"),
      path.join(tmpDir, "2026", "08", "06"),
    ]);
  });

  it("can ingest live lines, dedupe updates, and retain the latest snapshot", () => {
    const updates = [];
    const source = new CodexQuotaSource({ onUpdate: (quota) => updates.push(quota) });
    const firstLine = JSON.stringify(makeTokenCount({
      timestamp: "2026-08-06T10:00:00.000Z",
      primary: quotaWindow(40, 10080, 1786172497),
    }));
    const secondLine = JSON.stringify(makeTokenCount({
      timestamp: "2026-08-06T10:05:00.000Z",
      primary: quotaWindow(41, 10080, 1786172497),
    }));

    source.ingestLine(firstLine, { sourceFile: "/tmp/rollout.jsonl" });
    source.ingestLine(firstLine, { sourceFile: "/tmp/rollout.jsonl" });
    source.ingestLine(secondLine, { sourceFile: "/tmp/rollout.jsonl" });

    assert.strictEqual(updates.length, 2);
    assert.strictEqual(source.getSnapshot().remainingPercent, 59);
    assert.strictEqual(source.getSnapshot().sourceFile, "/tmp/rollout.jsonl");
  });

  it("does not let a live model-specific pool overwrite the main quota", () => {
    const updates = [];
    const source = new CodexQuotaSource({ onUpdate: (quota) => updates.push(quota) });
    source.ingestObject(makeTokenCount({
      timestamp: "2026-08-06T10:00:00.000Z",
      primary: quotaWindow(62, 10080, 1787196831),
    }));
    source.ingestObject(makeTokenCount({
      timestamp: "2026-08-06T10:05:00.000Z",
      limitId: "codex_bengalfox",
      primary: quotaWindow(0, 10080, 1787652314),
    }));

    assert.strictEqual(updates.length, 1);
    assert.strictEqual(source.getSnapshot().limitId, "codex");
    assert.strictEqual(source.getSnapshot().remainingPercent, 38);
  });

  it("can ingest parsed records from the shared Codex log stream", () => {
    const updateMetadata = [];
    const source = new CodexQuotaSource({
      onUpdate: (_quota, metadata) => updateMetadata.push(metadata),
    });
    const snapshot = source.ingestObject(makeTokenCount({
      timestamp: "2026-08-06T10:00:00.000Z",
      primary: quotaWindow(35, 10080, 1786172497),
    }), { recovering: true });
    assert.strictEqual(snapshot.remainingPercent, 65);
    assert.strictEqual(source.getSnapshot().remainingPercent, 65);
    assert.strictEqual(updateMetadata[0].recovering, true);
  });

  it("loads the latest local quota immediately when started", () => {
    const file = path.join(sessionDir, "rollout-startup.jsonl");
    fs.writeFileSync(file, JSON.stringify(makeTokenCount({
      primary: quotaWindow(55, 10080, 1786172497),
    })) + "\n");
    const updates = [];
    const source = new CodexQuotaSource({
      sessionDir: tmpDir,
      pollIntervalMs: 60000,
      onUpdate: (quota) => updates.push(quota),
    });

    const initial = source.start();
    source.stop();

    assert.strictEqual(initial.remainingPercent, 45);
    assert.strictEqual(updates.length, 1);
  });

  it("supports an asynchronous startup scan without blocking start", async () => {
    let releaseScan;
    const scan = new Promise((resolve) => { releaseScan = resolve; });
    const updates = [];
    const source = new CodexQuotaSource({
      asyncInitialPoll: true,
      continuousPolling: false,
      findLatestQuotaAsync: () => scan,
      onUpdate: (quota) => updates.push(quota),
    });
    assert.strictEqual(source.start(), null);
    assert.strictEqual(updates.length, 0);
    const quota = parseQuotaObject(makeTokenCount({
      primary: quotaWindow(30, 10080, 1786172497),
    }));
    releaseScan(quota);
    await source.pollAsync();
    assert.strictEqual(source.getSnapshot().remainingPercent, 70);
    assert.strictEqual(updates.length, 1);
  });

  it("finds quota through the asynchronous file scanner", async () => {
    const file = path.join(sessionDir, "rollout-async.jsonl");
    fs.writeFileSync(file, JSON.stringify(makeTokenCount({
      primary: quotaWindow(25, 10080, 1786172497),
    })) + "\n");
    const quota = await findLatestQuotaAsync({
      sessionDir: tmpDir,
      recentDays: 2,
      now: new Date(2026, 7, 7),
    });
    assert.strictEqual(quota.remainingPercent, 75);
  });
});
