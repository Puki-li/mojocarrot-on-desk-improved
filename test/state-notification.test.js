const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

function makeCtx() {
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
    t: (k) => k,
    showSessionId: false,
    focusTerminalWindow() {},
  };
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("notification state behavior", () => {
  let api;

  beforeEach(() => {
    api = require("../src/state")(makeCtx());
  });

  afterEach(() => {
    api.cleanup();
  });

  it("keeps notification visible until another state explicitly replaces it", async () => {
    api.updateSession("s1", "working", "PermissionRequest", null, "/tmp", null, null, null, "claude-code");
    assert.strictEqual(api.getCurrentState(), "notification");
    assert.strictEqual(api.getCurrentSvg(), "clawd-notification.svg");

    await wait(2700);

    assert.strictEqual(api.getCurrentState(), "notification");
    assert.strictEqual(api.getCurrentSvg(), "clawd-notification.svg");
  });

  it("displays notification for a Notification hook event", () => {
    api.updateSession("s1", "notification", "Notification", null, "/tmp", null, null, null, "claude-code");
    assert.strictEqual(api.getCurrentState(), "notification");
    assert.strictEqual(api.getCurrentSvg(), "clawd-notification.svg");
    // session itself is stored as idle so notification stays a transient overlay
    assert.strictEqual(api.sessions.get("s1").state, "idle");
  });

  it("lets a new working state replace notification immediately", () => {
    api.updateSession("s1", "working", "PermissionRequest", null, "/tmp", null, null, null, "claude-code");
    assert.strictEqual(api.getCurrentState(), "notification");

    api.updateSession("s1", "working", "PreToolUse", null, "/tmp", null, null, process.pid, "claude-code");

    assert.strictEqual(api.getCurrentState(), "working");
    assert.strictEqual(api.getCurrentSvg(), "clawd-working-typing.svg");
  });
});
