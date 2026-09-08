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
const FULL_DIRECTORY_SCAN_MS = 60000;
const STARTUP_ACTIVE_PROBE_BYTES = 256 * 1024;
const STARTUP_ACTIVE_MAX_AGE_MS = 6 * 60 * 60 * 1000;

// ── CLI args ──

const args = process.argv.slice(2);
const onceMode = args.includes("--once");
const portIndex = args.indexOf("--port");
const preferredPort = portIndex >= 0 ? parseInt(args[portIndex + 1], 10) : undefined;

const hostPrefix = readHostPrefix();

// ── State tracking ──

// Map<filePath, { offset, sessionId, cwd, lastEventTime, lastState, partial }>
const tracked = new Map();
let recoveryDrainImmediate = null;
let lastFullDirectoryScan = 0;

// ── Core polling logic (mirrors agents/codex-log-monitor.js) ──

function getCurrentSessionDir(now = new Date()) {
  return path.join(
    SESSION_DIR,
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  );
}

function getAllSessionDirs() {
  const dirs = [];
  let years;
  try { years = fs.readdirSync(SESSION_DIR, { withFileTypes: true }); } catch { return dirs; }
  for (const year of years) {
    if (!year.isDirectory() || !/^\d{4}$/.test(year.name)) continue;
    const yearDir = path.join(SESSION_DIR, year.name);
    let months;
    try { months = fs.readdirSync(yearDir, { withFileTypes: true }); } catch { continue; }
    for (const month of months) {
      if (!month.isDirectory() || !/^(0[1-9]|1[0-2])$/.test(month.name)) continue;
      const monthDir = path.join(yearDir, month.name);
      let days;
      try { days = fs.readdirSync(monthDir, { withFileTypes: true }); } catch { continue; }
      for (const day of days) {
        if (!day.isDirectory() || !/^(0[1-9]|[12]\d|3[01])$/.test(day.name)) continue;
        const date = new Date(Number(year.name), Number(month.name) - 1, Number(day.name));
        if (
          date.getFullYear() === Number(year.name) &&
          date.getMonth() + 1 === Number(month.name) &&
          date.getDate() === Number(day.name)
        ) dirs.push(path.join(monthDir, day.name));
      }
    }
  }
  return dirs.sort().reverse();
}

function extractSessionId(fileName) {
  // rollout-2026-03-25T15-10-51-019d23d4-f1a9-7633-b9c7-758327137228.jsonl
  const base = fileName.replace(".jsonl", "");
  const parts = base.split("-");
  if (parts.length < 10) return null;
  return parts.slice(-5).join("-");
}

function postState(sessionId, state, event, cwd, occurredAtMs) {
  const body = JSON.stringify({
    state,
    session_id: sessionId,
    event,
    agent_id: "codex",
    cwd: cwd || "",
    host: hostPrefix,
    occurred_at_ms: Number.isFinite(occurredAtMs) ? occurredAtMs : Date.now(),
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
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;

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
  const parsedOccurredAtMs = Date.parse(obj.timestamp);
  const occurredAtMs = Number.isFinite(parsedOccurredAtMs) ? parsedOccurredAtMs : now;
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

  entry.lastState = state;
  entry.lastEventKey = key;
  entry.lastEventOccurredAtMs = occurredAtMs;

  if (emit) {
    entry.reported = true;
    entry.lastHeartbeatAt = now;
    postState(entry.sessionId, state, key, entry.cwd, occurredAtMs);
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
  postState(entry.sessionId, state, "codex-heartbeat", entry.cwd, entry.lastEventOccurredAtMs);
}

function finishRecovery(entry) {
  if (!entry.recovering || entry.offset < entry.recoveryTargetOffset) return;
  if (entry.partial) return;
  const recoveryKind = entry.recoveryKind;
  entry.recovering = false;
  entry.recoveryKind = null;
  const isActive = entry.lastState === "working" || entry.lastState === "thinking";
  const isFreshTerminalTurn = recoveryKind === "bootstrap" &&
    (entry.lastEventKey === "event_msg:task_complete" ||
      entry.lastEventKey === "event_msg:turn_aborted");
  if (!entry.isSubagent && (isActive || isFreshTerminalTurn)) {
    entry.reported = true;
    entry.lastHeartbeatAt = Date.now();
    postState(
      entry.sessionId,
      entry.lastState,
      entry.lastEventKey || "recovered",
      entry.cwd,
      entry.lastEventOccurredAtMs
    );
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
      recovering: stat.size > 0,
      recoveryKind: recoverExisting ? "startup" : "bootstrap",
      recoveryTargetOffset: stat.size,
      lastEventKey: null,
      lastEventOccurredAtMs: null,
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
    entry.lastState = null;
    entry.lastEventKey = null;
    entry.lastEventOccurredAtMs = null;
    entry.hadToolUse = false;
    entry.turnInFlight = false;
    entry.inFlightStartedAt = 0;
    entry.recovering = stat.size > 0;
    entry.recoveryKind = "bootstrap";
    entry.recoveryTargetOffset = stat.size;
  }
  if (entry.recovering && stat.size > entry.recoveryTargetOffset) {
    entry.recoveryTargetOffset = stat.size;
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

function isLikelyActiveRollout(filePath, stat) {
  if (!stat || !stat.isFile() || stat.size <= 0) return false;
  const readLength = Math.min(stat.size, STARTUP_ACTIVE_PROBE_BYTES);
  const start = stat.size - readLength;
  let fd;
  let text;
  try {
    fd = fs.openSync(filePath, "r");
    const buffer = Buffer.alloc(readLength);
    const bytesRead = fs.readSync(fd, buffer, 0, readLength, start);
    text = buffer.subarray(0, bytesRead).toString("utf8");
  } catch {
    return false;
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch {}
    }
  }
  if (start > 0) {
    const firstNewline = text.indexOf("\n");
    text = firstNewline >= 0 ? text.slice(firstNewline + 1) : "";
  }
  const lines = text.split("\n");
  for (let index = lines.length - 1; index >= 0; index--) {
    let record;
    try { record = JSON.parse(lines[index]); } catch { continue; }
    if (!record || typeof record !== "object" || Array.isArray(record)) continue;
    const payload = record.payload;
    const subtype = payload && typeof payload === "object" ? payload.type || "" : "";
    const key = subtype ? `${record.type}:${subtype}` : record.type;
    const mapped = LOG_EVENT_MAP[key];
    if (mapped === undefined || mapped === null) continue;
    return mapped !== "codex-turn-end" && key !== "event_msg:turn_aborted";
  }
  return false;
}

function cleanStaleFiles() {
  const now = Date.now();
  for (const [filePath, entry] of tracked) {
    if (now - entry.lastEventTime > 300000) {
      if (entry.turnInFlight && now - entry.inFlightStartedAt <= MAX_IN_FLIGHT_STALE_MS) {
        refreshInFlight(entry);
        continue;
      }
      if (!entry.isSubagent && entry.reported) {
        postState(entry.sessionId, "sleeping", "stale-cleanup", entry.cwd);
      }
      tracked.delete(filePath);
    }
  }
}

function poll(recoverExisting = false) {
  const now = Date.now();
  const includeArchive = recoverExisting || now - lastFullDirectoryScan >= FULL_DIRECTORY_SCAN_MS;
  const currentDir = getCurrentSessionDir();
  const dirs = new Set(includeArchive ? getAllSessionDirs() : [currentDir]);
  dirs.add(currentDir);
  if (includeArchive) lastFullDirectoryScan = now;
  for (const filePath of tracked.keys()) dirs.add(path.dirname(filePath));
  for (const dir of dirs) {
    let files;
    try {
      files = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const file of files) {
      if (!file.startsWith("rollout-") || !file.endsWith(".jsonl")) continue;
      const filePath = path.join(dir, file);
      if (!tracked.has(filePath)) {
        try {
          const stat = fs.statSync(filePath);
          if (now - stat.mtimeMs > 120000 &&
              (!recoverExisting || now - stat.mtimeMs > STARTUP_ACTIVE_MAX_AGE_MS ||
                !isLikelyActiveRollout(filePath, stat))) {
            continue;
          }
        } catch { continue; }
      }
      pollFile(filePath, file, recoverExisting);
    }
  }
  cleanStaleFiles();
  scheduleRecoveryDrain();
}

function scheduleRecoveryDrain() {
  if (recoveryDrainImmediate) return;
  if (![...tracked.values()].some(
    (entry) => entry.recovering && entry.offset < entry.recoveryTargetOffset
  )) return;
  recoveryDrainImmediate = setImmediate(() => {
    recoveryDrainImmediate = null;
    let madeProgress = false;
    for (const [filePath, entry] of tracked) {
      if (!entry.recovering) continue;
      const previousOffset = entry.offset;
      pollFile(filePath, path.basename(filePath), false);
      const current = tracked.get(filePath);
      if (current && current.offset > previousOffset) madeProgress = true;
    }
    if (madeProgress) scheduleRecoveryDrain();
  });
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
    if (recoveryDrainImmediate) clearImmediate(recoveryDrainImmediate);
    console.log("\nStopped.");
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    clearInterval(interval);
    if (recoveryDrainImmediate) clearImmediate(recoveryDrainImmediate);
    process.exit(0);
  });
}
