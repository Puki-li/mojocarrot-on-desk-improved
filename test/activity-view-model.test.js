const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  formatLocalReset,
  getQuotaView,
  getStateLabel,
  getStatusText,
  normalizeSnapshot,
} = require("../src/activity-view-model");

test("compact status keeps Idle and appends only a positive agent count", () => {
  assert.equal(getStatusText(null), "Idle");
  assert.equal(getStatusText({ status: { label: "Codex", extraCount: 2 } }), "Codex +2");
  assert.equal(getStatusText({ status: { label: "Cursor", extraCount: -1 } }), "Cursor");
});

test("snapshot normalization tolerates incomplete renderer input", () => {
  const snapshot = normalizeSnapshot({ sessions: [{ id: "one" }], sessionCount: "bad" });
  assert.equal(snapshot.status.label, "Idle");
  assert.equal(snapshot.sessionCount, 1);
  assert.equal(snapshot.sessions.length, 1);
});

test("quota view emphasizes remaining percent and chooses threshold tone", () => {
  const future = Date.now() + 60000;
  assert.equal(getQuotaView({ remainingPercent: 58, resetsAtMs: future }).tone, "healthy");
  assert.equal(getQuotaView({ remainingPercent: 20, resetsAtMs: future }).tone, "warning");
  assert.equal(getQuotaView({ remainingPercent: 10, resetsAtMs: future }).tone, "critical");
  assert.equal(getQuotaView({ remainingPercent: 58, resetsAtMs: Date.now() - 1 }).available, false);
  assert.equal(getQuotaView(null).available, false);
});

test("reset time uses the machine local date, weekday, and time", () => {
  const localReset = new Date(2026, 7, 7, 18, 30, 0, 0);
  assert.equal(formatLocalReset(localReset.getTime()), "8月7日 周五 18:30 重置");
  assert.equal(formatLocalReset(localReset.getTime(), "en"), "8/7 Fri 18:30 reset");
  assert.equal(formatLocalReset(undefined), "等待额度刷新");
});

test("session states use turn-level completion wording", () => {
  assert.equal(getStateLabel("waiting"), "等待输入");
  assert.equal(getStateLabel("error"), "出错");
  assert.equal(getStateLabel("completed"), "本轮完成");
  assert.equal(getStateLabel("completed", "en"), "Turn done");
});

test("status sizing uses natural content width when the current window clips it", () => {
  const { getStatusWindowSize } = require("../src/activity-view-model");
  assert.deepStrictEqual(getStatusWindowSize({
    rectWidth: 76,
    rectHeight: 32,
    scrollWidth: 142,
    borderWidth: 2,
  }), { width: 154, height: 42 });
});

test("activity windows keep scripts and styles external under a strict CSP", () => {
  for (const fileName of ["activity-status.html", "activity-panel.html", "activity-alert.html"]) {
    const html = fs.readFileSync(path.join(__dirname, "..", "src", fileName), "utf8");
    assert.match(html, /default-src 'none'; style-src 'self'; script-src 'self'/);
    assert.doesNotMatch(html, /<style\b/i);
    assert.doesNotMatch(html, /<script(?!\s+src=)/i);
  }
});
