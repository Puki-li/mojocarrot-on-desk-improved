const { describe, it } = require("node:test");
const assert = require("node:assert");

const { buildEyes, buildMouth } = require("../src/mojocarrot-face");

describe("mojocarrot face helpers", () => {
  it("renders focused eyes as grouped vector markup", () => {
    const svg = buildEyes("focused", { id: "eyes-focused", className: "eyes-code" });
    assert.match(svg, /id="eyes-focused"/);
    assert.match(svg, /class="eyes-code"/);
    assert.match(svg, /rect/);
  });

  it("renders surprised eyes without relying on image tags", () => {
    const svg = buildEyes("surprised");
    assert.match(svg, /ellipse/);
    assert.doesNotMatch(svg, /image href=/);
  });

  it("renders different mouth shapes for different moods", () => {
    const smile = buildMouth("smile", { className: "mouth-happy" });
    const gasp = buildMouth("gasp", { className: "mouth-alert" });
    assert.match(smile, /mouth-happy/);
    assert.match(smile, /path/);
    assert.match(gasp, /mouth-alert/);
    assert.match(gasp, /ellipse/);
  });
});
