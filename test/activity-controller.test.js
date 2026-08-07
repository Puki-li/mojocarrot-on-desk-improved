const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const Module = require("node:module");

test("activity controller keeps the status pill visible and opens the panel on demand", () => {
  const ipcMain = new EventEmitter();
  ipcMain.removeListener = EventEmitter.prototype.removeListener;
  const windows = [];

  class FakeWebContents extends EventEmitter {
    constructor() { super(); this.messages = []; }
    send(...args) { this.messages.push(args); }
    isLoading() { return false; }
    reload() {}
  }

  class FakeBrowserWindow extends EventEmitter {
    constructor(options) {
      super();
      this.options = options;
      this.bounds = { x: 0, y: 0, width: options.width, height: options.height };
      this.visible = false;
      this.destroyed = false;
      this.webContents = new FakeWebContents();
      windows.push(this);
    }
    setFocusable() {}
    setMenuBarVisibility() {}
    setAlwaysOnTop() {}
    loadFile() {}
    showInactive() { this.visible = true; }
    show() { this.visible = true; }
    focus() {}
    hide() { this.visible = false; }
    isVisible() { return this.visible; }
    isDestroyed() { return this.destroyed; }
    setBounds(bounds) { this.bounds = { ...this.bounds, ...bounds }; }
    setSize(width, height) { this.bounds.width = width; this.bounds.height = height; }
    destroy() { this.destroyed = true; this.visible = false; this.emit("closed"); }
  }

  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "electron") return { BrowserWindow: FakeBrowserWindow, ipcMain };
    return originalLoad.call(this, request, parent, isMain);
  };

  let initActivity;
  try {
    delete require.cache[require.resolve("../src/activity")];
    initActivity = require("../src/activity");
  } finally {
    Module._load = originalLoad;
  }

  const controller = initActivity({
    isMac: false,
    isLinux: false,
    isWin: false,
    linuxWindowType: "toolbar",
    winTopmostLevel: "pop-up-menu",
    petWindow: { isDestroyed: () => false, getBounds: () => ({ x: 900, y: 500, width: 200, height: 200 }) },
    getHitRectScreen: () => ({ left: 940, top: 520, right: 1060, bottom: 690 }),
    getNearestWorkArea: () => ({ x: 0, y: 0, width: 1200, height: 800 }),
    getMiniEdge: () => null,
    focusSession: () => false,
    showContextMenu() {},
    guardAlwaysOnTop() {},
    reapplyMacVisibility() {},
  });

  controller.create();
  assert.equal(windows.length, 3);
  assert.equal(windows[0].isVisible(), true, "status pill is always visible");
  assert.equal(windows[1].isVisible(), false, "panel starts hidden");
  controller.updateSnapshot({ status: { label: "Idle" }, sessions: [], sessionCount: 0 });
  assert.deepStrictEqual(windows[0].webContents.messages.at(-1)[0], "activity:snapshot");
  ipcMain.emit("activity:status-size", { sender: windows[0].webContents }, { width: 100, height: 44 });
  assert.equal(windows[0].bounds.width, 128, "status pill keeps a readable minimum width");
  assert.equal(windows[0].bounds.height, 44);
  ipcMain.emit("activity:status-size", { sender: windows[0].webContents }, { width: 180, height: 44 });
  assert.equal(windows[0].bounds.width, 180, "status pill follows valid rendered content width");
  ipcMain.emit("activity:status-size", { sender: windows[0].webContents }, { width: 999, height: 44 });
  assert.equal(windows[0].bounds.width, 220, "status pill caps unexpectedly large measurements");

  controller.togglePanel();
  assert.equal(windows[1].isVisible(), true);
  controller.togglePanel();
  assert.equal(windows[1].isVisible(), false);

  controller.showAlert({ kind: "completed", priority: 2, durationMs: 0 });
  assert.equal(windows[2].isVisible(), true);
  controller.hideAlert();
  assert.equal(windows[2].isVisible(), false);

  controller.showAlert({ kind: "waiting", priority: 4, durationMs: 0, sessionId: "waiting" });
  controller.showAlert({ kind: "error", priority: 3, durationMs: 0, sessionId: "error" });
  assert.equal(windows[2].webContents.messages.at(-1)[1].kind, "waiting");
  controller.clearAlertForSession("waiting");
  assert.equal(windows[2].isVisible(), true, "next important status is promoted");
  assert.equal(windows[2].webContents.messages.at(-1)[1].kind, "error");

  controller.cleanup();
  assert.ok(windows.every((window) => window.isDestroyed()));
});
