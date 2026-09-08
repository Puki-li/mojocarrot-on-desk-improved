const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const CLAWD_SERVER_ID = "clawd-on-desk";
const CLAWD_SERVER_HEADER = "x-clawd-server";
const CLAWD_AUTH_HEADER = "x-clawd-token";
const DEFAULT_SERVER_PORT = 23333;
const SERVER_PORT_COUNT = 5;
const SERVER_PORTS = Array.from({ length: SERVER_PORT_COUNT }, (_, i) => DEFAULT_SERVER_PORT + i);
const STATE_PATH = "/state";
const PERMISSION_PATH = "/permission";
const RUNTIME_CONFIG_PATH = path.join(os.homedir(), ".clawd", "runtime.json");
const AUTH_TOKEN_PATH = path.join(os.homedir(), ".clawd", "auth-token");
const AUTH_TOKEN_PATTERN = /^[a-f0-9]{64}$/;

function normalizePort(value) {
  const port = Number(value);
  return Number.isInteger(port) && SERVER_PORTS.includes(port) ? port : null;
}

const HOST_PREFIX_PATH = path.join(os.homedir(), ".claude", "hooks", "clawd-host-prefix");

function readHostPrefix() {
  let prefix = null;
  try { prefix = fs.readFileSync(HOST_PREFIX_PATH, "utf8").trim(); } catch {}
  return prefix || os.hostname().split(".")[0];
}

function readRuntimeConfig() {
  try {
    const raw = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, "utf8"));
    if (!raw || typeof raw !== "object") return null;
    const port = normalizePort(raw.port);
    return port ? { port } : null;
  } catch {
    return null;
  }
}

function readRuntimePort() {
  const config = readRuntimeConfig();
  return config ? config.port : null;
}

function writeRuntimeConfig(port) {
  const safePort = normalizePort(port);
  if (!safePort) return false;

  const dir = path.dirname(RUNTIME_CONFIG_PATH);
  const tmpPath = path.join(dir, `.runtime.${process.pid}.${Date.now()}.tmp`);
  const body = JSON.stringify({ app: CLAWD_SERVER_ID, port: safePort }, null, 2);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(tmpPath, body, { encoding: "utf8", mode: 0o600 });
    fs.renameSync(tmpPath, RUNTIME_CONFIG_PATH);
    try { fs.chmodSync(RUNTIME_CONFIG_PATH, 0o600); } catch {}
    return true;
  } catch {
    try { fs.unlinkSync(tmpPath); } catch {}
    return false;
  }
}

function readAuthToken(filePath = AUTH_TOKEN_PATH) {
  const envToken = typeof process.env.CLAWD_AUTH_TOKEN === "string"
    ? process.env.CLAWD_AUTH_TOKEN.trim().toLowerCase()
    : "";
  if (AUTH_TOKEN_PATTERN.test(envToken)) return envToken;
  try {
    const token = fs.readFileSync(filePath, "utf8").trim().toLowerCase();
    return AUTH_TOKEN_PATTERN.test(token) ? token : null;
  } catch {
    return null;
  }
}

function getOrCreateAuthToken(filePath = AUTH_TOKEN_PATH) {
  const existing = readAuthToken(filePath);
  if (existing) {
    // A token created by an older release (or restored from backup) may have
    // inherited permissive mode bits. Keep valid tokens stable while healing
    // their on-disk permissions before they are embedded in hook settings.
    try { fs.chmodSync(filePath, 0o600); } catch {}
    return existing;
  }
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  for (let createAttempt = 0; createAttempt < 3; createAttempt++) {
    const token = crypto.randomBytes(32).toString("hex");
    const tmpPath = path.join(dir, `.auth-token.${process.pid}.${Date.now()}.${createAttempt}.tmp`);
    let descriptor;
    try {
      descriptor = fs.openSync(tmpPath, "wx", 0o600);
      fs.writeFileSync(descriptor, token, "utf8");
      try { fs.fsyncSync(descriptor); } catch {}
      fs.closeSync(descriptor);
      descriptor = undefined;
      // A hard link publishes only the already-complete token and fails if a
      // concurrent process has won, avoiding a visible partial target file.
      fs.linkSync(tmpPath, filePath);
      try { fs.chmodSync(filePath, 0o600); } catch {}
      return token;
    } catch (err) {
      if (!err || err.code !== "EEXIST") throw err;
    } finally {
      if (descriptor !== undefined) {
        try { fs.closeSync(descriptor); } catch {}
      }
      try { fs.unlinkSync(tmpPath); } catch {}
    }

    // Another process may still be publishing. Give it a short grace period
    // before treating the target as a stale/corrupt file from an interrupted
    // older launch.
    for (let waitAttempt = 0; waitAttempt < 20; waitAttempt++) {
      const winner = readAuthToken(filePath);
      if (winner) return winner;
      try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5); } catch {}
    }
    const invalidPath = `${filePath}.invalid.${process.pid}.${Date.now()}`;
    try {
      fs.renameSync(filePath, invalidPath);
      try { fs.unlinkSync(invalidPath); } catch {}
    } catch (err) {
      if (!err || err.code !== "ENOENT") throw err;
    }
  }
  throw new Error("unable to create a valid authentication token");
}

function clearRuntimeConfig(filePath = RUNTIME_CONFIG_PATH) {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function getPortCandidates(preferredPort, options = {}) {
  const ports = [];
  const seen = new Set();
  const runtimePort = normalizePort(
    Object.prototype.hasOwnProperty.call(options, "runtimePort")
      ? options.runtimePort
      : readRuntimePort()
  );
  const add = (value) => {
    const port = normalizePort(value);
    if (!port || seen.has(port)) return;
    seen.add(port);
    ports.push(port);
  };

  if (Array.isArray(preferredPort)) preferredPort.forEach(add);
  else add(preferredPort);
  add(runtimePort);
  SERVER_PORTS.forEach(add);
  return ports;
}

function splitPortCandidates(preferredPort, options = {}) {
  const runtimePort = normalizePort(
    Object.prototype.hasOwnProperty.call(options, "runtimePort")
      ? options.runtimePort
      : readRuntimePort()
  );
  const all = getPortCandidates(preferredPort, { runtimePort });
  const direct = [];
  const fallback = [];
  const directSeen = new Set();

  const addDirect = (port) => {
    if (!port || directSeen.has(port)) return;
    directSeen.add(port);
    direct.push(port);
  };

  if (Array.isArray(preferredPort)) preferredPort.forEach((port) => addDirect(normalizePort(port)));
  else addDirect(normalizePort(preferredPort));
  addDirect(runtimePort);

  for (const port of all) {
    if (directSeen.has(port)) continue;
    fallback.push(port);
  }

  return { direct, fallback, all };
}

function buildPermissionUrl(port, authToken = readAuthToken()) {
  const safePort = normalizePort(port) || DEFAULT_SERVER_PORT;
  const base = `http://127.0.0.1:${safePort}${PERMISSION_PATH}`;
  return AUTH_TOKEN_PATTERN.test(String(authToken || ""))
    ? `${base}?token=${encodeURIComponent(authToken)}`
    : base;
}

function readHeader(res, headerName) {
  const value = res.headers && res.headers[headerName];
  return Array.isArray(value) ? value[0] : value;
}

function isClawdResponse(res, body) {
  if (readHeader(res, CLAWD_SERVER_HEADER) === CLAWD_SERVER_ID) return true;
  if (!body) return false;
  try {
    const data = JSON.parse(body);
    return data && data.app === CLAWD_SERVER_ID;
  } catch {
    return false;
  }
}

function onceCallback(callback) {
  let called = false;
  return (...args) => {
    if (called) return;
    called = true;
    callback(...args);
  };
}

function probePort(port, timeoutMs, callback, options = {}) {
  const finish = onceCallback(callback);
  const httpGet = options.httpGet || http.get;
  const req = httpGet(
    { hostname: "127.0.0.1", port, path: STATE_PATH, timeout: timeoutMs },
    (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (body.length < 256) body += chunk;
      });
      res.on("end", () => finish(isClawdResponse(res, body)));
    }
  );

  req.on("error", () => finish(false));
  req.on("timeout", () => {
    req.destroy();
    finish(false);
  });
}

function postStateToPort(port, payload, timeoutMs, callback, options = {}) {
  const finish = onceCallback(callback);
  const httpRequest = options.httpRequest || http.request;
  const authToken = options.authToken || readAuthToken();
  const headers = {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  };
  if (AUTH_TOKEN_PATTERN.test(String(authToken || ""))) headers[CLAWD_AUTH_HEADER] = authToken;
  const req = httpRequest(
    {
      hostname: "127.0.0.1",
      port,
      path: STATE_PATH,
      method: "POST",
      headers,
      timeout: timeoutMs,
    },
    (res) => {
      const successful = Number(res.statusCode) >= 200 && Number(res.statusCode) < 300;
      if (successful && readHeader(res, CLAWD_SERVER_HEADER) === CLAWD_SERVER_ID) {
        res.resume();
        finish(true, port);
        return;
      }

      let responseBody = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (responseBody.length < 256) responseBody += chunk;
      });
      res.on("end", () => finish(successful && isClawdResponse(res, responseBody), port));
    }
  );

  req.on("error", () => finish(false, port));
  req.on("timeout", () => {
    req.destroy();
    finish(false, port);
  });
  req.end(payload);
}

function discoverClawdPort(options, callback) {
  const finish = onceCallback(callback);
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 100;
  const ports = getPortCandidates(options && options.preferredPort, options);
  const probe = options && options.probePort ? options.probePort : probePort;
  let index = 0;

  const tryNext = () => {
    if (index >= ports.length) {
      finish(null);
      return;
    }

    const port = ports[index++];
    probe(port, timeoutMs, onceCallback((ok) => {
      if (ok) {
        finish(port);
        return;
      }
      tryNext();
    }), options);
  };

  tryNext();
}

function postStateToRunningServer(body, options, callback) {
  const finish = onceCallback(callback);
  const timeoutMs = options && options.timeoutMs ? options.timeoutMs : 100;
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const { direct, fallback } = splitPortCandidates(options && options.preferredPort, options);
  const probe = options && options.probePort ? options.probePort : probePort;
  const post = options && options.postStateToPort ? options.postStateToPort : postStateToPort;
  let directIndex = 0;
  let fallbackIndex = 0;

  const tryFallback = () => {
    if (fallbackIndex >= fallback.length) {
      finish(false, null);
      return;
    }

    const port = fallback[fallbackIndex++];
    probe(port, timeoutMs, onceCallback((ok) => {
      if (!ok) {
        tryFallback();
        return;
      }
      post(port, payload, timeoutMs, onceCallback((posted, confirmedPort) => {
        if (posted) {
          finish(true, confirmedPort);
          return;
        }
        tryFallback();
      }), options);
    }), options);
  };

  const tryDirect = () => {
    if (directIndex >= direct.length) {
      tryFallback();
      return;
    }

    const port = direct[directIndex++];
    post(port, payload, timeoutMs, onceCallback((posted, confirmedPort) => {
      if (posted) {
        finish(true, confirmedPort);
        return;
      }
      tryDirect();
    }), options);
  };

  tryDirect();
}

module.exports = {
  AUTH_TOKEN_PATH,
  AUTH_TOKEN_PATTERN,
  CLAWD_AUTH_HEADER,
  CLAWD_SERVER_HEADER,
  CLAWD_SERVER_ID,
  DEFAULT_SERVER_PORT,
  PERMISSION_PATH,
  RUNTIME_CONFIG_PATH,
  SERVER_PORTS,
  STATE_PATH,
  buildPermissionUrl,
  clearRuntimeConfig,
  discoverClawdPort,
  getPortCandidates,
  getOrCreateAuthToken,
  postStateToRunningServer,
  probePort,
  readHostPrefix,
  readAuthToken,
  readRuntimePort,
  splitPortCandidates,
  postStateToPort,
  writeRuntimeConfig,
};
