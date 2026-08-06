const test = require("node:test");
const assert = require("node:assert/strict");

const {
  COMPLETED_RETENTION_MS,
  buildActivitySnapshot,
  getProjectName,
} = require("../src/activity-model");

function sessions(entries) {
  return new Map(entries);
}

test("activity snapshot keeps an always-visible Idle entry point", () => {
  const snapshot = buildActivitySnapshot({ sessions: new Map(), now: 1000 });
  assert.deepStrictEqual(snapshot.status, {
    mode: "idle",
    label: "Idle",
    color: "#64748b",
    extraCount: 0,
  });
  assert.equal(snapshot.sessionCount, 0);
});

test("activity snapshot shows DND independently from sessions", () => {
  const snapshot = buildActivitySnapshot({
    sessions: sessions([["c1", { state: "working", agentId: "codex", updatedAt: 10 }]]),
    doNotDisturb: true,
    now: 20,
  });
  assert.equal(snapshot.status.mode, "dnd");
  assert.equal(snapshot.status.label, "DND");
  assert.equal(snapshot.sessionCount, 1);
});

test("dominant agent uses activity priority and only counts other active sessions", () => {
  const snapshot = buildActivitySnapshot({
    sessions: sessions([
      ["codex", { state: "working", agentId: "codex", cwd: "/repo/mojocarrot", updatedAt: 30 }],
      ["cursor", { state: "thinking", agentId: "cursor-agent", updatedAt: 40 }],
      ["claude", { state: "idle", activityState: "completed", agentId: "claude-code", updatedAt: 50, activityUpdatedAt: 50 }],
    ]),
    now: 60,
  });
  assert.equal(snapshot.status.label, "Codex");
  assert.equal(snapshot.status.extraCount, 1);
  assert.equal(snapshot.activeCount, 2);
  assert.equal(snapshot.sessions[0].id, "codex");
  assert.equal(snapshot.sessions[0].project, "mojocarrot");
});

test("all completed sessions leave the status at Idle while remaining visible for ten minutes", () => {
  const now = 100000;
  const snapshot = buildActivitySnapshot({
    sessions: sessions([
      ["c1", { state: "idle", activityState: "completed", agentId: "codex", activityUpdatedAt: now - 1000 }],
    ]),
    now,
  });
  assert.equal(snapshot.status.label, "Idle");
  assert.equal(snapshot.sessionCount, 1);
  assert.equal(snapshot.sessions[0].state, "completed");
});

test("completed sessions disappear from the panel after ten minutes", () => {
  const now = 1000000;
  const snapshot = buildActivitySnapshot({
    sessions: sessions([
      ["old", {
        state: "idle",
        activityState: "completed",
        agentId: "codex",
        activityUpdatedAt: now - COMPLETED_RETENTION_MS - 1,
      }],
    ]),
    now,
  });
  assert.equal(snapshot.sessionCount, 0);
  assert.equal(snapshot.status.label, "Idle");
});

test("waiting input outranks errors and working sessions", () => {
  const snapshot = buildActivitySnapshot({
    sessions: sessions([
      ["working", { state: "working", agentId: "codex", updatedAt: 30 }],
      ["error", { state: "idle", activityState: "error", agentId: "cursor-agent", activityUpdatedAt: 20 }],
      ["waiting", { state: "idle", activityState: "waiting", agentId: "claude-code", activityUpdatedAt: 10 }],
    ]),
    now: 40,
  });
  assert.equal(snapshot.status.label, "Claude Code");
  assert.deepStrictEqual(snapshot.sessions.map((entry) => entry.id), ["waiting", "error", "working"]);
});

test("project names support both POSIX and Windows paths", () => {
  assert.equal(getProjectName("/tmp/my-project/", "s"), "my-project");
  assert.equal(getProjectName("C:\\work\\desk-pet", "s"), "desk-pet");
});

test("idle, completed, and headless sessions do not inflate the compact status count", () => {
  const snapshot = buildActivitySnapshot({
    sessions: sessions([
      ["main", { state: "working", agentId: "codex", updatedAt: 50 }],
      ["idle", { state: "idle", agentId: "cursor-agent", updatedAt: 40 }],
      ["done", { state: "idle", activityState: "completed", agentId: "claude-code", activityUpdatedAt: 30 }],
      ["bot", { state: "working", agentId: "codex", headless: true, updatedAt: 20 }],
    ]),
    now: 60,
  });
  assert.equal(snapshot.status.label, "Codex");
  assert.equal(snapshot.status.extraCount, 0);
  assert.equal(snapshot.sessionCount, 4);
  assert.equal(snapshot.activeCount, 1);
});

test("remote sessions are visible but cannot request local focus", () => {
  const snapshot = buildActivitySnapshot({
    sessions: sessions([
      ["remote", {
        state: "working",
        agentId: "claude-code",
        sourcePid: 123,
        host: "build-host",
        updatedAt: 10,
      }],
    ]),
    now: 20,
  });
  assert.equal(snapshot.sessions[0].focusable, false);
});
