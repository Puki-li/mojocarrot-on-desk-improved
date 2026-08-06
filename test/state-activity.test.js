const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");

function makeCtx(changes = []) {
  return {
    doNotDisturb: false,
    miniTransitioning: false,
    miniMode: false,
    mouseOverPet: false,
    idlePaused: false,
    forceEyeResend: false,
    mouseStillSince: Date.now(),
    sendToRenderer() {},
    syncHitWin() {},
    sendToHitWin() {},
    miniPeekIn() {},
    miniPeekOut() {},
    buildContextMenu() {},
    buildTrayMenu() {},
    pendingPermissions: [],
    resolvePermissionEntry() {},
    t: (key) => key,
    showSessionId: false,
    focusTerminalWindow() {},
    onActivityChanged: (change) => changes.push(change),
  };
}

describe("session activity metadata", () => {
  let api;

  afterEach(() => {
    if (api) api.cleanup();
    api = null;
  });

  it("tracks working, waiting, error, completed, and resumed states separately from pet state", () => {
    const changes = [];
    api = require("../src/state")(makeCtx(changes));

    api.updateSession("s1", "working", "PreToolUse", 1, "/repo", null, null, null, "claude-code");
    assert.strictEqual(api.sessions.get("s1").activityState, "working");

    api.updateSession("s1", "notification", "PermissionRequest", null, "", null, null, null, "claude-code");
    assert.strictEqual(api.sessions.get("s1").state, "idle");
    assert.strictEqual(api.sessions.get("s1").activityState, "waiting");

    api.updateSession("s1", "error", "PostToolUseFailure", null, "", null, null, null, "claude-code");
    assert.strictEqual(api.sessions.get("s1").activityState, "error");

    api.updateSession("s1", "attention", "Stop", null, "", null, null, null, "claude-code");
    assert.strictEqual(api.sessions.get("s1").activityState, "completed");

    api.updateSession("s1", "thinking", "UserPromptSubmit", null, "", null, null, null, "claude-code");
    assert.strictEqual(api.sessions.get("s1").activityState, "thinking");
    assert.ok(changes.some((change) => change?.state === "waiting"));
    assert.ok(changes.some((change) => change?.state === "completed"));
  });

  it("preserves Codex completion metadata when the log monitor becomes stale", () => {
    api = require("../src/state")(makeCtx());
    api.updateSession("codex:s1", "thinking", "event_msg:task_started", null, "/repo", null, null, null, "codex");
    api.updateSession("codex:s1", "attention", "event_msg:task_complete", null, "/repo", null, null, null, "codex");
    const completedAt = api.sessions.get("codex:s1").activityUpdatedAt;

    api.updateSession("codex:s1", "sleeping", "stale-cleanup", null, "/repo", null, null, null, "codex");

    const session = api.sessions.get("codex:s1");
    assert.strictEqual(session.activityState, "completed");
    assert.strictEqual(session.activityUpdatedAt, completedAt);
  });

  it("marks a Codex text-only turn completed even when the pet animation returns to idle", () => {
    api = require("../src/state")(makeCtx());
    api.updateSession("codex:text", "thinking", "event_msg:task_started", null, "/repo", null, null, null, "codex");
    api.updateSession("codex:text", "idle", "event_msg:task_complete", null, "/repo", null, null, null, "codex");
    assert.strictEqual(api.sessions.get("codex:text").state, "idle");
    assert.strictEqual(api.sessions.get("codex:text").activityState, "completed");
  });

  it("removes a session immediately on SessionEnd", () => {
    const changes = [];
    api = require("../src/state")(makeCtx(changes));
    api.updateSession("s1", "working", "PreToolUse", null, "/repo", null, null, null, "cursor-agent");
    api.updateSession("s1", "sleeping", "SessionEnd", null, "/repo", null, null, null, "cursor-agent");
    assert.strictEqual(api.sessions.has("s1"), false);
    assert.ok(changes.some((change) => change?.state === "ended"));
  });
});
