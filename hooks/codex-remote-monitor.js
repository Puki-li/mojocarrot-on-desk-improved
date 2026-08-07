#!/usr/bin/env node
// Codex CLI JSONL log monitor — standalone remote version
// Polls ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl for state changes
// and POSTs them via HTTP to the local Clawd desktop pet (through SSH tunnel).
//
// Zero external dependencies — Node.js built-ins + ./server-config.js only.
//
// Usage:
//   node codex-remote-monitor.js            # run as long-lived daemon
//   node codex-remote-monitor.js --once     # single scan then exit (debug)
//   node codex-remote-monitor.js --port 23334  # custom server port
//
// Designed to keep running even when the SSH tunnel is down — failed POSTs
// are silently ignored, and the monitor resumes syncing as soon as the
// tunnel comes back up.

const fs = require("fs");
const path = require("path");
const os = require("os");
const { postStateToRunningServer, readHostPrefix } = require("./server-config");
const { LOG_EVENT_MAP, resolveCodexEventState } = require("./codex-event-map");

// ── Inline config from agents/codex.js (zero-dependency requirement) ──

const SESSION_DIR = path.join(os.homedir(), ".codex", "sessions");
const POLL_INTERVAL_MS = 1500;
const MAX_READ_BYTES_PER_POLL = 256 * 1024;
const IN_FLIGHT_HEARTBEAT_MS = 30000;
const MAX_IN_FLIGHT_STALE_MS = 6 * 60 * 60 * 1000;

// ── CLI args ──

const args = process.argv.slice(2);
const onceMode = args.includes("--once");
const portIndex = args.indexOf("--port");
const preferredPort = portIndex >= 0 ? parseInt(args[portIndex + 1], 10) : undefined;

const hostPrefix = readHostPrefix();

// ── State tracking ──

// Map<filePath, { offset, sessionId, cwd, lastEventTime, lastState, partial }>
const tracked = new Map();

// ── Core polling logic (mirrors agents/codex-log-monitor.js) ──

function getSessionDirs() {
  const dirs = [];
  const now = new Date();
  for (let daysAgo = 0; daysAgo <= 1; daysAgo++) {
    const d = new Date(now);
    d.setDate(d.getDate() - daysAgo);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    dirs.push(path.join(SESSION_DIR, String(yyyy), mm, dd));
  }
  return dirs;
}

function extractSessionId(fileName) {
  // rollout-2026-03-25T15-10-51-019d23d4-f1a9-7633-b9c7-758327137228.jsonl
  const base = fileName.replace(".jsonl", "");
  const parts = base.split("-");
  if (parts.length < 10) return null;
  return parts.slice(-5).join("-");
}

function postState(sessionId, state, event, cwd) {
  const body = JSON.stringify({
    state,
    session_id: sessionId,
    event,
    agent_id: "codex",
    cwd: cwd || "",
    host: hostPrefix,
  });
  postStateToRunningServer(
    body,
    { timeoutMs: 100, preferredPort },
    () => {} // fire and forget — tunnel may be down
  );
}

function processLine(line, entry, emit = true) {
  let obj;
  try {
    obj = JSON.parse(line);
  } catch {
    return;
  }

  const type = obj.type;
  const payload = obj.payload;
  const subtype =
    payload && typeof payload === "object" ? payload.type || "" : "";
  const key = subtype ? type + ":" + subtype : type;

  // Extract CWD from session_meta
  if (type === "session_meta" && payload) {
    entry.cwd = payload.cwd || "";
    entry.isSubagent = payload.thread_source === "subagent" ||
      !!(payload.source && typeof payload.source === "object" && payload.source.subagent);
  }
  if (entry.isSubagent) return;

  const now = Date.now();
  entry.lastEventTime = now;
  if (key === "event_msg:task_started" || key === "event_msg:user_message") {
    entry.turnInFlight = true;
    entry.inFlightStartedAt = now;
  } else if (key === "event_msg:task_complete" || key === "event_msg:turn_aborted") {
    entry.turnInFlight = false;
    entry.inFlightStartedAt = 0;
  }

  const mappedState = LOG_EVENT_MAP[key];
  if (mappedState === undefined || mappedState === null) return;
  const state = resolveCodexEventState(key, entry);

  // Avoid spamming same state
  if (state === entry.lastState && state === "working") return;
  entry.lastState = state;

  if (emit) {
    entry.reported = true;
    entry.lastHeartbeatAt = now;
    postState(entry.sessionId, state, key, entry.cwd);
  }
}

function refreshInFlight(entry) {
  if (!entry.turnInFlight || !entry.reported || entry.recovering) return;
  const now = Date.now();
  if (now - entry.inFlightStartedAt > MAX_IN_FLIGHT_STALE_MS) return;
  if (now - entry.lastHeartbeatAt < IN_FLIGHT_HEARTBEAT_MS) return;
  const state = entry.lastState === "working" ? "working" : "thinking";
  entry.lastHeartbeatAt = now;
  entry.lastEventTime = now;
  postState(entry.sessionId, state, "codex-heartbeat", entry.cwd);
}

function finishRecovery(entry) {
  if (!entry.recovering || entry.offset < entry.recoveryTargetOffset) return;
  entry.recovering = false;
  if (!entry.isSubagent && (entry.lastState === "working" || entry.lastState === "thinking")) {
    entry.reported = true;
    entry.lastHeartbeatAt = Date.now();
    postState(entry.sessionId, entry.lastState, "recovered", entry.cwd);
  }
}

function pollFile(filePath, fileName, recoverExisting = false) {
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return;
  }

  let entry = tracked.get(filePath);
  if (!entry) {
    const sessionId = extractSessionId(fileName);
    if (!sessionId) return;
    entry = {
      offset: 0,
      sessionId: "codex:" + sessionId,
      cwd: "",
      lastEventTime: Date.now(),
      lastState: null,
      partial: "",
      hadToolUse: false,
      device: stat.dev,
      inode: stat.ino,
      mtimeMs: stat.mtimeMs,
      turnInFlight: false,
      inFlightStartedAt: 0,
      lastHeartbeatAt: 0,
      reported: false,
      isSubagent: false,
      recovering: recoverExisting,
      recoveryTargetOffset: recoverExisting ? stat.size : 0,
    };
    tracked.set(filePath, entry);
  }

  const identityChanged = entry.device !== stat.dev || entry.inode !== stat.ino;
  const rewrittenAtSameSize = stat.size === entry.offset && stat.mtimeMs > entry.mtimeMs;
  if (identityChanged || stat.size < entry.offset || rewrittenAtSameSize) {
    entry.offset = 0;
    entry.partial = "";
    entry.device = stat.dev;
    entry.inode = stat.ino;
    if (entry.recovering) entry.recoveryTargetOffset = stat.size;
  }
  const readableEnd = entry.recovering
    ? Math.min(stat.size, entry.recoveryTargetOffset)
    : stat.size;
  if (readableEnd === entry.offset) {
    entry.mtimeMs = stat.mtimeMs;
    finishRecovery(entry);
    refreshInFlight(entry);
    return;
  }

  let buf;
  let fd;
  try {
    fd = fs.openSync(filePath, "r");
    const readLen = Math.min(readableEnd - entry.offset, MAX_READ_BYTES_PER_POLL);
    buf = Buffer.alloc(readLen);
    const bytesRead = fs.readSync(fd, buf, 0, readLen, entry.offset);
    if (bytesRead <= 0) return;
    if (bytesRead < buf.length) buf = buf.subarray(0, bytesRead);
  } catch {
    return;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
  entry.offset += buf.length;
  entry.mtimeMs = stat.mtimeMs;

  const text = entry.partial + buf.toString("utf8");
  const lines = text.split("\n");
  entry.partial = lines.pop() || "";

  for (const line of lines) {
    if (!line.trim()) continue;
    processLine(line, entry, !entry.recovering);
  }
  finishRecovery(entry);
}

function cleanStaleFiles() {
  const now = Date.now();
  for (const [filePath, entry] of tracked) {
    if (now - entry.lastEventTime > 300000) {
      if (entry.turnInFlight && now - entry.inFlightStartedAt <= MAX_IN_FLIGHT_STALE_MS) {
        refreshInFlight(entry);
        continue;
      }
      postState(entry.sessionId, "sleeping", "stale-cleanup", entry.cwd);
      tracked.delete(filePath);
    }
  }
}

function poll(recoverExisting = false) {
  const dirs = getSessionDirs();
  for (const dir of dirs) {
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    const now = Date.now();
    for (const file of files) {
      if (!file.startsWith("rollout-") || !file.endsWith(".jsonl")) continue;
      const filePath = path.join(dir, file);
      if (!tracked.has(filePath)) {
        try {
          const mtime = fs.statSync(filePath).mtimeMs;
          if (now - mtime > 120000) continue;
        } catch { continue; }
      }
      pollFile(filePath, file, recoverExisting);
    }
  }
  cleanStaleFiles();
}

// ── Main ──

console.log(`Clawd Codex remote monitor started`);
console.log(`  Session dir: ${SESSION_DIR}`);
console.log(`  Poll interval: ${POLL_INTERVAL_MS}ms`);
if (preferredPort) console.log(`  Preferred port: ${preferredPort}`);
console.log(`  Press Ctrl+C to stop\n`);

poll(true);

if (!onceMode) {
  const interval = setInterval(() => poll(false), POLL_INTERVAL_MS);

  process.on("SIGINT", () => {
    clearInterval(interval);
    console.log("\nStopped.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    clearInterval(interval);
    process.exit(0);
  });
}
