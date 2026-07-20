// clawd-hook-lib.js — pure helpers for clawd-hook.js, extracted for unit tests
// (same pattern as scripts/generate-readme-gifs-lib.js). Zero dependencies.

// PostToolUseFailure also fires on routine self-healing failures (Bash
// non-zero exit, grep no match, failing tests the agent is fixing) —
// the agent is still working, so Bash failures show working, not error.
// Missing tool_name falls back to error (previous behavior).
function resolvePostToolUseFailureState(toolName) {
  return toolName === "Bash" ? "working" : "error";
}

module.exports = { resolvePostToolUseFailureState };
