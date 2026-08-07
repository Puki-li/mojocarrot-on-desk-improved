"use strict";

const COMPLETED_RETENTION_MS = 5 * 60 * 1000;

const AGENT_PRESENTATION = Object.freeze({
  codex: { label: "Codex", color: "#2f9e44" },
  "cursor-agent": { label: "Cursor", color: "#8e44ad" },
  "claude-code": { label: "Claude Code", color: "#f59f00" },
  "copilot-cli": { label: "Copilot", color: "#238636" },
  "gemini-cli": { label: "Gemini", color: "#4285f4" },
});

const ACTIVITY_PRIORITY = Object.freeze({
  waiting: 7,
  error: 6,
  working: 5,
  thinking: 4,
  completed: 3,
  idle: 1,
  sleeping: 0,
});

const ACTIVE_STATES = new Set(["waiting", "error", "working", "thinking"]);
const EXECUTING_STATES = new Set(["working", "thinking"]);

function getAgentPresentation(agentId) {
  return AGENT_PRESENTATION[agentId] || {
    label: agentId ? String(agentId) : "Agent",
    color: "#64748b",
  };
}

function getProjectName(cwd, sessionId) {
  if (cwd) {
    const normalized = String(cwd).replace(/[\\/]+$/, "");
    const parts = normalized.split(/[\\/]/);
    if (parts[parts.length - 1]) return parts[parts.length - 1];
  }
  const id = String(sessionId || "");
  return id.length > 10 ? `${id.slice(0, 8)}…` : id;
}

function normalizeActivityState(session) {
  const explicit = session.activityState;
  if (explicit === "juggling") return "working";
  if (ACTIVITY_PRIORITY[explicit] !== undefined) return explicit;
  if (session.state === "attention") return "completed";
  if (session.state === "notification") return "waiting";
  if (session.state === "juggling") return "working";
  if (ACTIVITY_PRIORITY[session.state] !== undefined) return session.state;
  return "idle";
}

function getActivityTimestamp(session) {
  return Number.isFinite(session.activityUpdatedAt)
    ? session.activityUpdatedAt
    : Number.isFinite(session.updatedAt)
      ? session.updatedAt
      : 0;
}

function isVisibleSession(session, now) {
  const state = normalizeActivityState(session);
  if (state !== "completed") return true;
  return now - getActivityTimestamp(session) <= COMPLETED_RETENTION_MS;
}

function createSessionView(id, session) {
  const state = normalizeActivityState(session);
  const agent = getAgentPresentation(session.agentId);
  return {
    id,
    agentId: session.agentId || null,
    agentLabel: agent.label,
    agentColor: agent.color,
    state,
    updatedAt: getActivityTimestamp(session),
    project: getProjectName(session.cwd, id),
    host: session.host || null,
    headless: session.headless === true,
    focusable: !session.host && !!session.sourcePid,
  };
}

function compareSessionViews(a, b) {
  const priorityDelta = (ACTIVITY_PRIORITY[b.state] || 0) - (ACTIVITY_PRIORITY[a.state] || 0);
  if (priorityDelta !== 0) return priorityDelta;
  return b.updatedAt - a.updatedAt;
}

function compareRecentSessions(a, b) {
  const timeDelta = b.updatedAt - a.updatedAt;
  if (timeDelta !== 0) return timeDelta;
  return (ACTIVITY_PRIORITY[b.state] || 0) - (ACTIVITY_PRIORITY[a.state] || 0);
}

function collapseCompletedSessions(sessionViews) {
  const completedKeys = new Set();
  const collapsed = [];
  for (const session of sessionViews) {
    if (session.state !== "completed") {
      collapsed.push(session);
      continue;
    }
    // Active parallel sessions stay independent. Only historical completion
    // rows from the same agent/project/host are collapsed to the newest one.
    const key = `${session.agentId || ""}\u0000${session.host || ""}\u0000${session.project}`;
    if (completedKeys.has(key)) continue;
    completedKeys.add(key);
    collapsed.push(session);
  }
  return collapsed;
}

function createQuotaView(quota) {
  if (!quota || typeof quota !== "object") return null;
  return {
    remainingPercent: Number(quota.remainingPercent),
    resetsAtMs: Number(quota.resetsAtMs),
    observedAtMs: Number(quota.observedAtMs),
    windowMinutes: Number(quota.windowMinutes),
    cycleId: typeof quota.cycleId === "string" ? quota.cycleId : "",
  };
}

function buildActivitySnapshot({ sessions, doNotDisturb = false, quota = null, now = Date.now() }) {
  const sessionViews = [];
  for (const [id, session] of sessions || []) {
    if (!isVisibleSession(session, now)) continue;
    sessionViews.push(createSessionView(id, session));
  }
  sessionViews.sort(compareSessionViews);
  const visibleSessionViews = collapseCompletedSessions(sessionViews);

  const activeSessions = visibleSessionViews.filter(
    (session) => !session.headless && ACTIVE_STATES.has(session.state)
  );
  // The compact pill answers "which agent is working now". Waiting/error
  // sessions remain prominent in the panel and alert card, but must not hide a
  // newer executing agent behind an old actionable state.
  const executingSessions = activeSessions
    .filter((session) => EXECUTING_STATES.has(session.state))
    .sort(compareRecentSessions);
  const attentionSessions = activeSessions
    .filter((session) => !EXECUTING_STATES.has(session.state))
    .sort(compareRecentSessions);
  const dominant = executingSessions[0] || attentionSessions[0] || null;
  const status = doNotDisturb
    ? { mode: "dnd", label: "DND", color: "#64748b", extraCount: 0 }
    : dominant
      ? {
          mode: "agent",
          label: dominant.agentLabel,
          color: dominant.agentColor,
          extraCount: Math.max(0, activeSessions.length - 1),
          sessionId: dominant.id,
        }
      : { mode: "idle", label: "Idle", color: "#64748b", extraCount: 0 };

  return {
    status,
    sessions: visibleSessionViews.map((session) => ({
      ...session,
      dominant: dominant ? session.id === dominant.id : false,
    })),
    sessionCount: visibleSessionViews.length,
    activeCount: activeSessions.length,
    quota: createQuotaView(quota),
    generatedAt: now,
  };
}

module.exports = {
  ACTIVE_STATES,
  ACTIVITY_PRIORITY,
  AGENT_PRESENTATION,
  COMPLETED_RETENTION_MS,
  EXECUTING_STATES,
  buildActivitySnapshot,
  getAgentPresentation,
  getProjectName,
  isVisibleSession,
  normalizeActivityState,
};
