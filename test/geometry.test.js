const { describe, it } = require("node:test");
const assert = require("node:assert");

const { DEFAULT_OBJECT_FRAME, getObjRect, getHitRectScreen } = require("../src/geometry");

describe("geometry helpers", () => {
  it("computes object bounds from the configured frame", () => {
    const rect = getObjRect({ x: 100, y: 200, width: 200, height: 200 });
    assert.deepStrictEqual(rect, {
      x: 10,
      y: 150,
      w: 380,
      h: 260,
    });
  });

  it("projects a state hitbox into screen coordinates", () => {
    const hit = getHitRectScreen(
      { x: 100, y: 200, width: 200, height: 200 },
      { x: -1, y: 5, w: 17, h: 12 }
    );

    assert.ok(hit.left > 100);
    assert.ok(hit.top > 200);
    assert.ok(hit.right < 300);
    assert.ok(hit.bottom < 400);
    assert.ok(hit.right - hit.left < 200);
    assert.ok(hit.bottom - hit.top < 200);
  });

  it("supports overriding the frame for future character variants", () => {
    const hit = getHitRectScreen(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 0, w: 10, h: 10 },
      { ...DEFAULT_OBJECT_FRAME, scaleW: 1, scaleH: 1, offX: 0, offY: 0 }
    );

    assert.ok(Math.abs(hit.left - 33.333333333333336) < 1e-9);
    assert.ok(Math.abs(hit.top - 55.55555555555556) < 1e-9);
    assert.ok(Math.abs(hit.right - 55.55555555555556) < 1e-9);
    assert.ok(Math.abs(hit.bottom - 77.77777777777777) < 1e-9);
  });
});
