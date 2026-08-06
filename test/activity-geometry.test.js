const test = require("node:test");
const assert = require("node:assert/strict");

const {
  clampBoundsToWorkArea,
  positionActivityPanel,
  positionStatusPill,
} = require("../src/activity-geometry");

function assertInside(bounds, workArea) {
  assert.ok(bounds.x >= workArea.x);
  assert.ok(bounds.y >= workArea.y);
  assert.ok(bounds.x + bounds.width <= workArea.x + workArea.width);
  assert.ok(bounds.y + bounds.height <= workArea.y + workArea.height);
}

test("status pill prefers a centered position above the pet", () => {
  const workArea = { x: 0, y: 0, width: 1440, height: 900 };
  const result = positionStatusPill({
    hitRect: { left: 1100, top: 600, right: 1240, bottom: 780 },
    workArea,
    pillSize: { width: 160, height: 48 },
  });

  assert.deepStrictEqual(result, {
    x: 1090,
    y: 544,
    width: 160,
    height: 48,
    placement: "above",
  });
});

test("status pill falls below the pet when there is no room above", () => {
  const workArea = { x: 0, y: 0, width: 800, height: 600 };
  const result = positionStatusPill({
    hitRect: { left: 300, top: 20, right: 420, bottom: 150 },
    workArea,
    pillSize: { width: 160, height: 48 },
  });

  assert.equal(result.placement, "below");
  assert.equal(result.y, 158);
  assertInside(result, workArea);
});

test("status pill stays inside a display with negative coordinates", () => {
  const workArea = { x: -1920, y: -80, width: 1920, height: 1080 };
  const result = positionStatusPill({
    hitRect: { left: -1910, top: -65, right: -1800, bottom: 80 },
    workArea,
    pillSize: { width: 180, height: 50 },
  });

  assert.equal(result.placement, "below");
  assertInside(result, workArea);
});

test("activity panel uses the side with enough room and clamps vertically", () => {
  const workArea = { x: 0, y: 0, width: 1440, height: 900 };
  const result = positionActivityPanel({
    hitRect: { left: 1180, top: 720, right: 1320, bottom: 880 },
    workArea,
    panelSize: { width: 520, height: 420 },
  });

  assert.equal(result.placement, "left");
  assert.equal(result.x, 648);
  assert.equal(result.y, 480);
  assertInside(result, workArea);
});

test("activity panel opens to the right when the pet is near the left edge", () => {
  const workArea = { x: -1280, y: 0, width: 1280, height: 800 };
  const result = positionActivityPanel({
    hitRect: { left: -1260, top: 300, right: -1140, bottom: 440 },
    workArea,
    panelSize: { width: 500, height: 360 },
  });

  assert.equal(result.placement, "right");
  assert.equal(result.x, -1128);
  assertInside(result, workArea);
});

test("mini edge explicitly prefers the inward side", () => {
  const workArea = { x: 0, y: 0, width: 1200, height: 800 };
  const panelSize = { width: 480, height: 400 };

  const miniRight = positionActivityPanel({
    hitRect: { left: 1130, top: 300, right: 1230, bottom: 480 },
    workArea,
    panelSize,
    miniEdge: "right",
  });
  const miniLeft = positionActivityPanel({
    hitRect: { left: -30, top: 300, right: 70, bottom: 480 },
    workArea,
    panelSize,
    miniEdge: "left",
  });

  assert.equal(miniRight.placement, "left");
  assert.equal(miniLeft.placement, "right");
  assertInside(miniRight, workArea);
  assertInside(miniLeft, workArea);
});

test("oversized windows are reduced so strict work-area clamping remains possible", () => {
  const workArea = { x: -800, y: 100, width: 640, height: 480 };
  const result = clampBoundsToWorkArea(
    { x: -2000, y: -2000, width: 900, height: 700 },
    workArea
  );

  assert.deepStrictEqual(result, {
    x: -800,
    y: 100,
    width: 640,
    height: 480,
  });
  assertInside(result, workArea);
});
