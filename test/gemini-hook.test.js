const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("standalone Gemini BeforeTool hook returns a neutral response without forwarding", () => {
  const tempHome = fs.mkdtempSync(path.join(os.tmpdir(), "mojocarrot-gemini-hook-"));
  try {
    const result = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "gemini-hook.js")], {
      input: JSON.stringify({ hook_event_name: "BeforeTool", session_id: "test" }),
      encoding: "utf8",
      timeout: 3000,
      env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepStrictEqual(JSON.parse(result.stdout.trim()), {});
  } finally {
    fs.rmSync(tempHome, { recursive: true, force: true });
  }
});
