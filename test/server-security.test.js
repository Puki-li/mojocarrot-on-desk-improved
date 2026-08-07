const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Module = require("node:module");

function createHarness(overrides = {}) {
  let requestHandler;
  const fakeServer = new EventEmitter();
  fakeServer.listen = () => {};
  fakeServer.close = () => {};
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "http") {
      return {
        createServer(handler) {
          requestHandler = handler;
          return fakeServer;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };

  const pendingPermissions = overrides.pendingPermissions || [];
  const ctx = {
    authToken: "test-token",
    doNotDisturb: false,
    hideBubbles: false,
    pendingPermissions,
    PASSTHROUGH_TOOLS: new Set(),
    STATE_SVGS: { idle: "idle.svg", working: "working.svg" },
    sessions: new Map(),
    permLog() {},
    updateSession() {},
    setState() {},
    showPermissionBubble() {},
    sendPermissionResponse(res, behavior, message) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ behavior, message }));
    },
    resolvePermissionEntry(entry, behavior, message) {
      const index = pendingPermissions.indexOf(entry);
      if (index >= 0) pendingPermissions.splice(index, 1);
      if (entry.requestTimeout) clearTimeout(entry.requestTimeout);
      this.sendPermissionResponse(entry.res, behavior, message);
    },
    ...overrides,
  };

  let api;
  try {
    delete require.cache[require.resolve("../src/server")];
    api = require("../src/server")(ctx);
    api.startHttpServer();
  } finally {
    Module._load = originalLoad;
  }
  return { api, ctx, requestHandler };
}

function makeRequest(url, body, headers = {}) {
  const req = new EventEmitter();
  req.method = "POST";
  req.url = url;
  req.headers = headers;
  req.setTimeout = (_ms, callback) => { req.timeoutCallback = callback; };
  req.destroyed = false;
  req.destroy = () => { req.destroyed = true; };
  const writes = [];
  const res = new EventEmitter();
  res.writableEnded = false;
  res.writableFinished = false;
  res.writeHead = (...args) => writes.push(["writeHead", ...args]);
  res.end = (...args) => {
    res.writableEnded = true;
    res.writableFinished = true;
    writes.push(["end", ...args]);
  };
  return {
    req,
    res,
    writes,
    send(handler) {
      handler(req, res);
      if (!res.writableEnded && body !== undefined) req.emit("data", Buffer.from(JSON.stringify(body)));
      if (!res.writableEnded) req.emit("end");
    },
  };
}

test("protected HTTP routes reject unauthenticated and non-JSON requests", () => {
  const { api, requestHandler } = createHarness();
  const unauthenticated = makeRequest("/state", { state: "idle" }, { "content-type": "application/json" });
  unauthenticated.send(requestHandler);
  assert.strictEqual(unauthenticated.writes[0][1], 401);

  const wrongType = makeRequest("/state?token=test-token", { state: "idle" }, { "content-type": "text/plain" });
  wrongType.send(requestHandler);
  assert.strictEqual(wrongType.writes[0][1], 415);
  api.cleanup();
});

test("authenticated state requests are accepted", () => {
  const updates = [];
  const { api, requestHandler } = createHarness({ updateSession: (...args) => updates.push(args) });
  const request = makeRequest("/state", {
    state: "working",
    session_id: "s1",
    event: "PreToolUse",
    agent_id: "claude-code",
  }, {
    "content-type": "application/json",
    "x-clawd-token": "test-token",
  });
  request.send(requestHandler);
  assert.strictEqual(request.writes[0][1], 200);
  assert.strictEqual(updates.length, 1);
  api.cleanup();
});

test("a timed-out request cannot mutate state when data arrives later", () => {
  const updates = [];
  const { api, requestHandler } = createHarness({ updateSession: (...args) => updates.push(args) });
  const request = makeRequest("/state?token=test-token", undefined, { "content-type": "application/json" });
  requestHandler(request.req, request.res);
  request.req.timeoutCallback();
  request.req.emit("data", Buffer.from(JSON.stringify({ state: "working", session_id: "late" })));
  request.req.emit("end");
  assert.strictEqual(request.req.destroyed, true);
  assert.strictEqual(updates.length, 0);
  assert.strictEqual(request.writes.filter(([method]) => method === "writeHead").length, 1);
  assert.strictEqual(request.writes[0][1], 408);
  api.cleanup();
});

test("permission requests are capped globally", () => {
  const pendingPermissions = Array.from({ length: 8 }, (_, index) => ({
    sessionId: `existing-${index}`,
    isCodexNotify: false,
  }));
  const { api, requestHandler } = createHarness({ pendingPermissions });
  const request = makeRequest("/permission?token=test-token", {
    tool_name: "Bash",
    tool_input: { command: "git status" },
    session_id: "new-session",
  }, { "content-type": "application/json" });
  request.send(requestHandler);
  assert.strictEqual(request.writes[0][1], 429);
  assert.strictEqual(pendingPermissions.length, 8);
  api.cleanup();
});

test("pending permission requests are released by the server timeout", async () => {
  const settled = [];
  const { api, ctx, requestHandler } = createHarness({
    hideBubbles: true,
    permissionRequestTimeoutMs: 10,
  });
  const originalResolve = ctx.resolvePermissionEntry.bind(ctx);
  ctx.resolvePermissionEntry = (entry, behavior, message) => {
    settled.push({ behavior, message });
    originalResolve(entry, behavior, message);
  };
  const request = makeRequest("/permission?token=test-token", {
    tool_name: "Bash",
    tool_input: { command: "git status" },
    session_id: "s1",
  }, { "content-type": "application/json" });
  request.send(requestHandler);
  assert.strictEqual(ctx.pendingPermissions.length, 1);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.strictEqual(ctx.pendingPermissions.length, 0);
  assert.deepStrictEqual(settled, [{ behavior: "deny", message: "Permission request timed out" }]);
  api.cleanup();
});
