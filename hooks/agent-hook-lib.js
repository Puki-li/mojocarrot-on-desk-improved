// Shared, dependency-free helpers for local agent command hooks.

const DIRECT_PROCESS_NAMES = {
  "gemini-cli": new Set(["gemini", "gemini.exe"]),
  "cursor-agent": new Set(["cursor", "cursor.exe"]),
  "copilot-cli": new Set(["copilot", "copilot.exe"]),
};

const NODE_COMMAND_MARKERS = {
  "gemini-cli": ["@google/gemini-cli"],
  "copilot-cli": ["@github/copilot"],
};

function shouldForwardAgentHook(isRemote, agentPid) {
  return isRemote === true || (Number.isInteger(agentPid) && agentPid > 0);
}

function isExpectedAgentProcess(agentId, processName, commandLine) {
  const names = DIRECT_PROCESS_NAMES[agentId];
  if (!names) return false;

  const name = String(processName || "").toLowerCase();
  const command = String(commandLine || "").toLowerCase();
  if (names.has(name)) return true;

  // On macOS Cursor helpers are usually named Electron/Helper, but their
  // executable path remains inside Cursor.app.
  if (agentId === "cursor-agent" && command.includes("cursor.app/contents/")) {
    return true;
  }

  if (name !== "node" && name !== "node.exe") return false;
  return (NODE_COMMAND_MARKERS[agentId] || []).some((marker) => command.includes(marker));
}

function parseWmicList(output) {
  const result = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const index = line.indexOf("=");
    if (index <= 0) continue;
    result[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
  if (!result.Name) return null;
  return {
    name: result.Name.toLowerCase(),
    parentPid: Number.parseInt(result.ParentProcessId, 10) || 0,
    commandLine: result.CommandLine || "",
  };
}

function queryWindowsProcess(pid, execSync) {
  if (!Number.isInteger(pid) || pid <= 0 || typeof execSync !== "function") return null;
  try {
    const output = execSync(
      `wmic process where "ProcessId=${pid}" get CommandLine,Name,ParentProcessId /format:list`,
      { encoding: "utf8", timeout: 1500, windowsHide: true }
    );
    const parsed = parseWmicList(output);
    if (parsed) return parsed;
  } catch {}

  try {
    const command = `powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}' | Select-Object Name,ParentProcessId,CommandLine | ConvertTo-Json -Compress"`;
    const output = execSync(command, { encoding: "utf8", timeout: 2000, windowsHide: true });
    const parsed = JSON.parse(String(output || "").trim());
    if (!parsed || !parsed.Name) return null;
    return {
      name: String(parsed.Name).toLowerCase(),
      parentPid: Number.parseInt(parsed.ParentProcessId, 10) || 0,
      commandLine: typeof parsed.CommandLine === "string" ? parsed.CommandLine : "",
    };
  } catch {
    return null;
  }
}

module.exports = {
  isExpectedAgentProcess,
  parseWmicList,
  queryWindowsProcess,
  shouldForwardAgentHook,
};
