const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const HOOKS_DIR = path.join(__dirname, "..", "hooks");

function runIsolatedHook(script, args, payload) {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "mojocarrot-agent-hook-"));
  try {
    return spawnSync(process.execPath, [path.join(HOOKS_DIR, script), ...args], {
      input: JSON.stringify(payload),
      encoding: "utf8",
      timeout: 3000,
      env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
    });
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
}

describe("agent hook execution isolation", () => {
  it("keeps Cursor prompt submission non-blocking when no Cursor caller exists", () => {
    const result = runIsolatedHook("cursor-hook.js", [], {
      hook_event_name: "beforeSubmitPrompt",
      session_id: "test",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepStrictEqual(JSON.parse(result.stdout.trim()), { continue: true });
  });

  it("keeps Cursor tool hooks neutral when no Cursor caller exists", () => {
    const result = runIsolatedHook("cursor-hook.js", [], {
      hook_event_name: "preToolUse",
      session_id: "test",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepStrictEqual(JSON.parse(result.stdout.trim()), {});
  });

  it("exits a standalone Copilot hook without forwarding it", () => {
    const result = runIsolatedHook("copilot-hook.js", ["preToolUse"], {
      sessionId: "test",
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, "");
  });
});
