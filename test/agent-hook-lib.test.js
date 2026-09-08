const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  isExpectedAgentProcess,
  shouldForwardAgentHook,
} = require("../hooks/agent-hook-lib");

describe("agent hook caller attribution", () => {
  it("rejects local hook invocations without the expected agent process", () => {
    assert.equal(shouldForwardAgentHook(false, null), false);
    assert.equal(shouldForwardAgentHook(false, 0), false);
    assert.equal(shouldForwardAgentHook(false, 5535), true);
    assert.equal(shouldForwardAgentHook(true, null), true);
  });

  it("recognizes Gemini CLI binaries and the official Node package", () => {
    assert.equal(isExpectedAgentProcess("gemini-cli", "gemini", ""), true);
    assert.equal(isExpectedAgentProcess("gemini-cli", "node", "/opt/node @google/gemini-cli/dist/index.js"), true);
    assert.equal(isExpectedAgentProcess("gemini-cli", "node", "/repo/hooks/gemini-hook.js"), false);
  });

  it("recognizes Cursor binaries and macOS helper paths", () => {
    assert.equal(isExpectedAgentProcess("cursor-agent", "cursor.exe", ""), true);
    assert.equal(isExpectedAgentProcess("cursor-agent", "electron", "/Applications/Cursor.app/Contents/MacOS/Cursor"), true);
    assert.equal(isExpectedAgentProcess("cursor-agent", "node", "/repo/hooks/cursor-hook.js"), false);
  });

  it("recognizes Copilot CLI binaries and its Node package", () => {
    assert.equal(isExpectedAgentProcess("copilot-cli", "copilot", ""), true);
    assert.equal(isExpectedAgentProcess("copilot-cli", "node.exe", "node @github/copilot/index.js"), true);
    assert.equal(isExpectedAgentProcess("copilot-cli", "node", "/repo/hooks/copilot-hook.js"), false);
  });
});
