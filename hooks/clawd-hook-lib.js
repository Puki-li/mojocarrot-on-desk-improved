// clawd-hook-lib.js — pure helpers for clawd-hook.js, extracted for unit tests
// (same pattern as scripts/generate-readme-gifs-lib.js). Zero dependencies.

// PostToolUseFailure also fires on routine self-healing failures (Bash
// non-zero exit, grep no match, failing tests the agent is fixing) —
// the agent is still working, so Bash failures show working, not error.
// Missing tool_name falls back to error (previous behavior).
function resolvePostToolUseFailureState(toolName) {
  return toolName === "Bash" ? "working" : "error";
}

// Some Codex hosts execute Claude-compatible hooks. A local hook is only a
// Claude Code event when the hook process tree actually contains Claude.
// Remote hooks cannot inspect local process ancestry, so keep forwarding them.
function shouldForwardClaudeHook(isRemote, claudePid) {
  return isRemote === true || (Number.isInteger(claudePid) && claudePid > 0);
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
  parseWmicList,
  queryWindowsProcess,
  resolvePostToolUseFailureState,
  shouldForwardClaudeHook,
};
