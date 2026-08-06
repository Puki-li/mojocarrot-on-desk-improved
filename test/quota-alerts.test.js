const test = require("node:test");
const assert = require("node:assert/strict");
const { findCrossedThresholds } = require("../src/quota-alerts");

const createKey = (quota, threshold) => `${quota.cycleId}:${threshold}`;

test("quota alerts fire once when a weekly cycle crosses 20 and 10 percent", () => {
  const seen = new Set();
  const previous = { cycleId: "weekly-1", remainingPercent: 24 };
  const next = { cycleId: "weekly-1", remainingPercent: 8 };
  const crossed = findCrossedThresholds(previous, next, seen, createKey);
  assert.deepStrictEqual(crossed, [
    { threshold: 20, key: "weekly-1:20" },
    { threshold: 10, key: "weekly-1:10" },
  ]);
  crossed.forEach(({ key }) => seen.add(key));
  assert.deepStrictEqual(findCrossedThresholds(previous, next, seen, createKey), []);
});

test("quota alerts do not replay on startup or across different reset cycles", () => {
  assert.deepStrictEqual(findCrossedThresholds(null, { cycleId: "a", remainingPercent: 9 }, new Set(), createKey), []);
  assert.deepStrictEqual(findCrossedThresholds(
    { cycleId: "a", remainingPercent: 30 },
    { cycleId: "b", remainingPercent: 9 },
    new Set(),
    createKey
  ), []);
});
