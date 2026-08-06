(function renderActivityStatus() {
  "use strict";

  const statusButton = document.getElementById("activityStatus");
  const statusLabel = document.getElementById("statusLabel");
  const viewModel = window.activityViewModel;

  function render(snapshot) {
    const normalized = viewModel.normalizeSnapshot(snapshot);
    const text = viewModel.getStatusText(normalized);
    statusLabel.textContent = text;
    statusButton.dataset.tone = viewModel.getStatusTone(normalized.status);
    statusButton.setAttribute("aria-label", normalized.lang === "en"
      ? `${text}, open active sessions`
      : `${text}，打开活跃会话`);
    const bounds = statusButton.getBoundingClientRect();
    window.activityAPI.reportStatusSize(Math.ceil(bounds.width) + 10, Math.ceil(bounds.height) + 10);
  }

  statusButton.addEventListener("click", () => window.activityAPI.togglePanel());
  statusButton.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.activityAPI.showContextMenu();
  });
  window.activityAPI.onSnapshot(render);
  render(null);
})();
