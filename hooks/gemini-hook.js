#!/usr/bin/env node
// Clawd — Gemini CLI hook (stdin JSON with hook_event_name; stdout JSON for gating hooks)
// Registered in ~/.gemini/settings.json by hooks/gemini-install.js

const { postStateToRunningServer, readHostPrefix } = require("./server-config");
const {
  isExpectedAgentProcess,
  queryWindowsProcess,
  shouldForwardAgentHook,
} = require("./agent-hook-lib");

// Gemini hook event → { state, event } for the Clawd state machine
const HOOK_MAP = {
  SessionStart:  { state: "idle",         event: "SessionStart" },
  SessionEnd:    { state: "sleeping",     event: "SessionEnd" },
  BeforeAgent:   { state: "thinking",     event: "UserPromptSubmit" },
  BeforeTool:    { state: "working",      event: "PreToolUse" },
  AfterTool:     { state: "working",      event: "PostToolUse" },
  AfterAgent:    { state: "attention",    event: "Stop" },
  Notification:  { state: "notification", event: "Notification" },
  PreCompress:   { state: "sweeping",     event: "PreCompact" },
};

// Walk the process tree to find the terminal app PID.
// Duplicated because hook scripts must be zero-dependency.
const TERMINAL_NAMES_WIN = new Set([
  "windowsterminal.exe", "cmd.exe", "powershell.exe", "pwsh.exe",
  "code.exe", "alacritty.exe", "wezterm-gui.exe", "mintty.exe",
  "conemu64.exe", "conemu.exe", "hyper.exe", "tabby.exe",
  "antigravity.exe", "warp.exe", "iterm.exe", "ghostty.exe",
]);
const TERMINAL_NAMES_MAC = new Set([
  "terminal", "iterm2", "alacritty", "wezterm-gui", "kitty",
  "hyper", "tabby", "warp", "ghostty",
]);
const TERMINAL_NAMES_LINUX = new Set([
  "gnome-terminal", "kgx", "konsole", "xfce4-terminal", "tilix",
  "alacritty", "wezterm", "wezterm-gui", "kitty", "ghostty",
  "xterm", "lxterminal", "terminator", "tabby", "hyper", "warp",
]);

const SYSTEM_BOUNDARY_WIN = new Set(["explorer.exe", "services.exe", "winlogon.exe", "svchost.exe"]);
const SYSTEM_BOUNDARY_MAC = new Set(["launchd", "init", "systemd"]);
const SYSTEM_BOUNDARY_LINUX = new Set(["systemd", "init"]);

const EDITOR_MAP_WIN = { "code.exe": "code", "cursor.exe": "cursor" };
const EDITOR_MAP_MAC = { "code": "code", "cursor": "cursor" };
const EDITOR_MAP_LINUX = { "code": "code", "cursor": "cursor", "code-insiders": "code" };

let _stablePid = null;
let _detectedEditor = null;
let _geminiPid = null;
let _pidChain = [];

function getStablePid() {
  if (_stablePid) return _stablePid;
  const { execSync } = require("child_process");
  const isWin = process.platform === "win32";
  const terminalNames = isWin ? TERMINAL_NAMES_WIN : (process.platform === "linux" ? TERMINAL_NAMES_LINUX : TERMINAL_NAMES_MAC);
  const systemBoundary = isWin ? SYSTEM_BOUNDARY_WIN : (process.platform === "linux" ? SYSTEM_BOUNDARY_LINUX : SYSTEM_BOUNDARY_MAC);
  const editorMap = isWin ? EDITOR_MAP_WIN : (process.platform === "linux" ? EDITOR_MAP_LINUX : EDITOR_MAP_MAC);
  let pid = process.ppid;
  let lastGoodPid = pid;
  let terminalPid = null;
  _pidChain = [];
  _detectedEditor = null;
  _geminiPid = null;
  for (let i = 0; i < 8; i++) {
    let name, parentPid, commandLine = "";
    try {
      if (isWin) {
        const info = queryWindowsProcess(pid, execSync);
        if (!info) break;
        name = info.name;
        parentPid = info.parentPid;
        commandLine = info.commandLine;
      } else {
        const cp = require("child_process");
        const ppidOut = cp.execSync(`ps -o ppid= -p ${pid}`, { encoding: "utf8", timeout: 1000 }).trim();
        const commOut = cp.execSync(`ps -o comm= -p ${pid}`, { encoding: "utf8", timeout: 1000 }).trim();
        name = require("path").basename(commOut).toLowerCase();
        commandLine = commOut;
        if (name === "node") {
          try { commandLine = cp.execSync(`ps -o command= -p ${pid}`, { encoding: "utf8", timeout: 500 }); } catch {}
        }
        if (!_detectedEditor) {
          const fullLower = commOut.toLowerCase();
          if (fullLower.includes("visual studio code")) _detectedEditor = "code";
          else if (fullLower.includes("cursor.app")) _detectedEditor = "cursor";
        }
        parentPid = parseInt(ppidOut, 10);
      }
    } catch { break; }
    _pidChain.push(pid);
    if (!_detectedEditor && editorMap[name]) _detectedEditor = editorMap[name];
    if (!_geminiPid && isExpectedAgentProcess("gemini-cli", name, commandLine)) _geminiPid = pid;
    if (systemBoundary.has(name)) break;
    if (terminalNames.has(name)) terminalPid = pid;
    lastGoodPid = pid;
    if (!parentPid || parentPid === pid || parentPid <= 1) break;
    pid = parentPid;
  }
  _stablePid = terminalPid || lastGoodPid;
  return _stablePid;
}

// Gemini CLI gating hooks need a JSON response. This hook observes state only;
// it must never make an allow/deny decision on the user's behalf.
function stdoutForEvent() {
  return "{}";
}

// Read stdin JSON, extract event, post state, write stdout
const chunks = [];
let _ran = false;
let _stdinTimer = null;

function finishOnce(payload) {
  if (_ran) return;
  _ran = true;
  if (_stdinTimer) clearTimeout(_stdinTimer);

  const hookName = (payload && payload.hook_event_name) || "";
  const mapped = HOOK_MAP[hookName];

  if (!mapped) {
    process.stdout.write(stdoutForEvent(hookName) + "\n");
    process.exit(0);
    return;
  }

  const { state, event } = mapped;

  if (hookName === "SessionStart" && !process.env.CLAWD_REMOTE) getStablePid();

  const sessionId = (payload && payload.session_id) || "default";
  const cwd = (payload && payload.cwd) || "";

  const isRemote = !!process.env.CLAWD_REMOTE;
  const stablePid = isRemote ? null : getStablePid();
  const outLine = stdoutForEvent(hookName);
  if (!shouldForwardAgentHook(isRemote, _geminiPid)) {
    process.stdout.write(outLine + "\n");
    process.exit(0);
    return;
  }

  const body = { state, session_id: sessionId, event };
  body.agent_id = "gemini-cli";
  if (cwd) body.cwd = cwd;
  if (isRemote) {
    body.host = readHostPrefix();
  } else {
    body.source_pid = stablePid;
    if (_detectedEditor) body.editor = _detectedEditor;
    if (_geminiPid) body.agent_pid = _geminiPid;
    if (_pidChain.length) body.pid_chain = _pidChain;
  }

  const data = JSON.stringify(body);
  postStateToRunningServer(data, { timeoutMs: 100 }, () => {
    process.stdout.write(outLine + "\n");
    process.exit(0);
  });
}

process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    const raw = Buffer.concat(chunks).toString();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch {
    payload = {};
  }
  finishOnce(payload);
});

_stdinTimer = setTimeout(() => finishOnce({}), 400);
