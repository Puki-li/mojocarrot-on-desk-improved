const { describe, it } = require("node:test");
const assert = require("node:assert");

const { ASSET_HREFS, buildMojocarrotLayers, buildMouth, buildShadow } = require("../src/mojocarrot-theme");

describe("mojocarrot theme helpers", () => {
  it("builds the runtime-tracked idle layers", () => {
    const svg = buildMojocarrotLayers({
      bodyId: "body-js",
      eyesId: "eyes-js",
      shadowId: "shadow-js",
      includeLeaves: true,
      includeEyes: true,
    });

    assert.match(svg, /id="body-js"/);
    assert.match(svg, /id="eyes-js"/);
    assert.match(svg, /id="shadow-js"/);
    assert.match(svg, new RegExp(ASSET_HREFS.stemless.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, new RegExp(ASSET_HREFS.leaves.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("does not render a mouth unless a mouth module is explicitly configured", () => {
    const svg = buildMojocarrotLayers({
      sleeping: true,
      includeEyes: false,
      includeLeaves: true,
    });

    assert.match(svg, new RegExp(ASSET_HREFS.sleep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(svg, /mouth-/);
  });

  it("can build sleeping layers with an explicit mouth module", () => {
    const svg = buildMojocarrotLayers({
      sleeping: true,
      includeEyes: false,
      includeLeaves: true,
      mouth: {
        className: "mouth-doze",
      },
    });

    assert.match(svg, new RegExp(ASSET_HREFS.sleep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(svg, /id="eyes-js"/);
    assert.match(svg, /mouth-doze/);
    assert.match(svg, new RegExp(ASSET_HREFS.mouth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(svg, /<path d="M5\.8 11\.45/);
  });

  it("renders standalone shadow and mouth helpers", () => {
    assert.match(buildShadow({ id: "shadow-js", className: "shadow-anim" }), /shadow-anim/);
    assert.match(buildMouth({ className: "mouth-happy" }), /mouth-happy/);
  });
});
