// Codex weekly quota parser and JSONL data source.
// Reads only local Codex rollout logs and uses Node built-ins exclusively.

const fs = require("fs");
const path = require("path");
const os = require("os");

const DEFAULT_SESSION_DIR = "~/.codex/sessions";
// Usage changes much less frequently than task state. A slower poll avoids
// repeatedly walking a large rollout archive while keeping the panel current.
const DEFAULT_POLL_INTERVAL_MS = 30000;
const DEFAULT_MAX_FILES = 50;
const DEFAULT_MAX_READ_BYTES = 2 * 1024 * 1024;
const DEFAULT_RECENT_DAYS = 31;
const DEFAULT_LIMIT_ID = "codex";

function resolveHomePath(value, homedir = os.homedir()) {
  if (!value || value === "~") return value === "~" ? homedir : value;
  if (value.startsWith("~/") || value.startsWith("~\\")) {
    return path.join(homedir, value.slice(2));
  }
  return value;
}

function asFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function collectRateLimitWindows(rateLimits) {
  if (!rateLimits || typeof rateLimits !== "object") return [];

  const windows = [];
  const seen = new Set();

  function visit(value, label, depth) {
    if (!value || typeof value !== "object" || seen.has(value) || depth > 3) return;
    seen.add(value);

    const usedPercent = asFiniteNumber(value.used_percent);
    const windowMinutes = asFiniteNumber(value.window_minutes);
    const resetsAtSeconds = asFiniteNumber(value.resets_at);
    if (usedPercent !== null && windowMinutes !== null && windowMinutes > 0 && resetsAtSeconds !== null) {
      windows.push({ label, usedPercent, windowMinutes, resetsAtSeconds });
    }

    for (const [key, child] of Object.entries(value)) {
      if (child && typeof child === "object") {
        visit(child, label ? `${label}.${key}` : key, depth + 1);
      }
    }
  }

  visit(rateLimits, "rate_limits", 0);
  return windows;
}

function selectLongestWindow(rateLimits) {
  const windows = collectRateLimitWindows(rateLimits);
  if (windows.length === 0) return null;

  return windows.reduce((selected, candidate) => {
    if (candidate.windowMinutes > selected.windowMinutes) return candidate;
    if (
      candidate.windowMinutes === selected.windowMinutes &&
      candidate.resetsAtSeconds > selected.resetsAtSeconds
    ) {
      return candidate;
    }
    return selected;
  });
}

function parseObservedAt(value, fallbackMs) {
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Number.isFinite(fallbackMs) ? fallbackMs : Date.now();
}

function parseQuotaObject(record, options = {}) {
  if (!record || typeof record !== "object") return null;
  if (record.type !== "event_msg") return null;

  const payload = record.payload;
  if (!payload || typeof payload !== "object" || payload.type !== "token_count") return null;

  const rateLimits = payload.rate_limits;
  if (!rateLimits || typeof rateLimits !== "object") return null;
  const limitId = typeof rateLimits.limit_id === "string" && rateLimits.limit_id
    ? rateLimits.limit_id
    : DEFAULT_LIMIT_ID;
  const expectedLimitId = typeof options.expectedLimitId === "string" && options.expectedLimitId
    ? options.expectedLimitId
    : DEFAULT_LIMIT_ID;
  // Codex can emit independent model-specific pools (for example Spark) in
  // the same log stream. The main usage panel must not flicker between pools.
  if (limitId !== expectedLimitId) return null;

  const selected = selectLongestWindow(rateLimits);
  if (!selected) return null;

  const rawUsedPercent = selected.usedPercent;
  const usedPercent = Math.min(100, Math.max(0, rawUsedPercent));
  const remainingPercent = Math.min(100, Math.max(0, 100 - usedPercent));
  const resetsAtMs = Math.round(selected.resetsAtSeconds * 1000);
  if (!Number.isFinite(resetsAtMs)) return null;
  const resetDate = new Date(resetsAtMs);
  if (Number.isNaN(resetDate.getTime())) return null;

  const observedAtMs = parseObservedAt(record.timestamp, options.fallbackObservedAtMs);

  return {
    limitId,
    windowLabel: selected.label,
    windowMinutes: selected.windowMinutes,
    usedPercent,
    remainingPercent,
    resetsAtMs,
    resetAtIso: resetDate.toISOString(),
    observedAtMs,
    cycleId: `${limitId}:${selected.windowMinutes}:${Math.round(selected.resetsAtSeconds)}`,
  };
}

function parseQuotaLine(line, options = {}) {
  if (typeof line !== "string" || !line.trim()) return null;
  try {
    return parseQuotaObject(JSON.parse(line), options);
  } catch {
    return null;
  }
}

function readFileTail(filePath, fsImpl, maxReadBytes) {
  let stat;
  try {
    stat = fsImpl.statSync(filePath);
  } catch {
    return null;
  }
  if (!stat.isFile() || stat.size <= 0) return { text: "", mtimeMs: stat.mtimeMs };

  const readLength = Math.min(stat.size, maxReadBytes);
  const start = stat.size - readLength;
  let descriptor;
  try {
    descriptor = fsImpl.openSync(filePath, "r");
    const buffer = Buffer.alloc(readLength);
    const bytesRead = fsImpl.readSync(descriptor, buffer, 0, readLength, start);
    let text = buffer.subarray(0, bytesRead).toString("utf8");
    // When reading a tail, the first bytes can be a fragment of a JSONL record.
    if (start > 0) {
      const firstNewline = text.indexOf("\n");
      text = firstNewline >= 0 ? text.slice(firstNewline + 1) : "";
    }
    return { text, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  } finally {
    if (descriptor !== undefined) {
      try { fsImpl.closeSync(descriptor); } catch {}
    }
  }
}

function getRecentSessionDirs(sessionDir, options = {}) {
  const dirs = [];
  const recentDays = Number.isInteger(options.recentDays) && options.recentDays > 0
    ? options.recentDays
    : DEFAULT_RECENT_DAYS;
  const now = options.now instanceof Date ? options.now : new Date(options.now || Date.now());

  for (let daysAgo = 0; daysAgo < recentDays; daysAgo++) {
    const date = new Date(now);
    date.setDate(date.getDate() - daysAgo);
    dirs.push(path.join(
      sessionDir,
      String(date.getFullYear()),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ));
  }
  return dirs;
}

function findRolloutFiles(sessionDir, fsImpl, options = {}) {
  const files = [];
  for (const directory of getRecentSessionDirs(sessionDir, options)) {
    let entries;
    try {
      entries = fsImpl.readdirSync(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      if (
        entry.isFile() &&
        entry.name.startsWith("rollout-") &&
        entry.name.endsWith(".jsonl")
      ) {
        try {
          files.push({ filePath: fullPath, mtimeMs: fsImpl.statSync(fullPath).mtimeMs });
        } catch {}
      }
    }
  }
  return files.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readFileTailAsync(filePath, fsPromises, maxReadBytes) {
  let handle;
  try {
    const stat = await fsPromises.stat(filePath);
    if (!stat.isFile() || stat.size <= 0) return { text: "", mtimeMs: stat.mtimeMs };
    const readLength = Math.min(stat.size, maxReadBytes);
    const start = stat.size - readLength;
    handle = await fsPromises.open(filePath, "r");
    const buffer = Buffer.alloc(readLength);
    const { bytesRead } = await handle.read(buffer, 0, readLength, start);
    let text = buffer.subarray(0, bytesRead).toString("utf8");
    if (start > 0) {
      const firstNewline = text.indexOf("\n");
      text = firstNewline >= 0 ? text.slice(firstNewline + 1) : "";
    }
    return { text, mtimeMs: stat.mtimeMs };
  } catch {
    return null;
  } finally {
    if (handle) {
      try { await handle.close(); } catch {}
    }
  }
}

async function findRolloutFilesAsync(sessionDir, fsPromises, options = {}) {
  const files = [];
  for (const directory of getRecentSessionDirs(sessionDir, options)) {
    let entries;
    try {
      entries = await fsPromises.readdir(directory, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.startsWith("rollout-") || !entry.name.endsWith(".jsonl")) continue;
      const filePath = path.join(directory, entry.name);
      try {
        const stat = await fsPromises.stat(filePath);
        files.push({ filePath, mtimeMs: stat.mtimeMs });
      } catch {}
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  return files.sort((left, right) => right.mtimeMs - left.mtimeMs);
}

function findLatestQuota(options = {}) {
  const fsImpl = options.fs || fs;
  const homedir = options.homedir || os.homedir();
  const sessionDir = resolveHomePath(options.sessionDir || DEFAULT_SESSION_DIR, homedir);
  const maxFiles = Number.isInteger(options.maxFiles) && options.maxFiles > 0
    ? options.maxFiles
    : DEFAULT_MAX_FILES;
  const maxReadBytes = Number.isInteger(options.maxReadBytes) && options.maxReadBytes > 0
    ? options.maxReadBytes
    : DEFAULT_MAX_READ_BYTES;

  const files = findRolloutFiles(sessionDir, fsImpl, {
    recentDays: options.recentDays,
    now: options.now,
  }).slice(0, maxFiles);
  let latest = null;

  for (const file of files) {
    const tail = readFileTail(file.filePath, fsImpl, maxReadBytes);
    if (!tail) continue;

    const lines = tail.text.split("\n");
    let fileQuota = null;
    for (let index = lines.length - 1; index >= 0; index--) {
      fileQuota = parseQuotaLine(lines[index], {
        fallbackObservedAtMs: tail.mtimeMs,
        expectedLimitId: options.expectedLimitId,
      });
      if (fileQuota) break;
    }
    if (!fileQuota) continue;

    const withSource = { ...fileQuota, sourceFile: file.filePath };
    if (!latest || withSource.observedAtMs > latest.observedAtMs) latest = withSource;
  }

  return latest;
}

async function findLatestQuotaAsync(options = {}) {
  const homedir = options.homedir || os.homedir();
  const sessionDir = resolveHomePath(options.sessionDir || DEFAULT_SESSION_DIR, homedir);
  const maxFiles = Number.isInteger(options.maxFiles) && options.maxFiles > 0
    ? options.maxFiles
    : DEFAULT_MAX_FILES;
  const maxReadBytes = Number.isInteger(options.maxReadBytes) && options.maxReadBytes > 0
    ? options.maxReadBytes
    : DEFAULT_MAX_READ_BYTES;
  const fsPromises = options.fsPromises || fs.promises;
  const files = (await findRolloutFilesAsync(sessionDir, fsPromises, options)).slice(0, maxFiles);
  let latest = null;

  for (const file of files) {
    const tail = await readFileTailAsync(file.filePath, fsPromises, maxReadBytes);
    if (!tail) continue;
    const lines = tail.text.split("\n");
    let fileQuota = null;
    for (let index = lines.length - 1; index >= 0; index--) {
      fileQuota = parseQuotaLine(lines[index], {
        fallbackObservedAtMs: tail.mtimeMs,
        expectedLimitId: options.expectedLimitId,
      });
      if (fileQuota) break;
    }
    if (fileQuota) {
      const withSource = { ...fileQuota, sourceFile: file.filePath };
      if (!latest || withSource.observedAtMs > latest.observedAtMs) latest = withSource;
    }
    await new Promise((resolve) => setImmediate(resolve));
  }
  return latest;
}

function snapshotsEqual(left, right) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.cycleId === right.cycleId &&
    left.usedPercent === right.usedPercent &&
    left.observedAtMs === right.observedAtMs;
}

function createThresholdCycleKey(quota, threshold) {
  const numericThreshold = asFiniteNumber(threshold);
  if (!quota || typeof quota.cycleId !== "string" || numericThreshold === null) return null;
  return `${quota.cycleId}:remaining-${numericThreshold}`;
}

class CodexQuotaSource {
  constructor(options = {}) {
    this._options = { ...options };
    this._onUpdate = typeof options.onUpdate === "function" ? options.onUpdate : () => {};
    this._pollIntervalMs = Number.isFinite(options.pollIntervalMs) && options.pollIntervalMs > 0
      ? options.pollIntervalMs
      : DEFAULT_POLL_INTERVAL_MS;
    this._snapshot = null;
    this._interval = null;
    this._pollPromise = null;
  }

  start() {
    if (this._interval) return this._snapshot;
    if (this._options.asyncInitialPoll === true) this.pollAsync();
    else this.poll();
    if (this._options.continuousPolling !== false) {
      this._interval = setInterval(
        () => this._options.asyncInitialPoll === true ? this.pollAsync() : this.poll(),
        this._pollIntervalMs
      );
    }
    return this._snapshot;
  }

  stop() {
    if (this._interval) clearInterval(this._interval);
    this._interval = null;
  }

  poll() {
    const snapshot = findLatestQuota(this._options);
    if (snapshot && !snapshotsEqual(snapshot, this._snapshot)) {
      this._snapshot = snapshot;
      this._onUpdate(snapshot);
    }
    return this._snapshot;
  }

  pollAsync() {
    if (this._pollPromise) return this._pollPromise;
    const scan = typeof this._options.findLatestQuotaAsync === "function"
      ? this._options.findLatestQuotaAsync
      : findLatestQuotaAsync;
    this._pollPromise = Promise.resolve()
      .then(() => scan(this._options))
      .then((snapshot) => {
        if (snapshot && !snapshotsEqual(snapshot, this._snapshot)) {
          this._snapshot = snapshot;
          this._onUpdate(snapshot);
        }
        return this._snapshot;
      })
      .catch((err) => {
        if (typeof this._options.onError === "function") this._options.onError(err);
        return this._snapshot;
      })
      .finally(() => { this._pollPromise = null; });
    return this._pollPromise;
  }

  ingestLine(line, metadata = {}) {
    const snapshot = parseQuotaLine(line, {
      fallbackObservedAtMs: metadata.observedAtMs,
      expectedLimitId: this._options.expectedLimitId,
    });
    return this._ingestSnapshot(snapshot, metadata);
  }

  ingestObject(record, metadata = {}) {
    const snapshot = parseQuotaObject(record, {
      fallbackObservedAtMs: metadata.observedAtMs,
      expectedLimitId: this._options.expectedLimitId,
    });
    return this._ingestSnapshot(snapshot, metadata);
  }

  _ingestSnapshot(snapshot, metadata = {}) {
    if (!snapshot) return null;

    const withSource = metadata.sourceFile
      ? { ...snapshot, sourceFile: metadata.sourceFile }
      : snapshot;
    if (!this._snapshot || withSource.observedAtMs >= this._snapshot.observedAtMs) {
      if (!snapshotsEqual(withSource, this._snapshot)) {
        this._snapshot = withSource;
        this._onUpdate(withSource, metadata);
      }
    }
    return withSource;
  }

  getSnapshot() {
    return this._snapshot;
  }
}

module.exports = {
  CodexQuotaSource,
  collectRateLimitWindows,
  createThresholdCycleKey,
  findLatestQuota,
  findLatestQuotaAsync,
  parseQuotaLine,
  parseQuotaObject,
  resolveHomePath,
  selectLongestWindow,
};
