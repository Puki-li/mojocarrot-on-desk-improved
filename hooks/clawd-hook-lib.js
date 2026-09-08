// clawd-hook-lib.js — pure helpers for clawd-hook.js, extracted for unit tests
// (same pattern as scripts/generate-readme-gifs-lib.js). Zero dependencies.

const {
  parseWmicList,
  queryWindowsProcess,
  shouldForwardAgentHook,
} = require("./agent-hook-lib");

// PostToolUseFailure also fires on routine self-healing failures (Bash
// non-zero exit, grep no match, failing tests the agent is fixing) —
// the agent is still working, so Bash failures show working, not error.
// Missing tool_name falls back to error (previous behavior).
function resolvePostToolUseFailureState(toolName) {
  return toolName === "Bash" ? "working" : "error";
}

// Some Codex hosts execute Claude-compatible hooks. A local hook is only a
// Claude Code event when the hook process tree actually contains Claude.
// Remote hooks cannot inspect local process ancestry, so keep forwarding them.
function shouldForwardClaudeHook(isRemote, claudePid) {
  return shouldForwardAgentHook(isRemote, claudePid);
}

module.exports = {
  parseWmicList,
  queryWindowsProcess,
  resolvePostToolUseFailureState,
  shouldForwardClaudeHook,
};
