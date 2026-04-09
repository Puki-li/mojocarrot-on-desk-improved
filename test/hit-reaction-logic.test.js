const { describe, it } = require("node:test");
const assert = require("node:assert");

const { getFaceReactionDirection } = require("../src/hit-reaction-logic");

describe("hit reaction face zoning", () => {
  const hitBox = { x: -2, y: -16, w: 19, h: 31 };
  const width = 200;
  const height = 320;

  it("maps clicks on the left half of the face to react-left", () => {
    const dir = getFaceReactionDirection(55, 190, width, height, hitBox);
    assert.strictEqual(dir, "left");
  });

  it("maps clicks on the right half of the face to react-right", () => {
    const dir = getFaceReactionDirection(145, 190, width, height, hitBox);
    assert.strictEqual(dir, "right");
  });

  it("ignores leaf clicks above the face zone", () => {
    const dir = getFaceReactionDirection(100, 28, width, height, hitBox);
    assert.strictEqual(dir, null);
  });

  it("ignores lower-body clicks below the face zone", () => {
    const dir = getFaceReactionDirection(100, 308, width, height, hitBox);
    assert.strictEqual(dir, null);
  });
});
