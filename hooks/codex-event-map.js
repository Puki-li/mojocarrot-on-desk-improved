// Shared Codex JSONL event semantics for local and remote monitors.
// Keep this module dependency-free: remote-deploy.sh copies it as a standalone helper.

const LOG_EVENT_MAP = Object.freeze({
  "session_meta": "idle",
  "event_msg:task_started": "thinking",
  "event_msg:user_message": "thinking",
  "event_msg:agent_message": null,
  "response_item:function_call": "working",
  "response_item:custom_tool_call": "working",
  "response_item:web_search_call": "working",
  "event_msg:task_complete": "codex-turn-end",
  "event_msg:context_compacted": "sweeping",
  "event_msg:turn_aborted": "idle",
});

const TOOL_ACTIVITY_EVENTS = new Set([
  "response_item:function_call",
  "response_item:custom_tool_call",
  "response_item:web_search_call",
]);

function resolveCodexEventState(key, tracker) {
  const mapped = LOG_EVENT_MAP[key];
  if (mapped === undefined || mapped === null) return null;

  if (key === "event_msg:task_started") tracker.hadToolUse = false;
  if (TOOL_ACTIVITY_EVENTS.has(key)) tracker.hadToolUse = true;

  if (mapped === "codex-turn-end") {
    const resolved = tracker.hadToolUse ? "attention" : "idle";
    tracker.hadToolUse = false;
    return resolved;
  }

  return mapped;
}

module.exports = {
  LOG_EVENT_MAP,
  TOOL_ACTIVITY_EVENTS,
  resolveCodexEventState,
};
