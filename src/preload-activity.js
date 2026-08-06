const { contextBridge, ipcRenderer } = require("electron");

function onSnapshot(callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_, snapshot) => callback(snapshot);
  ipcRenderer.on("activity:snapshot", listener);
  return () => ipcRenderer.removeListener("activity:snapshot", listener);
}

function onAlert(callback) {
  if (typeof callback !== "function") return () => {};
  const listener = (_, alert) => callback(alert);
  ipcRenderer.on("activity:alert", listener);
  return () => ipcRenderer.removeListener("activity:alert", listener);
}

contextBridge.exposeInMainWorld("activityAPI", {
  onSnapshot,
  onAlert,
  togglePanel: () => ipcRenderer.send("activity:toggle-panel"),
  closePanel: () => ipcRenderer.send("activity:close-panel"),
  focusSession: (sessionId) => {
    if (typeof sessionId === "string" && sessionId) {
      ipcRenderer.send("activity:focus-session", sessionId);
    }
  },
  focusAlert: () => ipcRenderer.send("activity:focus-alert"),
  dismissAlert: () => ipcRenderer.send("activity:dismiss-alert"),
  reportStatusSize: (width, height) => ipcRenderer.send("activity:status-size", { width, height }),
  reportPanelSize: (width, height) => ipcRenderer.send("activity:panel-size", { width, height }),
  showContextMenu: () => ipcRenderer.send("activity:show-context-menu"),
});
