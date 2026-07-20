const { describe, it } = require("node:test");
const assert = require("node:assert");
const { resolvePostToolUseFailureState } = require("../hooks/clawd-hook-lib");

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
