// Codex CLI agent configuration
// Windows hooks completely disabled — uses JSONL log polling instead

const { LOG_EVENT_MAP } = require("../hooks/codex-event-map");

module.exports = {
  id: "codex",
  name: "Codex CLI",
  processNames: { win: ["codex.exe"], mac: ["codex"], linux: ["codex"] },
  nodeCommandPatterns: [], // Rust native binary, not node
  eventSource: "log-poll",
  // The shared helper also resolves turn-end behavior for local and remote monitors.
  logEventMap: LOG_EVENT_MAP,
  capabilities: {
    httpHook: false,
    permissionApproval: false,
    sessionEnd: false, // no SessionEnd event, rely on task_complete + timeout
    subagent: false,
  },
  logConfig: {
    sessionDir: "~/.codex/sessions",
    filePattern: "rollout-*.jsonl",
    pollIntervalMs: 1500,
  },
  pidField: "codex_pid",
};
