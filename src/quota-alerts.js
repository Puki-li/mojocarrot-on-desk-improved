"use strict";

function findCrossedThresholds(previous, next, seenKeys, createKey, thresholds = [20, 10]) {
  if (!previous || !next || previous.cycleId !== next.cycleId) return [];
  const crossed = [];
  for (const threshold of thresholds) {
    if (!(previous.remainingPercent > threshold && next.remainingPercent <= threshold)) continue;
    const key = createKey(next, threshold);
    if (!key || seenKeys.has(key)) continue;
    crossed.push({ threshold, key });
  }
  return crossed;
}

module.exports = { findCrossedThresholds };
