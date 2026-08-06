(function renderActivityAlert() {
  "use strict";

  const card = document.getElementById("activityAlert");
  const main = document.getElementById("alertMain");
  const close = document.getElementById("alertClose");
  const icon = document.getElementById("alertIcon");
  const source = document.getElementById("alertSource");
  const message = document.getElementById("alertMessage");

  const icons = { waiting: "…", error: "!", completed: "✓", quota: "%" };

  function render(alert) {
    if (!alert || typeof alert !== "object") return;
    const kind = ["waiting", "error", "completed", "quota"].includes(alert.kind)
      ? alert.kind
      : "completed";
    card.dataset.kind = kind;
    icon.textContent = icons[kind];
    source.textContent = [alert.agentLabel, alert.project].filter(Boolean).join(" · ") || "Mojocarrot";
    message.textContent = alert.message || "状态已更新";
    main.disabled = !alert.focusSessionId;
    main.setAttribute("aria-label", `${source.textContent}，${message.textContent}`);
  }

  main.addEventListener("click", () => window.activityAPI.focusAlert());
  close.addEventListener("click", () => window.activityAPI.dismissAlert());
  window.activityAPI.onAlert(render);
})();
