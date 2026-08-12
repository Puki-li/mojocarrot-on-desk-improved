// Codex CLI JSONL log monitor
// Polls ~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl for state changes
// Zero dependencies (node built-ins only)

const fs = require("fs");
const path = require("path");
const os = require("os");
const { resolveCodexEventState } = require("../hooks/codex-event-map");

const IN_FLIGHT_HEARTBEAT_MS = 30000;
const MAX_IN_FLIGHT_STALE_MS = 6 * 60 * 60 * 1000;
const FULL_DIRECTORY_SCAN_MS = 60000;
const DEFAULT_MAX_READ_BYTES_PER_POLL = 256 * 1024;

class CodexLogMonitor {
  /**
   * @param {object} agentConfig - codex.js config (logConfig + logEventMap)
   * @param {function} onStateChange - (sessionId, state, event, extra) => void
   * @param {function|null} onRecord - optional raw-record consumer for shared JSONL-derived data
   */
  constructor(agentConfig, onStateChange, onRecord = null) {
    this._config = agentConfig;
    this._onStateChange = onStateChange;
    this._onRecord = typeof onRecord === "function" ? onRecord : null;
    this._interval = null;
    this._recoveryDrainImmediate = null;
    // Map<filePath, { offset, sessionId, cwd, lastEventTime, lastState, partial }>
    this._tracked = new Map();
    this._baseDir = this._resolveBaseDir();
    this._lastFullDirectoryScan = 0;
  }

  _resolveBaseDir() {
    const dir = this._config.logConfig.sessionDir;
    if (dir.startsWith("~")) {
      return path.join(os.homedir(), dir.slice(1));
    }
    return dir;
  }

  start() {
    if (this._interval) return;
    // Existing logs are state recovery, not fresh activity. Replaying every
    // historical task_complete would create false completion notifications.
    const recoverExisting = this._config.logConfig.recoverExistingFiles !== false;
    this._poll(recoverExisting);
    this._interval = setInterval(
      () => this._poll(false),
      this._config.logConfig.pollIntervalMs || 1500
    );
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
    if (this._recoveryDrainImmediate) {
      clearImmediate(this._recoveryDrainImmediate);
      this._recoveryDrainImmediate = null;
    }
    this._tracked.clear();
  }

  _poll(recoverExisting = false) {
    const now = Date.now();
    const allDirs = this._getSessionDirs();
    const includeArchive = recoverExisting || now - this._lastFullDirectoryScan >= FULL_DIRECTORY_SCAN_MS;
    const dirs = new Set(includeArchive ? allDirs : allDirs.slice(0, 1));
    if (includeArchive) this._lastFullDirectoryScan = now;
    for (const filePath of this._tracked.keys()) dirs.add(path.dirname(filePath));
    for (const dir of dirs) {
      let files;
      try {
        files = fs.readdirSync(dir);
      } catch {
        continue; // directory doesn't exist yet
      }
      for (const file of files) {
        if (!file.startsWith("rollout-") || !file.endsWith(".jsonl")) continue;
        const filePath = path.join(dir, file);
        // Skip files we're not already tracking if they haven't been written recently
        if (!this._tracked.has(filePath)) {
          try {
            const mtime = fs.statSync(filePath).mtimeMs;
            if (now - mtime > 120000) continue; // older than 2 min — completed session, skip
          } catch { continue; }
        }
        this._pollFile(filePath, file, recoverExisting);
      }
    }
    this._cleanStaleFiles();
    this._scheduleRecoveryDrain();
  }

  _scheduleRecoveryDrain() {
    if (this._recoveryDrainImmediate) return;
    const hasRecovering = [...this._tracked.values()].some(
      (entry) => entry.recovering && entry.offset < entry.recoveryTargetOffset
    );
    if (!hasRecovering) return;
    // Large rollouts can be tens of megabytes. Drain them in small event-loop
    // slices instead of waiting 1.5s between every 256KB chunk. This keeps the
    // Electron main thread responsive without replaying minutes of old states.
    this._recoveryDrainImmediate = setImmediate(() => {
      this._recoveryDrainImmediate = null;
      for (const [filePath, tracked] of this._tracked) {
        if (!tracked.recovering) continue;
        this._pollFile(filePath, path.basename(filePath), false);
      }
      this._scheduleRecoveryDrain();
    });
  }

  // Scan recent directories (supports codex resume of older sessions)
  _getSessionDirs() {
    const dirs = [];
    const now = new Date();
    for (let daysAgo = 0; daysAgo <= 30; daysAgo++) {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      dirs.push(path.join(this._baseDir, String(yyyy), mm, dd));
    }
    return dirs;
  }

  _pollFile(filePath, fileName, recoverExisting = false) {
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return;
    }

    let tracked = this._tracked.get(filePath);
    if (!tracked) {
      // New file — extract session ID from filename
      // Format: rollout-YYYY-MM-DDTHH-MM-SS-<uuid>.jsonl
      const sessionId = this._extractSessionId(fileName);
      if (!sessionId) return;
      tracked = {
        offset: 0,
        sessionId: "codex:" + sessionId,
        cwd: "",
        lastEventTime: Date.now(),
        lastState: null,
        partial: "", // incomplete line buffer
        hadToolUse: false,
        isSubagent: false,
        reported: false,
        lastEventKey: null,
        turnInFlight: false,
        inFlightStartedAt: 0,
        lastHeartbeatAt: 0,
        device: stat.dev,
        inode: stat.ino,
        mtimeMs: stat.mtimeMs,
        // Every pre-existing byte is a bootstrap snapshot, even when the file
        // was discovered after app startup. Parse it silently and publish only
        // the final effective state once the monitor reaches the live tail.
        recovering: stat.size > 0,
        recoveryKind: recoverExisting ? "startup" : "bootstrap",
        recoveryTargetOffset: stat.size,
        lastEventOccurredAtMs: null,
      };
      this._tracked.set(filePath, tracked);
    }

    const identityChanged = tracked.device !== stat.dev || tracked.inode !== stat.ino;
    const rewrittenAtSameSize = stat.size === tracked.offset && stat.mtimeMs > tracked.mtimeMs;
    if (identityChanged || stat.size < tracked.offset || rewrittenAtSameSize) {
      tracked.offset = 0;
      tracked.partial = "";
      tracked.device = stat.dev;
      tracked.inode = stat.ino;
      tracked.lastState = null;
      tracked.lastEventKey = null;
      tracked.lastEventOccurredAtMs = null;
      tracked.hadToolUse = false;
      tracked.turnInFlight = false;
      tracked.inFlightStartedAt = 0;
      tracked.recovering = stat.size > 0;
      tracked.recoveryKind = "bootstrap";
      tracked.recoveryTargetOffset = stat.size;
    }

    // Bytes appended while catch-up is running are still part of the snapshot.
    // Extending the boundary prevents them from being replayed as fresh UI
    // transitions after an earlier completion notification.
    if (tracked.recovering && stat.size > tracked.recoveryTargetOffset) {
      tracked.recoveryTargetOffset = stat.size;
    }

    // No new data. Refresh the state machine while a turn is explicitly open
    // so a legitimate long model/tool run is not mistaken for an idle session.
    const readableEnd = tracked.recovering
      ? Math.min(stat.size, tracked.recoveryTargetOffset)
      : stat.size;
    if (readableEnd === tracked.offset) {
      tracked.mtimeMs = stat.mtimeMs;
      this._finishRecovery(tracked);
      this._refreshInFlight(tracked);
      return;
    }

    // Read incremental bytes
    let buf;
    let fd;
    try {
      fd = fs.openSync(filePath, "r");
      const configuredMax = this._config.logConfig.maxReadBytesPerPoll;
      const maxReadBytes = Number.isInteger(configuredMax) && configuredMax > 0
        ? configuredMax
        : DEFAULT_MAX_READ_BYTES_PER_POLL;
      const readLen = Math.min(readableEnd - tracked.offset, maxReadBytes);
      buf = Buffer.alloc(readLen);
      const bytesRead = fs.readSync(fd, buf, 0, readLen, tracked.offset);
      if (bytesRead <= 0) return;
      if (bytesRead < buf.length) buf = buf.subarray(0, bytesRead);
    } catch {
      return;
    } finally {
      if (fd !== undefined) {
        try { fs.closeSync(fd); } catch {}
      }
    }
    tracked.offset += buf.length;
    tracked.mtimeMs = stat.mtimeMs;

    // Split into lines, handle partial last line
    const text = tracked.partial + buf.toString("utf8");
    const lines = text.split("\n");
    // Last element might be incomplete — save for next poll
    tracked.partial = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      this._processLine(line, tracked, !tracked.recovering);
    }

    this._finishRecovery(tracked);
  }

  _finishRecovery(tracked) {
    if (!tracked.recovering || tracked.offset < tracked.recoveryTargetOffset) return;
    if (tracked.partial) return;
    const recoveryKind = tracked.recoveryKind;
    tracked.recovering = false;
    tracked.recoveryKind = null;
    // On startup, recover only the final active state. Completed/idle history
    // is intentionally silent; appended events after the snapshot are real-time.
    const isActive = tracked.lastState === "working" || tracked.lastState === "thinking";
    const isFreshTerminalTurn = recoveryKind === "bootstrap" &&
      (tracked.lastEventKey === "event_msg:task_complete" ||
        tracked.lastEventKey === "event_msg:turn_aborted");
    if (!tracked.isSubagent && (isActive || isFreshTerminalTurn)) {
      tracked.reported = true;
      tracked.lastHeartbeatAt = Date.now();
      this._onStateChange(tracked.sessionId, tracked.lastState, tracked.lastEventKey || "recovered", {
        cwd: tracked.cwd,
        sourcePid: null,
        agentPid: null,
        recovered: true,
        occurredAtMs: tracked.lastEventOccurredAtMs,
      });
    }
  }

  _processLine(line, tracked, emit = true) {
    let obj;
    try {
      obj = JSON.parse(line);
    } catch {
      return; // corrupted line, skip
    }
    if (this._onRecord) {
      try {
        this._onRecord(obj, {
          sessionId: tracked.sessionId,
          cwd: tracked.cwd,
          observedAtMs: Date.now(),
          recovering: tracked.recovering,
        });
      } catch {}
    }

    const type = obj.type;
    const payload = obj.payload;
    const subtype =
      payload && typeof payload === "object" ? payload.type || "" : "";

    // Build lookup key
    const key = subtype ? type + ":" + subtype : type;

    // Extract CWD from session_meta
    if (type === "session_meta" && payload) {
      tracked.cwd = payload.cwd || "";
      tracked.isSubagent = payload.thread_source === "subagent" ||
        !!(payload.source && typeof payload.source === "object" && payload.source.subagent);
    }

    // Internal Codex subagents copy parent history into their own rollout.
    // They are implementation details of the same user turn, not additional
    // user-visible sessions, and must never generate completion alerts.
    if (tracked.isSubagent) return;

    const now = Date.now();
    const parsedOccurredAtMs = Date.parse(obj.timestamp);
    const occurredAtMs = Number.isFinite(parsedOccurredAtMs) ? parsedOccurredAtMs : now;
    tracked.lastEventTime = now;
    if (key === "event_msg:task_started" || key === "event_msg:user_message") {
      tracked.turnInFlight = true;
      tracked.inFlightStartedAt = now;
    } else if (key === "event_msg:task_complete" || key === "event_msg:turn_aborted") {
      tracked.turnInFlight = false;
      tracked.inFlightStartedAt = 0;
    }

    const mappedState = this._config.logEventMap[key];
    if (mappedState === undefined || mappedState === null) return;
    const state = resolveCodexEventState(key, tracked);
    tracked.lastEventKey = key;
    tracked.lastEventOccurredAtMs = occurredAtMs;

    // Turn-end: happy if tools were used this turn, idle otherwise.
    if (mappedState === "codex-turn-end") {
      tracked.lastState = state;
      if (emit) {
        tracked.reported = true;
        this._onStateChange(tracked.sessionId, state, key, {
          cwd: tracked.cwd,
          sourcePid: null,
          agentPid: null,
          occurredAtMs,
        });
      }
      return;
    }

    tracked.lastState = state;

    if (emit) {
      tracked.reported = true;
      tracked.lastHeartbeatAt = now;
      this._onStateChange(tracked.sessionId, state, key, {
        cwd: tracked.cwd,
        sourcePid: null, // JSONL doesn't contain terminal PID
        agentPid: null, // can't reliably match from log file
        occurredAtMs,
      });
    }
  }

  _refreshInFlight(tracked) {
    if (!tracked.turnInFlight || !tracked.reported) return;
    const now = Date.now();
    if (now - tracked.inFlightStartedAt > MAX_IN_FLIGHT_STALE_MS) return;
    if (now - tracked.lastHeartbeatAt < IN_FLIGHT_HEARTBEAT_MS) return;
    const state = tracked.lastState === "working" ? "working" : "thinking";
    tracked.lastHeartbeatAt = now;
    tracked.lastEventTime = now;
    this._onStateChange(tracked.sessionId, state, "codex-heartbeat", {
      cwd: tracked.cwd,
      sourcePid: null,
      agentPid: null,
      heartbeat: true,
      occurredAtMs: now,
    });
  }

  // Extract shell command from function_call payload
  // payload.arguments is a JSON string: {"command":"...","workdir":"...","timeout_ms":...}
  _extractShellCommand(payload) {
    if (!payload || typeof payload !== "object") return "";
    if (payload.name !== "shell_command") return "";
    try {
      const args = typeof payload.arguments === "string"
        ? JSON.parse(payload.arguments) : payload.arguments;
      if (args && args.command) return String(args.command);
    } catch {}
    return "";
  }

  // Extract UUID from rollout filename
  // rollout-2026-03-25T15-10-51-019d23d4-f1a9-7633-b9c7-758327137228.jsonl
  _extractSessionId(fileName) {
    // UUID v7 is the last 5 segments of the filename (before .jsonl)
    const base = fileName.replace(".jsonl", "");
    const parts = base.split("-");
    // UUID: last 5 parts (8-4-4-4-12 hex)
    if (parts.length < 10) return null;
    return parts.slice(-5).join("-");
  }

  // Remove files not updated for 5 minutes
  _cleanStaleFiles() {
    const now = Date.now();
    for (const [filePath, tracked] of this._tracked) {
      const age = now - tracked.lastEventTime;
      if (age > 300000) {
        if (tracked.turnInFlight && now - tracked.inFlightStartedAt <= MAX_IN_FLIGHT_STALE_MS) {
          this._refreshInFlight(tracked);
          continue;
        }
        // 5 min stale — notify session end and stop tracking
        if (!tracked.isSubagent && tracked.reported) {
          this._onStateChange(tracked.sessionId, "sleeping", "stale-cleanup", {
            cwd: tracked.cwd,
            sourcePid: null,
            agentPid: null,
          });
        }
        this._tracked.delete(filePath);
      }
    }
  }
}

module.exports = CodexLogMonitor;
