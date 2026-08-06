(function activityViewModelModule(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.activityViewModel = api;
})(typeof window !== "undefined" ? window : null, function createActivityViewModel() {
  "use strict";

  const STATE_LABELS = Object.freeze({
    zh: {
      waiting: "等待输入", error: "出错", working: "工作中", thinking: "思考中",
      completed: "已完成", idle: "空闲", sleeping: "已结束",
    },
    en: {
      waiting: "Waiting", error: "Error", working: "Working", thinking: "Thinking",
      completed: "Completed", idle: "Idle", sleeping: "Ended",
    },
  });

  const WEEKDAYS = Object.freeze({
    zh: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"],
    en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  });

  function numberOr(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clampPercent(value) {
    return Math.min(100, Math.max(0, numberOr(value, 0)));
  }

  function normalizeSnapshot(snapshot) {
    const value = snapshot && typeof snapshot === "object" ? snapshot : {};
    const status = value.status && typeof value.status === "object" ? value.status : {};
    const sessions = Array.isArray(value.sessions) ? value.sessions : [];
    return {
      status: {
        mode: typeof status.mode === "string" ? status.mode : "idle",
        label: typeof status.label === "string" && status.label ? status.label : "Idle",
        extraCount: Math.max(0, Math.floor(numberOr(status.extraCount, 0))),
      },
      lang: value.lang === "en" ? "en" : "zh",
      sessions,
      sessionCount: Math.max(0, Math.floor(numberOr(value.sessionCount, sessions.length))),
      quota: value.quota && typeof value.quota === "object" ? value.quota : null,
    };
  }

  function getStatusText(snapshot) {
    const normalized = normalizeSnapshot(snapshot);
    const extra = normalized.status.extraCount > 0 ? ` +${normalized.status.extraCount}` : "";
    return `${normalized.status.label}${extra}`;
  }

  function getStatusTone(status) {
    const value = status && typeof status === "object" ? status : {};
    if (value.mode === "dnd") return "dnd";
    const label = String(value.label || "").toLowerCase();
    if (label.includes("codex")) return "codex";
    if (label.includes("cursor")) return "cursor";
    if (label.includes("claude")) return "claude";
    if (label.includes("copilot")) return "copilot";
    if (label.includes("gemini")) return "gemini";
    return "idle";
  }

  function getAgentTone(agentId) {
    const id = String(agentId || "").toLowerCase();
    if (id === "codex") return "codex";
    if (id === "cursor-agent") return "cursor";
    if (id === "claude-code") return "claude";
    if (id === "copilot-cli") return "copilot";
    if (id === "gemini-cli") return "gemini";
    return "agent";
  }

  function getStateLabel(state, lang = "zh") {
    const labels = STATE_LABELS[lang === "en" ? "en" : "zh"];
    return labels[state] || labels.idle;
  }

  function getStateTone(state) {
    if (state === "waiting" || state === "error" || state === "completed") return state;
    if (state === "working" || state === "thinking") return "active";
    return "muted";
  }

  function getQuotaView(quota, lang = "zh", nowMs = Date.now()) {
    if (!quota || typeof quota !== "object") {
      return { available: false, remainingPercent: 0, tone: "unknown", resetText: "" };
    }
    const resetsAtMs = numberOr(quota.resetsAtMs, NaN);
    if (!Number.isFinite(resetsAtMs) || resetsAtMs <= nowMs) {
      return {
        available: false,
        remainingPercent: 0,
        tone: "unknown",
        resetText: lang === "en" ? "Waiting for quota refresh" : "等待额度刷新",
      };
    }
    const remainingPercent = clampPercent(quota.remainingPercent);
    const tone = remainingPercent <= 10
      ? "critical"
      : remainingPercent <= 20
        ? "warning"
        : "healthy";
    return {
      available: true,
      remainingPercent,
      displayPercent: Number.isInteger(remainingPercent)
        ? String(remainingPercent)
        : remainingPercent.toFixed(1).replace(/\.0$/, ""),
      tone,
      resetText: formatLocalReset(resetsAtMs, lang),
    };
  }

  function formatLocalReset(resetsAtMs, lang = "zh") {
    const date = new Date(numberOr(resetsAtMs, NaN));
    if (Number.isNaN(date.getTime())) return "等待额度刷新";
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const normalizedLang = lang === "en" ? "en" : "zh";
    const weekday = WEEKDAYS[normalizedLang][date.getDay()];
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    if (normalizedLang === "en") {
      return `${month}/${day} ${weekday} ${hours}:${minutes} reset`;
    }
    return `${month}月${day}日 ${weekday} ${hours}:${minutes} 重置`;
  }

  return {
    clampPercent,
    formatLocalReset,
    getAgentTone,
    getQuotaView,
    getStateLabel,
    getStateTone,
    getStatusText,
    getStatusTone,
    normalizeSnapshot,
  };
});
