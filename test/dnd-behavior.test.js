const { describe, it } = require("node:test");
const assert = require("node:assert");
const { EventEmitter } = require("node:events");
const Module = require("node:module");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Do Not Disturb behavior", () => {
  it("hands a pending permission back with an empty 2xx response", () => {
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === "electron") return { BrowserWindow: {} };
      return originalLoad.call(this, request, parent, isMain);
    };
    let initPermission;
    try {
      delete require.cache[require.resolve("../src/permission")];
      initPermission = require("../src/permission");
    } finally {
      Module._load = originalLoad;
    }

    const writes = [];
    const api = initPermission({
      win: null,
      focusTerminalForSession() {},
    });
    const entry = {
      sessionId: "s1",
      res: {
        writableEnded: false,
        destroyed: false,
        writeHead: (...args) => writes.push(["writeHead", ...args]),
        end: (...args) => writes.push(["end", ...args]),
      },
      bubble: null,
    };
    api.pendingPermissions.push(entry);

    assert.strictEqual(api.handOffPermissionEntry(entry), true);
    assert.strictEqual(api.pendingPermissions.length, 0);
    assert.deepStrictEqual(writes, [
      ["writeHead", 200, { "x-clawd-server": "clawd-on-desk" }],
      ["end"],
    ]);
  });

  it("hands an existing Claude permission bubble back to the terminal without a decision", async () => {
    const decisions = [];
    const rendererEvents = [];
    const bubbleEvents = [];
    let destroyed = false;
    const responseWrites = [];
    const permission = {
      res: {
        writableEnded: false,
        destroyed: false,
        writeHead: (...args) => responseWrites.push(["writeHead", ...args]),
        end: (...args) => responseWrites.push(["end", ...args]),
      },
      bubble: {
        isDestroyed: () => destroyed,
        destroy: () => { destroyed = true; },
        webContents: { send: (...args) => bubbleEvents.push(args) },
      },
      hideTimer: null,
    };
    const ctx = {
      doNotDisturb: false,
      miniTransitioning: false,
      miniMode: false,
      mouseOverPet: false,
      idlePaused: false,
      forceEyeResend: false,
      mouseStillSince: Date.now(),
      pendingPermissions: [permission],
      resolvePermissionEntry: (...args) => decisions.push(args),
      handOffPermissionEntry: (entry) => {
        ctx.pendingPermissions.splice(ctx.pendingPermissions.indexOf(entry), 1);
        entry.bubble.webContents.send("permission-hide");
        entry.hideTimer = setTimeout(() => entry.bubble.destroy(), 250);
        entry.res.writeHead(200, { "x-clawd-server": "clawd-on-desk" });
        entry.res.end();
      },
      sendToRenderer: (...args) => rendererEvents.push(args),
      sendToHitWin() {},
      syncHitWin() {},
      miniPeekIn() {},
      miniPeekOut() {},
      buildContextMenu() {},
      buildTrayMenu() {},
      t: (key) => key,
      showSessionId: false,
      focusTerminalWindow() {},
    };
    const state = require("../src/state")(ctx);

    state.enableDoNotDisturb();

    assert.strictEqual(ctx.doNotDisturb, true);
    assert.deepStrictEqual(decisions, [], "DND must not allow or deny Claude permissions");
    assert.strictEqual(ctx.pendingPermissions.length, 0, "Mojocarrot should release visual ownership");
    assert.deepStrictEqual(bubbleEvents, [["permission-hide"]]);
    assert.ok(rendererEvents.some(([event, enabled]) => event === "dnd-change" && enabled === true));

    await wait(300);
    assert.strictEqual(destroyed, true);
    assert.deepStrictEqual(responseWrites.map(([method]) => method), ["writeHead", "end"]);
    state.cleanup();
  });

  it("returns an empty success response for new permission hooks during DND", () => {
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

    let api;
    const sessionUpdates = [];
    try {
      delete require.cache[require.resolve("../src/server")];
      const initServer = require("../src/server");
      api = initServer({
        doNotDisturb: true,
        pendingPermissions: [],
        permLog() {},
        updateSession: (...args) => sessionUpdates.push(args),
      });
      api.startHttpServer();
    } finally {
      Module._load = originalLoad;
    }

    const req = new EventEmitter();
    req.method = "POST";
    req.url = "/permission";
    const writes = [];
    const res = {
      writableFinished: false,
      writeHead: (...args) => writes.push(["writeHead", ...args]),
      end: (...args) => writes.push(["end", ...args]),
    };

    requestHandler(req, res);
    req.emit("data", Buffer.from(JSON.stringify({
      tool_name: "Bash",
      tool_input: { command: "git status" },
      session_id: "s1",
    })));
    req.emit("end");

    assert.deepStrictEqual(
      writes,
      [["writeHead", 200, { "x-clawd-server": "clawd-on-desk" }], ["end"]],
      "terminal handoff must finish the hook without an allow/deny JSON body"
    );
    assert.deepStrictEqual(
      sessionUpdates.map(([id, state, event, , , , , , agentId]) => ({ id, state, event, agentId })),
      [{ id: "s1", state: "notification", event: "PermissionRequest", agentId: "claude-code" }],
      "manual activity panel should still show the waiting session during DND"
    );
    api.cleanup();
  });

  it("keeps DND enabled when exiting mini mode", async () => {
    const appliedStates = [];
    const rendererEvents = [];
    const hitEvents = [];
    const originalLoad = Module._load;
    Module._load = function (request, parent, isMain) {
      if (request === "electron") {
        return {
          screen: {
            getAllDisplays: () => [{
              bounds: { x: 0, y: 0, width: 1200, height: 800 },
              workArea: { x: 0, y: 0, width: 1200, height: 760 },
            }],
          },
        };
      }
      return originalLoad.call(this, request, parent, isMain);
    };

    let initMini;
    try {
      delete require.cache[require.resolve("../src/mini")];
      initMini = require("../src/mini");
    } finally {
      Module._load = originalLoad;
    }

    const bounds = { x: 1100, y: 200, width: 200, height: 200 };
    const ctx = {
      doNotDisturb: true,
      win: {
        getBounds: () => ({ ...bounds }),
        setPosition: (x, y) => { bounds.x = x; bounds.y = y; },
        setBounds: (next) => Object.assign(bounds, next),
        isDestroyed: () => false,
      },
      SIZES: { medium: { width: 200, height: 200 } },
      currentSize: "medium",
      pendingPermissions: [],
      bubbleFollowPet: false,
      clampToScreen: (x, y) => ({ x, y }),
      getNearestWorkArea: () => ({ x: 0, y: 0, width: 1200, height: 760 }),
      sendToRenderer: (...args) => rendererEvents.push(args),
      sendToHitWin: (...args) => hitEvents.push(args),
      syncHitWin() {},
      repositionBubbles() {},
      buildContextMenu() {},
      buildTrayMenu() {},
      stopWakePoll() {},
      applyState: (...args) => appliedStates.push(args),
      resolveDisplayState: () => "working",
      getSvgOverride: () => "clawd-working-typing.svg",
    };
    const mini = initMini(ctx);
    mini.restoreFromPrefs({ x: 1100, y: 200, preMiniX: 400, preMiniY: 200, miniEdge: "right" }, ctx.SIZES.medium);

    mini.exitMiniMode();
    await wait(450);

    assert.strictEqual(mini.getMiniMode(), false);
    assert.strictEqual(ctx.doNotDisturb, true);
    assert.deepStrictEqual(appliedStates.at(-1), ["sleeping"]);
    assert.ok(rendererEvents.some(([event, enabled]) => event === "mini-mode-change" && enabled === false));
    assert.ok(!rendererEvents.some(([event]) => event === "dnd-change"));
    assert.ok(!hitEvents.some(([event, payload]) => event === "hit-state-sync" && payload.dndEnabled === false));
    mini.cleanup();
  });
});
