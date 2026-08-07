const { describe, it } = require("node:test");
const assert = require("node:assert");
const { resolvePostToolUseFailureState, shouldForwardClaudeHook } = require("../hooks/clawd-hook-lib");

describe("clawd-hook PostToolUseFailure filter", () => {
  it("downgrades Bash tool failures to working (routine non-zero exit)", () => {
    assert.strictEqual(resolvePostToolUseFailureState("Bash"), "working");
  });

  it("keeps error for non-Bash tool failures", () => {
    assert.strictEqual(resolvePostToolUseFailureState("Edit"), "error");
    assert.strictEqual(resolvePostToolUseFailureState("Write"), "error");
    assert.strictEqual(resolvePostToolUseFailureState("mcp__server__tool"), "error");
  });

  it("falls back to error when tool_name is missing", () => {
    assert.strictEqual(resolvePostToolUseFailureState(undefined), "error");
    assert.strictEqual(resolvePostToolUseFailureState(""), "error");
    assert.strictEqual(resolvePostToolUseFailureState(null), "error");
  });
});

describe("clawd-hook caller attribution", () => {
  it("forwards local events only when Claude exists in the hook process tree", () => {
    assert.strictEqual(shouldForwardClaudeHook(false, 5535), true);
    assert.strictEqual(shouldForwardClaudeHook(false, null), false);
    assert.strictEqual(shouldForwardClaudeHook(false, 0), false);
  });

  it("keeps remote Claude hooks because remote process ancestry is unavailable", () => {
    assert.strictEqual(shouldForwardClaudeHook(true, null), true);
  });
});
