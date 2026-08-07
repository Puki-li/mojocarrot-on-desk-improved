(function renderActivityPanel() {
  "use strict";

  const viewModel = window.activityViewModel;
  const sessionTitle = document.getElementById("sessionTitle");
  const sessionList = document.getElementById("sessionList");
  const sessionEmpty = document.getElementById("sessionEmpty");
  const sessionEmptyText = document.getElementById("sessionEmptyText");
  const panelClose = document.getElementById("panelClose");
  const quotaSection = document.getElementById("quotaSection");
  const quotaPercent = document.getElementById("quotaPercent");
  const quotaProgress = document.getElementById("quotaProgress");
  const quotaReset = document.getElementById("quotaReset");
  const quotaTitle = document.getElementById("quotaTitle");
  const quotaPeriod = document.getElementById("quotaPeriod");
  const quotaPrefix = document.getElementById("quotaPrefix");
  let currentLang = "zh";

  function createSessionRow(session) {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "session-row";
    row.dataset.agent = viewModel.getAgentTone(session.agentId);
    row.dataset.state = viewModel.getStateTone(session.state);
    if (session.dominant) row.classList.add("dominant");
    if (!session.focusable) {
      row.disabled = true;
      row.classList.add("not-focusable");
    }

    const identity = document.createElement("span");
    identity.className = "session-identity";

    const agentLine = document.createElement("span");
    agentLine.className = "session-agent-line";
    const dot = document.createElement("span");
    dot.className = "agent-dot";
    dot.setAttribute("aria-hidden", "true");
    const agent = document.createElement("strong");
    agent.className = "session-agent";
    agent.textContent = session.agentLabel || "Agent";
    agentLine.append(dot, agent);

    const project = document.createElement("span");
    project.className = "session-project";
    project.textContent = session.project || (currentLang === "en" ? "Unnamed project" : "未命名项目");
    identity.append(agentLine, project);

    const detail = document.createElement("span");
    detail.className = "session-detail";
    const state = document.createElement("span");
    state.className = "session-state";
    state.textContent = viewModel.getStateLabel(session.state, currentLang);
    detail.appendChild(state);
    if (session.host) {
      const host = document.createElement("span");
      host.className = "session-host";
      host.textContent = `${currentLang === "en" ? "Remote" : "远程"} · ${session.host}`;
      detail.appendChild(host);
    }

    row.append(identity, detail);
    if (session.focusable) {
      row.setAttribute("aria-label", `${session.agentLabel || "Agent"}，${viewModel.getStateLabel(session.state, currentLang)}，${session.project || "未命名项目"}，点击切换`);
      row.addEventListener("click", () => window.activityAPI.focusSession(session.id));
    } else {
      row.setAttribute("aria-label", `${session.agentLabel || "Agent"}，${viewModel.getStateLabel(session.state, currentLang)}，无法直接切换`);
    }
    return row;
  }

  function renderSessions(snapshot) {
    sessionTitle.textContent = currentLang === "en"
      ? `Active Sessions (${snapshot.sessionCount})`
      : `活跃会话（${snapshot.sessionCount}）`;
    sessionList.replaceChildren();
    for (const session of snapshot.sessions) {
      sessionList.appendChild(createSessionRow(session));
    }
    sessionEmpty.hidden = snapshot.sessions.length > 0;
    sessionList.hidden = snapshot.sessions.length === 0;
    const visibleRows = Math.min(5, Math.max(1, snapshot.sessions.length));
    window.activityAPI.reportPanelSize(430, 300 + (visibleRows - 1) * 58);
  }

  function renderQuota(quota) {
    const view = viewModel.getQuotaView(quota, currentLang);
    quotaSection.dataset.tone = view.tone;
    quotaProgress.value = view.remainingPercent;
    quotaProgress.setAttribute("aria-valuenow", String(view.remainingPercent));
    if (!view.available) {
      quotaPercent.textContent = "—";
      quotaReset.textContent = view.resetText || (currentLang === "en"
        ? "Waiting for Codex usage data"
        : "等待 Codex 产生用量记录");
      return;
    }
    quotaPercent.textContent = `${view.displayPercent}%`;
    quotaReset.textContent = view.resetText;
  }

  function render(snapshot) {
    const normalized = viewModel.normalizeSnapshot(snapshot);
    currentLang = normalized.lang;
    sessionEmptyText.textContent = currentLang === "en" ? "No active sessions" : "暂无活跃会话";
    quotaTitle.textContent = currentLang === "en" ? "Codex Usage" : "Codex 用量";
    quotaPeriod.textContent = currentLang === "en" ? "Weekly" : "本周";
    quotaPrefix.textContent = currentLang === "en" ? "Remaining" : "剩余";
    renderSessions(normalized);
    renderQuota(normalized.quota);
  }

  panelClose.addEventListener("click", () => window.activityAPI.closePanel());
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") window.activityAPI.closePanel();
  });
  window.activityAPI.onSnapshot(render);
  render(null);
})();
