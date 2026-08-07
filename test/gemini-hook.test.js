const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

test("Gemini BeforeTool hook observes state without allowing the tool", () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, "..", "hooks", "gemini-hook.js")], {
    input: JSON.stringify({ hook_event_name: "BeforeTool", session_id: "test" }),
    encoding: "utf8",
    timeout: 3000,
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepStrictEqual(JSON.parse(result.stdout.trim()), {});
});
