const { describe, it } = require("node:test");
const assert = require("node:assert");

const { buildGifSpecs, buildCaptureHtml } = require("../scripts/generate-readme-gifs-lib");

describe("generate readme gifs lib", () => {
  it("includes a dedicated idle-follow demo gif spec", () => {
    const specs = buildGifSpecs();
    const spec = specs.find((entry) => entry.gif === "clawd-idle-follow-demo.gif");

    assert.ok(spec);
    assert.strictEqual(spec.svg, "clawd-idle-follow.svg");
    assert.strictEqual(spec.scene, "idle-follow-demo");
  });

  it("builds a scripted capture scene for the idle-follow demo gif", () => {
    const html = buildCaptureHtml({
      gif: "clawd-idle-follow-demo.gif",
      svg: "clawd-idle-follow.svg",
      durationMs: 3200,
      fps: 12,
      size: 320,
      scale: 0.9,
      scene: "idle-follow-demo",
    });

    assert.match(html, /id="cursor"/);
    assert.match(html, /const keyframes = \[/);
    assert.match(html, /sprite\.contentDocument/);
    assert.match(html, /getElementById\("eyes-js"\)/);
    assert.match(html, /requestAnimationFrame\(frame\)/);
  });
});
