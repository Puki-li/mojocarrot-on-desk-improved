"use strict";

const path = require("path");
const { BrowserWindow, ipcMain } = require("electron");
const {
  positionActivityPanel,
  positionStatusPill,
} = require("./activity-geometry");

const STATUS_SIZE = Object.freeze({ width: 230, height: 56 });
const STATUS_MIN_SIZE = Object.freeze({ width: 128, height: 36 });
const IDLE_STATUS_MIN_SIZE = Object.freeze({ width: 96, height: 36 });
const PANEL_DEFAULT_SIZE = Object.freeze({ width: 430, height: 500 });
const ALERT_SIZE = Object.freeze({ width: 430, height: 150 });

function strictClamp(value, min, max) {
  if (max < min) return min;
  return Math.max(min, Math.min(value, max));
}

module.exports = function initActivity(ctx) {
  let statusWin = null;
  let panelWin = null;
  let alertWin = null;
  let panelOpen = false;
  let snapshot = null;
  let currentAlert = null;
  let alertTimer = null;
  let blurTimer = null;
  let statusSize = { ...STATUS_SIZE };
  let panelSize = { ...PANEL_DEFAULT_SIZE };
  let alertSequence = 0;

  const handlers = new Map();
  const alertCandidates = new Map();

  function windowOptions({ width, height, focusable }) {
    return {
      width,
      height,
      frame: false,
      show: false,
      transparent: true,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      hasShadow: false,
      fullscreenable: false,
      enableLargerThanScreen: true,
      focusable,
      ...(ctx.isLinux ? { type: ctx.linuxWindowType } : {}),
      ...(ctx.isMac ? { type: "panel", roundedCorners: false } : {}),
      webPreferences: {
        preload: path.join(__dirname, "preload-activity.js"),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    };
  }

  function configureWindow(target, { focusable }) {
    if (ctx.isMac && !focusable) target.setFocusable(false);
    target.setMenuBarVisibility(false);
    if (ctx.isWin) target.setAlwaysOnTop(true, ctx.winTopmostLevel);
    if (typeof ctx.guardAlwaysOnTop === "function") ctx.guardAlwaysOnTop(target);
    target.on("closed", () => {
      if (target === statusWin) statusWin = null;
      if (target === panelWin) { panelWin = null; panelOpen = false; }
      if (target === alertWin) alertWin = null;
    });
    target.webContents.on("render-process-gone", () => {
      if (!target.isDestroyed()) target.webContents.reload();
    });
  }

  function sendSnapshot(target) {
    if (!snapshot || !target || target.isDestroyed() || target.webContents.isLoading()) return;
    target.webContents.send("activity:snapshot", snapshot);
  }

  function create() {
    if (statusWin && !statusWin.isDestroyed()) return;

    statusWin = new BrowserWindow(windowOptions({ ...STATUS_SIZE, focusable: true }));
    configureWindow(statusWin, { focusable: true });
    statusWin.loadFile(path.join(__dirname, "activity-status.html"));
    statusWin.webContents.on("did-finish-load", () => sendSnapshot(statusWin));
    statusWin.showInactive();

    panelWin = new BrowserWindow(windowOptions({ ...panelSize, focusable: true }));
    configureWindow(panelWin, { focusable: true });
    panelWin.loadFile(path.join(__dirname, "activity-panel.html"));
    panelWin.webContents.on("did-finish-load", () => sendSnapshot(panelWin));
    panelWin.on("blur", () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        blurTimer = null;
        if (panelOpen) closePanel();
      }, 80);
    });

    alertWin = new BrowserWindow(windowOptions({ ...ALERT_SIZE, focusable: false }));
    configureWindow(alertWin, { focusable: false });
    alertWin.loadFile(path.join(__dirname, "activity-alert.html"));
    alertWin.webContents.on("did-finish-load", () => sendAlert());

    registerIpc();
    reposition();
    if (typeof ctx.reapplyMacVisibility === "function") ctx.reapplyMacVisibility();
  }

  function register(channel, handler) {
    ipcMain.on(channel, handler);
    handlers.set(channel, handler);
  }

  function senderIs(event, target) {
    return !!target && !target.isDestroyed() && event.sender === target.webContents;
  }

  function registerIpc() {
    if (handlers.size) return;
    register("activity:toggle-panel", (event) => {
      if (!senderIs(event, statusWin)) return;
      togglePanel();
    });
    register("activity:close-panel", (event) => {
      if (!senderIs(event, panelWin)) return;
      closePanel();
    });
    register("activity:focus-session", (event, sessionId) => {
      if (!senderIs(event, panelWin) || typeof sessionId !== "string" || sessionId.length > 256) return;
      const didFocus = ctx.focusSession(sessionId);
      if (didFocus) closePanel();
    });
    register("activity:panel-size", (event, nextSize) => {
      if (!senderIs(event, panelWin) || !nextSize || typeof nextSize !== "object") return;
      const width = Math.round(Number(nextSize.width));
      const height = Math.round(Number(nextSize.height));
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      panelSize = {
        width: strictClamp(width, 360, 560),
        height: strictClamp(height, 260, 760),
      };
      if (!panelWin.isDestroyed()) panelWin.setSize(panelSize.width, panelSize.height, false);
      reposition();
    });
    register("activity:status-size", (event, nextSize) => {
      if (!senderIs(event, statusWin) || !nextSize || typeof nextSize !== "object") return;
      const width = Math.round(Number(nextSize.width));
      const height = Math.round(Number(nextSize.height));
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      const minSize = nextSize.compact === true ? IDLE_STATUS_MIN_SIZE : STATUS_MIN_SIZE;
      statusSize = {
        width: strictClamp(width, minSize.width, STATUS_SIZE.width),
        height: strictClamp(height, minSize.height, STATUS_SIZE.height),
      };
      if (!statusWin.isDestroyed()) statusWin.setSize(statusSize.width, statusSize.height, false);
      reposition();
    });
    register("activity:show-context-menu", (event) => {
      if (!senderIs(event, statusWin)) return;
      ctx.showContextMenu();
    });
    register("activity:dismiss-alert", (event) => {
      if (!senderIs(event, alertWin)) return;
      dismissCurrentAlert();
    });
    register("activity:focus-alert", (event) => {
      if (!senderIs(event, alertWin) || !currentAlert?.focusSessionId) return;
      const didFocus = ctx.focusSession(currentAlert.focusSessionId);
      if (didFocus) dismissCurrentAlert();
    });
  }

  function getWorkArea(bounds) {
    return ctx.getNearestWorkArea(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  }

  function reposition() {
    if (!ctx.petWindow || ctx.petWindow.isDestroyed()) return;
    const petBounds = ctx.petWindow.getBounds();
    const workArea = getWorkArea(petBounds);
    const hitRect = ctx.getHitRectScreen(petBounds);
    const miniEdge = ctx.getMiniEdge();
    if (statusWin && !statusWin.isDestroyed()) {
      const next = positionStatusPill({ hitRect, workArea, pillSize: statusSize });
      statusWin.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height }, false);
    }
    if (panelWin && !panelWin.isDestroyed()) {
      const next = positionActivityPanel({ hitRect, workArea, panelSize, miniEdge });
      panelWin.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height }, false);
    }
    if (alertWin && !alertWin.isDestroyed()) {
      const next = positionActivityPanel({ hitRect, workArea, panelSize: ALERT_SIZE, miniEdge });
      alertWin.setBounds({ x: next.x, y: next.y, width: next.width, height: next.height }, false);
    }
  }

  function updateSnapshot(nextSnapshot) {
    snapshot = nextSnapshot;
    sendSnapshot(statusWin);
    sendSnapshot(panelWin);
  }

  function openPanel() {
    if (!panelWin || panelWin.isDestroyed()) return;
    if (blurTimer) { clearTimeout(blurTimer); blurTimer = null; }
    panelOpen = true;
    reposition();
    sendSnapshot(panelWin);
    panelWin.show();
    panelWin.focus();
  }

  function closePanel() {
    panelOpen = false;
    if (panelWin && !panelWin.isDestroyed()) panelWin.hide();
  }

  function togglePanel() {
    if (panelOpen) closePanel();
    else openPanel();
  }

  function sendAlert() {
    if (!currentAlert || !alertWin || alertWin.isDestroyed() || alertWin.webContents.isLoading()) return;
    alertWin.webContents.send("activity:alert", currentAlert);
  }

  function getAlertKey(alert) {
    if (alert.sessionId) return `session:${alert.sessionId}`;
    if (typeof alert.key === "string" && alert.key) return `key:${alert.key}`;
    return `kind:${alert.kind || "status"}`;
  }

  function displayAlert(alert) {
    currentAlert = alert;
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = null;
    reposition();
    sendAlert();
    alertWin.showInactive();
    if (Number.isFinite(alert.durationMs) && alert.durationMs > 0) {
      alertTimer = setTimeout(dismissCurrentAlert, alert.durationMs);
    }
  }

  function promoteHighestAlert() {
    if (!alertWin || alertWin.isDestroyed() || alertCandidates.size === 0) {
      currentAlert = null;
      if (alertWin && !alertWin.isDestroyed()) alertWin.hide();
      return;
    }
    const next = [...alertCandidates.values()].sort((left, right) =>
      right.priority - left.priority || right.sequence - left.sequence
    )[0];
    displayAlert(next);
  }

  function showAlert(alert) {
    if (!alertWin || alertWin.isDestroyed() || !alert) return;
    const key = getAlertKey(alert);
    const candidate = {
      ...alert,
      key,
      priority: Number(alert.priority) || 0,
      sequence: ++alertSequence,
    };
    alertCandidates.set(key, candidate);
    if (!currentAlert || currentAlert.key === key || candidate.priority > currentAlert.priority) {
      displayAlert(candidate);
    }
  }

  function dismissCurrentAlert() {
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = null;
    if (currentAlert?.key) alertCandidates.delete(currentAlert.key);
    currentAlert = null;
    if (alertWin && !alertWin.isDestroyed()) alertWin.hide();
    promoteHighestAlert();
  }

  function hideAlert() {
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = null;
    alertCandidates.clear();
    currentAlert = null;
    if (alertWin && !alertWin.isDestroyed()) alertWin.hide();
  }

  function clearAlertForSession(sessionId) {
    for (const [key, alert] of alertCandidates) {
      if (alert.sessionId === sessionId) alertCandidates.delete(key);
    }
    if (currentAlert?.sessionId !== sessionId) return;
    if (alertTimer) clearTimeout(alertTimer);
    alertTimer = null;
    currentAlert = null;
    if (alertWin && !alertWin.isDestroyed()) alertWin.hide();
    promoteHighestAlert();
  }

  function hide() {
    closePanel();
    hideAlert();
    if (statusWin && !statusWin.isDestroyed()) statusWin.hide();
  }

  function show() {
    if (statusWin && !statusWin.isDestroyed()) {
      reposition();
      statusWin.showInactive();
    }
  }

  function getWindows() {
    return [statusWin, panelWin, alertWin].filter((target) => target && !target.isDestroyed());
  }

  function cleanup() {
    if (alertTimer) clearTimeout(alertTimer);
    if (blurTimer) clearTimeout(blurTimer);
    alertCandidates.clear();
    for (const [channel, handler] of handlers) ipcMain.removeListener(channel, handler);
    handlers.clear();
    for (const target of getWindows()) target.destroy();
    statusWin = panelWin = alertWin = null;
  }

  return {
    create,
    clearAlertForSession,
    cleanup,
    closePanel,
    getWindows,
    hide,
    hideAlert,
    isPanelOpen: () => panelOpen,
    reposition,
    show,
    showAlert,
    togglePanel,
    updateSnapshot,
  };
};
