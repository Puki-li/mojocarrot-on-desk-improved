const fs = require("fs");
const path = require("path");
const { describe, it } = require("node:test");
const assert = require("node:assert");
const { ASSET_HREFS } = require("../src/mojocarrot-theme");

function readSvg(name) {
  return fs.readFileSync(path.join(__dirname, "..", "assets", "svg", name), "utf8");
}

const mouthPattern = /class="[^"]*\bmouth(?:-[^"\s]+)?\b[^"]*"/;

describe("mojocarrot svg motion", () => {
  it("keeps idle follow on the original mojocarrot eye asset with blink animation", () => {
    const svg = readSvg("clawd-idle-follow.svg");
    assert.match(svg, /id="eyes-js"/);
    assert.match(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, /@keyframes blink[\s\S]*scaleY\(0\.1\)/);
  });

  it("keeps typing eyes on the prototype asset with the pre-redesign scan motion", () => {
    const svg = readSvg("clawd-working-typing.svg");
    assert.match(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, /@keyframes eye-code[\s\S]*57% \{ transform: translate\(-1px, -0\.5px\) scaleY\(1\); \}[\s\S]*62% \{ transform: translate\(1\.5px, -0\.5px\) scaleY\(1\); \}[\s\S]*71% \{ transform: translate\(1px, -0\.3px\) scaleY\(0\.1\); \}/);
    assert.match(svg, /class="[^"]*\bmouth\b[^"]*\beyes-code\b[^"]*"/);
    assert.match(svg, /class="key-flash kf1" x="4\.4" y="1\.3" width="0\.9" height="0\.7" fill="#7CE7F2"/);
    assert.match(svg, /class="key-flash kf2" x="9\.2" y="1\.3" width="0\.9" height="0\.7" fill="#FFD93D"/);
    assert.match(svg, /class="key-flash kf3" x="2\.9" y="2\.2" width="0\.9" height="0\.7" fill="#FF8A3D"/);
    assert.match(svg, /class="key-flash kf4" x="7\.7" y="2\.2" width="0\.9" height="0\.7" fill="#FF5DA2"/);
    assert.match(svg, /class="key-flash kf5" x="11\.6" y="1\.3" width="0\.9" height="0\.7" fill="#C8FF72"/);
    assert.match(svg, /class="key-flash kf6" x="3\.5" y="0\.4" width="6" height="0\.7" rx="0\.2" fill="#B88CFF"/);
    assert.match(svg, /class="code-line cl4" x="0\.5" y="1\.6" width="2" height="0\.7" fill="#FFC107" opacity="0\.7"/);
  });

  it("keeps yawn as a restrained eye-only sleepy cue and wake as the separate recovery transition", () => {
    const svg = readSvg("clawd-idle-yawn.svg");
    const wake = readSvg("clawd-wake.svg");

    assert.match(svg, /class="eyes-yawn"/);
    assert.doesNotMatch(svg, /class="face-yawn"/);
    assert.match(svg, /@keyframes yawn-body \{[\s\S]*0%, 100% \{ transform: translate\(0, 0\) rotate\(0deg\); \}/);
    assert.match(svg, /@keyframes yawn-eyes \{[\s\S]*48% \{ transform: translate\(0, 0\.04px\) scaleY\(0\.78\); \}[\s\S]*72% \{ transform: translate\(0, 0\.06px\) scaleY\(0\.64\); \}/);
    assert.doesNotMatch(svg, /@keyframes yawn-face/);
    assert.doesNotMatch(svg, /mouth-yawn/);
    assert.match(wake, /class="mouth eyes-wake"/);
    assert.match(wake, /@keyframes wake-eyes \{[\s\S]*0%, 20% \{ transform: scaleY\(0\.15\); \}[\s\S]*38%, 100% \{ transform: scaleY\(1\); \}/);
    assert.doesNotMatch(wake, /@keyframes wake-mouth/);
  });

  it("keeps notification eyes on the prototype asset with alert squash timing", () => {
    const svg = readSvg("clawd-notification.svg");
    assert.match(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, /@keyframes eye-track[\s\S]*scaleY\(0\.3\)/);
    assert.match(svg, /@keyframes eye-track[\s\S]*translate\(-4px, 0\)/);
    assert.match(svg, /class="mouth eyes-note"/);
  });

  it("keeps drag face on the prototype asset without a custom squint animation", () => {
    const svg = readSvg("clawd-react-drag.svg");
    assert.match(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, /class="mouth"/);
    assert.doesNotMatch(svg, /eyes-drag/);
  });

  it("keeps error eyes on the prototype asset with tired compression", () => {
    const svg = readSvg("clawd-error.svg");
    assert.doesNotMatch(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(svg, /class="face-error"/);
    assert.match(svg, /rotate\(45 0\.11 1\.27\)/);
    assert.match(svg, /rotate\(-45 0\.11 1\.27\)/);
    assert.match(svg, /M5\.95 13\.55 Q7\.5 12\.7 9\.05 13\.55/);
  });

  it("renders the prototype mouth in every scene that renders eyes", () => {
    const withEyes = [
      "clawd-idle-follow.svg",
      "clawd-idle-look.svg",
      "clawd-idle-living.svg",
      "clawd-idle-reading.svg",
      "clawd-idle-yawn.svg",
      "clawd-wake.svg",
      "clawd-working-thinking.svg",
      "clawd-working-typing.svg",
      "clawd-working-debugger.svg",
      "clawd-working-building.svg",
      "clawd-working-juggling.svg",
      "clawd-working-conducting.svg",
      "clawd-working-sweeping.svg",
      "clawd-working-carrying.svg",
      "clawd-happy.svg",
      "clawd-notification.svg",
      "clawd-react-left.svg",
      "clawd-react-right.svg",
      "clawd-react-double.svg",
      "clawd-react-double-jump.svg",
      "clawd-react-annoyed.svg",
      "clawd-react-drag.svg",
      "clawd-mini-idle.svg",
      "clawd-mini-peek.svg",
      "clawd-mini-enter.svg",
      "clawd-mini-alert.svg",
      "clawd-mini-happy.svg",
      "clawd-mini-crabwalk.svg",
      "clawd-working-ultrathink.svg",
      "clawd-react-wizard.svg",
      "clawd-static-base.svg",
    ];

    withEyes.forEach((name) => {
      assert.match(readSvg(name), mouthPattern);
    });
  });

  it("uses the prototype mouth asset anywhere a mouth is rendered", () => {
    const typing = readSvg("clawd-working-typing.svg");
    const annoyed = readSvg("clawd-react-annoyed.svg");
    const yawn = readSvg("clawd-idle-yawn.svg");

    assert.match(typing, new RegExp(ASSET_HREFS.mouth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(annoyed, new RegExp(ASSET_HREFS.mouth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(yawn, new RegExp(ASSET_HREFS.mouth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });

  it("renders non-mojocarrot overlay effects above the mojocarrot layers", () => {
    const typing = readSvg("clawd-working-typing.svg");
    const building = readSvg("clawd-working-building.svg");
    const sleeping = readSvg("clawd-sleeping.svg");
    const doze = readSvg("clawd-idle-doze.svg");

    assert.ok(typing.indexOf('class="eyes-code"') < typing.indexOf('id="screen"'));
    assert.ok(typing.indexOf('id="screen"') < typing.indexOf('id="keyboard"'));
    assert.ok(building.indexOf('class="eyes-build"') < building.indexOf('class="hot-metal"'));
    assert.ok(sleeping.indexOf('class="body-sleep"') < sleeping.indexOf('class="z-particle z1"'));
    assert.match(sleeping, /class="z-particle z1" fill="#80DEEA"/);
    assert.match(sleeping, /class="z-particle z2" fill="#B3E5FC"/);
    assert.match(sleeping, /class="z-particle z3" fill="#E1F5FE"/);
    assert.ok(doze.indexOf('class="body-doze"') < doze.indexOf('class="z-particle z1"'));
    assert.match(doze, /class="z-particle z1" fill="#80DEEA"/);
    assert.match(doze, /class="z-particle z2" fill="#B3E5FC"/);
  });

  it("keeps notification overlay choreography from the clawd mother asset", () => {
    const svg = readSvg("clawd-notification.svg");

    assert.match(svg, /\.alert-pop \{[^}]*animation: alert-flash 3\.5s infinite ease-in-out;/);
    assert.match(svg, /@keyframes body-jump[\s\S]*20%[\s\S]*translate\(0, -10px\)/);
    assert.match(svg, /@keyframes body-jump[\s\S]*25%[\s\S]*translate\(0, 1\.5px\)[\s\S]*30%[\s\S]*translate\(0, -8px\)/);
    assert.match(svg, /@keyframes shadow-pulse[\s\S]*20%[\s\S]*scale\(0\.5\)/);
    assert.match(svg, /@keyframes shadow-pulse[\s\S]*25%[\s\S]*scale\(1\.12\)/);
    assert.match(svg, /@keyframes alert-flash[\s\S]*3%[\s\S]*scale\(1\.3\)/);
    assert.match(svg, /@keyframes alert-flash[\s\S]*55%[\s\S]*scale\(0\.9\)/);
    assert.match(svg, /class="shadow-note"[\s\S]*class="body-note"[\s\S]*class="mouth eyes-note"[\s\S]*class="alert-pop"/);
  });

  it("keeps building overlay choreography from the clawd mother asset", () => {
    const svg = readSvg("clawd-working-building.svg");

    assert.match(svg, /\.hot-metal \{[^}]*animation: metal-glow 1\.2s infinite;/);
    assert.match(svg, /\.hammer-build \{[^}]*animation: hammer-swing 1\.2s infinite;/);
    assert.match(svg, /@keyframes hammer-swing[\s\S]*50%[\s\S]*rotate\(125deg\)/);
    assert.doesNotMatch(svg, /class="helmet-build"/);
    assert.match(svg, /@keyframes spark-1[\s\S]*70%[\s\S]*translate\(4px, -6px\)/);
    assert.match(svg, /@keyframes spark-2[\s\S]*70%[\s\S]*translate\(7px, -1px\)/);
    assert.match(svg, /@keyframes spark-3[\s\S]*70%[\s\S]*translate\(3px, 3px\)/);
    assert.match(svg, /<rect x="16" y="15" width="7" height="1" fill="#000000" opacity="0\.4"\/>/);
  });

  it("keeps juggling overlay choreography from the clawd mother asset", () => {
    const svg = readSvg("clawd-working-juggling.svg");

    assert.match(svg, /\.packet \{[^}]*animation: juggle 1\.2s infinite;/);
    assert.match(svg, /@keyframes juggle[\s\S]*30%[\s\S]*translate\(8px, -1px\)[\s\S]*50%[\s\S]*translate\(14px, 10px\)/);
    assert.match(svg, /<circle cx="0" cy="0" r="1\.2" fill="#FF5252"\/>/);
    assert.match(svg, /<circle cx="0" cy="0" r="1\.2" fill="#FFC107"\/>/);
    assert.match(svg, /<circle cx="0" cy="0" r="1\.2" fill="#4CAF50"\/>/);
  });

  it("keeps reading props and timing from the clawd mother asset", () => {
    const svg = readSvg("clawd-idle-reading.svg");

    assert.match(svg, /\.book \{[^}]*animation: book-anim 14s infinite ease-in-out;/);
    assert.match(svg, /\.reading-fx \{[^}]*animation: reading-fx-vis 14s infinite;/);
    assert.match(svg, /@keyframes float-thought[\s\S]*10% \{ opacity: 0\.72; \}/);
    assert.match(svg, /class="reading-fx reading-fx-back"/);
    assert.match(svg, /class="reading-fx reading-fx-front"/);
    assert.match(svg, /fill="#FFD54F"/);
    assert.match(svg, /fill="#FF8A80"/);
    assert.match(svg, /class="thought-bit t7" fill="#80CBC4"/);
    assert.match(svg, /class="thought-bit t8" fill="#FFB74D"/);
    assert.match(
      svg,
      /class="reading-fx reading-fx-back"[\s\S]*class="shadow-read"[\s\S]*class="body-read"[\s\S]*class="reading-fx reading-fx-front"/
    );
    assert.match(svg, /@keyframes book-anim[\s\S]*26%[\s\S]*scaleX\(1\)[\s\S]*84%[\s\S]*translate\(0, 4px\)/);
  });

  it("keeps debugger magnifier choreography from the clawd mother asset", () => {
    const svg = readSvg("clawd-working-debugger.svg");

    assert.match(svg, /\.orbit-debug \{[^}]*animation: orbit-debug 4s infinite linear;/);
    assert.match(svg, /\.glass-vis \{[^}]*animation: glass-vis 14s infinite linear;/);
    assert.match(svg, /\.shadow-debug \{[^}]*animation: shadow-main 6s infinite linear;/);
    assert.match(svg, /@keyframes orbit-debug \{[\s\S]*25% \{ transform: translate\(2\.6px, 0\); \}[\s\S]*50% \{ transform: translate\(0, 2\.6px\); \}[\s\S]*75% \{ transform: translate\(-2\.6px, 0\); \}/);
    assert.match(svg, /@keyframes glass-vis[\s\S]*9%[\s\S]*opacity: 1;[\s\S]*84%[\s\S]*opacity: 0;/);
    assert.match(svg, /transform="translate\(13\.3, 8\.2\)"/);
    assert.match(svg, /<polygon points="0\.5,1\.5 1\.5,0\.5 -1,-2 -2,-1" fill="#795548" \/>/);
    assert.match(svg, /<rect x="-6" y="-5" width="6" height="6" fill="#546E7A" rx="2" \/>/);
    assert.match(svg, /<rect x="-4" y="-3\.5" width="2" height="3" fill="#000000" \/>/);
    assert.match(svg, /<rect x="-5\.5" y="-4\.5" width="5" height="5" fill="#E0F7FA" rx="1\.5" opacity="0\.6" \/>/);
    assert.doesNotMatch(svg, /arm-l/);
    assert.doesNotMatch(svg, /arm-r/);
    assert.doesNotMatch(svg, /legs-sneak/);
    assert.doesNotMatch(svg, /legs-idle/);
  });

  it("lets conducting intentionally reuse the ultrathink choreography", () => {
    const svg = readSvg("clawd-working-conducting.svg");

    assert.match(svg, /\.ul \{[^}]*animation: text-pulse 1s infinite ease-in-out;/);
    assert.match(svg, /<text x="-1\.6" y="-12" font-size="3\.5" font-family="monospace" font-weight="700">/);
    assert.match(svg, /<tspan class="ul ul0" fill="#FF5252">s<\/tspan><tspan class="ul ul1" fill="#FF9800">t<\/tspan><tspan class="ul ul2" fill="#FFC107">a<\/tspan><tspan class="ul ul3" fill="#4CAF50">y<\/tspan>/);
    assert.match(svg, /<tspan class="ul ul4" fill="#2196F3">r<\/tspan><tspan class="ul ul5" fill="#7E57C2">e<\/tspan><tspan class="ul ul6" fill="#26C6DA">a<\/tspan><tspan class="ul ul7" fill="#66BB6A">l<\/tspan>/);
    assert.match(svg, /<g class="body-ultra">[\s\S]*class="eyes-ultra"[\s\S]*class="mouth eyes-ultra"/);
    assert.doesNotMatch(svg, /\.f1, \.f2, \.f3, \.f4, \.f5 \{/);
    assert.doesNotMatch(svg, /\.eyes-dispatch \{/);
    assert.doesNotMatch(svg, /runner-flock-anchor/);
  });

  it("keeps sweeping broom story arc from the clawd mother asset", () => {
    const svg = readSvg("clawd-working-sweeping.svg");

    assert.match(svg, /\.arm-r \{[^}]*animation: arm-right 10s infinite ease-in-out;/);
    assert.match(svg, /\.dust-1 \{[^}]*animation: dust1 10s infinite;/);
    assert.match(svg, /\.dust-4 \{[^}]*animation: dust4 10s infinite;/);
    assert.match(svg, /\.dust-5 \{[^}]*animation: dust5 10s infinite;/);
    assert.match(svg, /class="sweat-anchor-1" transform="translate\(2, 4\)"><g class="sweat-1" fill="#40C4FF"/);
    assert.match(svg, /class="sweat-anchor-2" transform="translate\(0\.5, 6\)"><g class="sweat-2" fill="#40C4FF"/);
    assert.match(svg, /<polygon points="11\.2,14\.2 16\.1,14\.2 16\.9,16\.25 10\.4,16\.25" fill="#FFC107" \/>/);
    assert.match(svg, /<rect x="13\.65" y="14\.45" width="0\.35" height="1\.6" fill="#C99700" opacity="0\.38" \/>/);
    assert.match(svg, /@keyframes arm-right[\s\S]*10%[\s\S]*rotate\(-15deg\)[\s\S]*80%[\s\S]*rotate\(-15deg\)/);
  });

  it("keeps carrying rush props from the clawd mother asset", () => {
    const svg = readSvg("clawd-working-carrying.svg");

    assert.match(svg, /\.runner-flock-anchor \{[^}]*transform-origin: 0 0;/);
    assert.match(svg, /\.runner-flock \{[^}]*animation: runner-pass 4\.9s infinite linear;/);
    assert.match(svg, /\.runner-bob \{[^}]*animation: runner-bob 0\.32s infinite ease-in-out;/);
    assert.match(svg, /\.cherry-dust-1 \{[^}]*animation: cherry-dust-1 4\.9s infinite linear;/);
    assert.match(svg, /\.cherry-dust-2 \{[^}]*animation: cherry-dust-2 4\.9s infinite linear;/);
    assert.match(svg, /\.cherry-dust-3 \{[^}]*animation: cherry-dust-3 4\.9s infinite linear;/);
    assert.match(svg, /\.watermelon-dust-1 \{[^}]*animation: watermelon-dust-1 4\.9s infinite linear;/);
    assert.match(svg, /\.watermelon-dust-2 \{[^}]*animation: watermelon-dust-2 4\.9s infinite linear;/);
    assert.match(svg, /\.watermelon-dust-3 \{[^}]*animation: watermelon-dust-3 4\.9s infinite linear;/);
    assert.match(svg, /\.eyes-carry \{[^}]*animation: eyes-gaze 2\.5s infinite;/);
    assert.match(svg, /<clipPath id="carrying-lane-clip" clipPathUnits="userSpaceOnUse">[\s\S]*<rect x="-5" y="-2" width="54" height="24" \/>[\s\S]*<\/clipPath>/);
    assert.match(svg, /class="runner-flock-anchor" transform="translate\(0\.6, 7\.6\) scale\(0\.62\)"/);
    assert.match(svg, /class="runner-flock" clip-path="url\(#carrying-lane-clip\)"/);
    assert.match(svg, /id="runner-asset-10"/);
    assert.match(svg, /id="runner-asset-11"/);
    assert.match(svg, /id="runner-asset-12"/);
    assert.match(svg, /id="runner-asset-14"/);
    assert.match(svg, /<g class="cherry-dust-1" fill="#D7D7D7">/);
    assert.match(svg, /<g class="watermelon-dust-1" fill="#D7D7D7">/);
    assert.doesNotMatch(svg, /\.pack-swing \{/);
    assert.doesNotMatch(svg, /\.cap-sway \{/);
    assert.match(svg, /@keyframes runner-pass \{[\s\S]*0%, 6% \{ transform: translate\(-60px, 0\); \}[\s\S]*30% \{ transform: translate\(58px, 0\); \}[\s\S]*36%, 44% \{ transform: translate\(58px, 0\); \}[\s\S]*68% \{ transform: translate\(-60px, 0\); \}[\s\S]*74%, 100% \{ transform: translate\(-60px, 0\); \}/);
    assert.match(svg, /@keyframes eyes-gaze[\s\S]*25%, 80%[\s\S]*translate\(0, 0\)/);
  });

  it("keeps mini alert eye switch while removing the arm", () => {
    const svg = readSvg("clawd-mini-alert.svg");

    assert.doesNotMatch(svg, /\.arm-alert \{/);
    assert.doesNotMatch(svg, /class="arm-alert"/);
    assert.match(svg, /\.eyes-alert \{[^}]*animation: rect-move 4s infinite ease-in-out;/);
    assert.match(svg, /<use href="#pixel-alert" x="-8" y="5" \/>/);
    assert.match(svg, /@keyframes alert-flash[\s\S]*12%[\s\S]*translate\(0, -4px\) scale\(1\.2\)/);
  });

  it("keeps idle look timing close to the clawd mother asset", () => {
    const svg = readSvg("clawd-idle-look.svg");

    assert.match(svg, /\.action-body \{[^}]*animation: action-body 10s infinite ease-in-out;/);
    assert.match(svg, /\.eyes-look \{[^}]*animation: eye-track 10s infinite ease-in-out;/);
    assert.match(svg, /@keyframes action-body \{[\s\S]*12%, 22% \{ transform: scale\(1,1\) translate\(1px, 0\); \}[\s\S]*48%, 57% \{ transform: scale\(1,1\) translate\(-1px, 0\); \}/);
    assert.match(svg, /@keyframes eye-track \{[\s\S]*12%, 22% \{ transform: translate\(3px, 0\); \}[\s\S]*48%, 57% \{ transform: translate\(-3px, 0\); \}/);
    assert.match(svg, /class="mouth eyes-look eyes-blink"/);
    assert.doesNotMatch(svg, /\.arm-l-idle \{/);
  });

  it("keeps idle living face motion while removing hand and drool props", () => {
    const svg = readSvg("clawd-idle-living.svg");

    assert.match(svg, /\.eyes-look \{[^}]*animation: eye-track 16s infinite ease-in-out;/);
    assert.match(svg, /class="mouth eyes-blink"/);
    assert.doesNotMatch(svg, /\.arm-l-idle \{/);
    assert.doesNotMatch(svg, /\.arm-r-idle \{/);
    assert.doesNotMatch(svg, /\.yawn-mouth \{/);
    assert.doesNotMatch(svg, /\.yawn-tear \{/);
  });

  it("keeps thinking bubble choreography from the clawd mother asset", () => {
    const svg = readSvg("clawd-working-thinking.svg");

    assert.match(svg, /\.body-think \{[^}]*animation: body-think 12s infinite ease-in-out;/);
    assert.match(svg, /@keyframes body-think \{[\s\S]*0%, 35%, 80%, 100% \{ transform: rotate\(0deg\) translate\(0, 0\); \}[\s\S]*50% \{ transform: rotate\(1\.5deg\) translate\(0\.3px, 0\); \}/);
    assert.match(svg, /@keyframes eyes-think \{[\s\S]*16% \{ transform: translate\(0\.5px, -0\.3px\) scaleY\(0\.1\); \}[\s\S]*56% \{ transform: translate\(-0\.5px, 0\) scaleY\(1\); \}[\s\S]*76% \{ transform: translate\(-0\.5px, 0\) scaleY\(0\.1\); \}/);
    assert.match(svg, /\.bubble-h \{[^}]*animation: morph-h 5s infinite ease-in-out;/);
    assert.match(svg, /\.bubble-v \{[^}]*animation: morph-v 4s infinite ease-in-out;/);
    assert.match(svg, /transform="translate\(-8, -9\)"/);
    assert.match(svg, /class="dot d1" x="2\.5" y="4" width="1" height="1" fill="#1D8A95"/);
    assert.match(svg, /class="dot d2" x="5\.5" y="4" width="1" height="1" fill="#A88400"/);
    assert.match(svg, /class="dot d3" x="8\.5" y="4" width="1" height="1" fill="#C95E18"/);
    assert.match(svg, /class="[^"]*\bmouth\b[^"]*\beyes-think\b[^"]*"/);
    assert.ok(svg.indexOf('class="eyes-think"') < svg.indexOf('transform="translate(-8, -9)"'));
    assert.doesNotMatch(svg, /arm-l-think/);
    assert.doesNotMatch(svg, /arm-r-think/);
  });

  it("keeps error fan and warning cadence from the clawd mother asset", () => {
    const svg = readSvg("clawd-error.svg");

    assert.match(svg, /\.error-text \{[^}]*animation: error-flash 0\.8s infinite ease-in-out;/);
    assert.match(svg, /class="bandage-mark bandage-right"/);
    assert.doesNotMatch(svg, /class="bandage-mark bandage-left"/);
    assert.match(svg, /transform="translate\(13\.9, 7\.4\)"/);
    assert.match(svg, /\.puff \{[^}]*animation: puff-smoke 1\.6s infinite ease-out;/);
    assert.match(svg, /class="puff-anchor puff-anchor-1" transform="translate\(6\.95, 0\.45\)"/);
    assert.match(svg, /class="puff-anchor puff-anchor-2" transform="translate\(8\.1, -0\.2\)"/);
    assert.match(svg, /animation-delay: 0\.55s;/);
    assert.match(svg, /filter: saturate\(0\.42\) brightness\(0\.42\) hue-rotate\(34deg\)/);
    assert.match(svg, />ERROR<\/text>/);
    assert.match(svg, /fill="#FFD60A"/);
    assert.match(svg, /transform="translate\(3\.15, 5\.1\)"/);
    assert.doesNotMatch(svg, /class="arm-fan"/);
    assert.doesNotMatch(svg, /<rect x="0" y="0" width="8" height="2" fill="#C0392B"/);
  });

  it("keeps happy sparkle cadence from the clawd mother asset", () => {
    const svg = readSvg("clawd-happy.svg");

    assert.match(svg, /\.happy-bounce \{[^}]*animation: bounce 1s infinite ease-in-out;/);
    assert.match(svg, /\.spark-center \{[^}]*animation: flash-center 1\.5s infinite step-end;/);
    assert.match(svg, /\.spark-outer \{[^}]*animation: flash-outer 1\.5s infinite step-end;/);
    assert.match(svg, /<g id="px-sparkle">/);
    assert.match(svg, /<use href="#px-sparkle" x="-4" y="-2" fill="#FFD93D" style="--delay: 0\.0s"\/>/);
    assert.match(svg, /<use href="#px-sparkle" x="18" y="-4" fill="#FF8A3D" style="--delay: 0\.3s"\/>/);
    assert.match(svg, /<use href="#px-sparkle" x="20" y="10" fill="#7CE7F2" style="--delay: 0\.6s"\/>/);
    assert.match(svg, /<use href="#px-sparkle" x="-6" y="12" fill="#FF5DA2" style="--delay: 0\.9s"\/>/);
    assert.match(svg, /<use href="#px-sparkle" x="7" y="-8" fill="#C8FF72" style="--delay: 1\.2s"\/>/);
    assert.match(svg, /<use href="#px-sparkle" x="-2" y="6" fill="#B88CFF" style="--delay: 0\.7s"\/>/);
  });

  it("keeps left and right react gaze choreography while removing the arms", () => {
    const left = readSvg("clawd-react-left.svg");
    const right = readSvg("clawd-react-right.svg");

    assert.doesNotMatch(left, /arm-l-react/);
    assert.doesNotMatch(right, /arm-r-react/);
    assert.match(left, /@keyframes eyes-look-l[\s\S]*translate\(-3px, 0\)/);
    assert.match(right, /@keyframes eyes-look-r[\s\S]*translate\(3px, 0\)/);
    assert.match(left, /\.eyes-blink \{[^}]*animation: blink 3s infinite linear;/);
    assert.match(right, /\.eyes-blink \{[^}]*animation: blink 3s infinite linear;/);
    assert.match(right, /@keyframes question-r[\s\S]*translate\(6px, 6px\)[\s\S]*translate\(8px, -2px\)[\s\S]*translate\(8px, -8px\)/);
    assert.match(right, /<g class="question-pop" fill="#FFC107" transform="translate\(10, 0\)"><use href="#pixel-question" \/><\/g>/);
  });

  it("lets react-double reuse carrying while react-annoyed reuses the panic timing", () => {
    const doubleCarry = readSvg("clawd-react-double.svg");
    const annoyed = readSvg("clawd-react-annoyed.svg");

    assert.match(doubleCarry, /\.runner-flock \{[^}]*animation: runner-pass 4\.9s infinite linear;/);
    assert.match(doubleCarry, /class="runner-flock" clip-path="url\(#carrying-lane-clip\)"/);
    assert.match(doubleCarry, /class="runner-flock-anchor" transform="translate\(0\.6, 7\.6\) scale\(0\.62\)"/);
    assert.match(doubleCarry, /id="runner-asset-10"/);
    assert.match(doubleCarry, /id="runner-asset-11"/);
    assert.match(doubleCarry, /\.cherry-dust-1 \{[^}]*animation: cherry-dust-1 4\.9s infinite linear;/);
    assert.doesNotMatch(doubleCarry, /question-fade/);
    assert.doesNotMatch(doubleCarry, /excl-fade/);

    assert.match(annoyed, /\.body-panic \{[^}]*animation: body-panic 3\.5s 1 ease-in-out forwards;/);
    assert.match(annoyed, /@keyframes body-panic \{[\s\S]*10%, 18% \{ transform: translate\(-1px, 0\); \}[\s\S]*24%, 32% \{ transform: translate\(1px, 0\); \}[\s\S]*46%, 72% \{ transform: translate\(1px, -1px\); \}/);
    assert.match(annoyed, /@keyframes eyes-panic \{[\s\S]*10%, 18% \{ transform: translate\(-2px, 0\); \}[\s\S]*24%, 32% \{ transform: translate\(2px, 0\); \}[\s\S]*46%, 72% \{ transform: translate\(3px, -2px\); \}/);
    assert.match(annoyed, /@keyframes blink \{[\s\S]*22%, 62%, 82% \{ transform: scaleY\(0\.1\); \}/);
    assert.match(annoyed, /@keyframes question-fade \{[\s\S]*12%, 38% \{ opacity: 1; transform: translate\(-4px, 0\) scale\(1\); \}[\s\S]*44%, 100% \{ opacity: 0; transform: translate\(-4px, -4px\) scale\(1\.2\); \}/);
    assert.match(annoyed, /@keyframes excl-fade \{[\s\S]*48%, 72% \{ opacity: 1; transform: translate\(6px, -4px\) scale\(1\); \}[\s\S]*80%, 100% \{ opacity: 0; transform: translate\(6px, -8px\) scale\(1\.2\); \}/);
    assert.match(annoyed, /class="[^"]*\bmouth\b[^"]*\beyes-panic\b[^"]*\beyes-blink\b[^"]*"/);
    assert.doesNotMatch(annoyed, /sigh-puff/);
  });

  it("keeps double jump and drag motion scaffolding from the clawd mother asset", () => {
    const jump = readSvg("clawd-react-double-jump.svg");
    const drag = readSvg("clawd-react-drag.svg");

    assert.match(jump, /\.body-jump \{[^}]*animation: body-jump 3\.5s 1 ease-in-out forwards;/);
    assert.match(jump, /\.face-jitter \{[^}]*animation: face-jitter 3\.5s 1 ease-in-out forwards;/);
    assert.match(jump, /@keyframes face-jitter \{[\s\S]*12% \{ transform: translate\(-1px, 0\) scaleY\(1\.12\); \}[\s\S]*20% \{ transform: translate\(-0\.8px, 0\.2px\) scaleY\(0\.18\); \}[\s\S]*28% \{ transform: translate\(-0\.6px, 0\.1px\) scaleY\(0\.28\); \}/);
    assert.match(jump, /class="[^"]*\bmouth\b[^"]*\bface-jitter\b[^"]*"/);
    assert.match(jump, /\.excl-pop \{[^}]*transform-origin: center;[^}]*animation: excl-pop 3\.5s 1 ease-in-out forwards;/);
    assert.match(jump, /@keyframes excl-pop \{[\s\S]*0%, 4% \{ opacity: 0; transform: translate\(0, 10px\) scale\(0\.3\); \}[\s\S]*10% \{ opacity: 1; transform: translate\(0, 0\) scale\(1\.3\); \}[\s\S]*42% \{ opacity: 0; transform: translate\(0, -2px\) scale\(0\.8\); \}/);
    assert.match(jump, /<g class="excl-pop" fill="#0082FC" transform="translate\(15, -2\)"><use href="#pixel-alert" \/><\/g>/);
    assert.match(drag, /\.body-drag \{[^}]*animation: sway 1\.2s infinite alternate ease-in-out;/);
    assert.match(drag, /class="shadow-drag"/);
    assert.match(drag, /class="mouth"/);
    assert.doesNotMatch(drag, /eyes-drag/);
    assert.doesNotMatch(drag, /leg-dangle/);
    assert.doesNotMatch(drag, /arm-flail/);
  });

  it("keeps the current mini-state choreography after removing all arm and leg props", () => {
    const idle = readSvg("clawd-mini-idle.svg");
    const peek = readSvg("clawd-mini-peek.svg");
    const enter = readSvg("clawd-mini-enter.svg");
    const happy = readSvg("clawd-mini-happy.svg");
    const crabwalk = readSvg("clawd-mini-crabwalk.svg");

    assert.doesNotMatch(idle, /\.arm-wobble \{/);
    assert.doesNotMatch(idle, /class="arm-wobble"/);
    assert.doesNotMatch(peek, /peek-wave/);
    assert.doesNotMatch(peek, /class="arm-wave"/);
    assert.match(enter, /animation: bodyEnter 3\.2s cubic-bezier\(0\.22, 1, 0\.36, 1\) 1 forwards/);
    assert.doesNotMatch(enter, /armEnterWave/);
    assert.doesNotMatch(enter, /class="arm-enter-wave"/);
    assert.doesNotMatch(happy, /\.arm-happy \{/);
    assert.match(happy, /\.sparkler-wand \{[^}]*animation: sparkler-tilt 0\.4s infinite alternate ease-in-out;/);
    assert.match(crabwalk, /\.body-walk \{[^}]*animation: hunch-walk 1\.15s infinite ease-in-out;/);
    assert.match(crabwalk, /\.shadow-sneak \{[^}]*animation: shadow-shift 1\.15s infinite ease-in-out;/);
    assert.match(crabwalk, /\.leaves-walk \{[^}]*animation: leaves 0\.42s infinite alternate ease-in-out;/);
    assert.match(crabwalk, /@keyframes hunch-walk \{[\s\S]*0%, 100% \{ transform: translate\(3px, 0\.35px\) scale\(1\.02, 0\.97\); \}[\s\S]*18% \{ transform: translate\(3px, -2\.2px\) scale\(0\.97, 1\.04\); \}[\s\S]*54% \{ transform: translate\(3px, -2\.05px\) scale\(0\.97, 1\.04\); \}[\s\S]*86% \{ transform: translate\(3px, -1\.7px\) scale\(0\.98, 1\.03\); \}/);
    assert.match(crabwalk, /\.eyes-walk \{[^}]*animation: eye-blink 3\.2s infinite ease-in-out;/);
    assert.match(crabwalk, /class="mouth eyes-walk"/);
    assert.doesNotMatch(crabwalk, /crab-eyes/);
    assert.doesNotMatch(crabwalk, /\.leg-1 \{/);
    assert.doesNotMatch(crabwalk, /class="leg-1"/);
    assert.doesNotMatch(crabwalk, /class="leg-2"/);
  });

  it("keeps ultrathink props and gives wizard a transformation loop", () => {
    const ultrathink = readSvg("clawd-working-ultrathink.svg");
    const wizard = readSvg("clawd-react-wizard.svg");

    assert.doesNotMatch(ultrathink, /\.arm-tap-fast \{/);
    assert.doesNotMatch(ultrathink, /class="arm-tap-fast"/);
    assert.match(ultrathink, /\.ul \{[^}]*animation: text-pulse 1s infinite ease-in-out;/);
    assert.match(ultrathink, /<text x="-1\.6" y="-12" font-size="3\.5" font-family="monospace" font-weight="700">/);
    assert.match(ultrathink, /<tspan class="ul ul0" fill="#FF5252">s<\/tspan><tspan class="ul ul1" fill="#FF9800">t<\/tspan><tspan class="ul ul2" fill="#FFC107">a<\/tspan><tspan class="ul ul3" fill="#4CAF50">y<\/tspan>/);
    assert.match(ultrathink, /<tspan class="ul ul4" fill="#2196F3">r<\/tspan><tspan class="ul ul5" fill="#7E57C2">e<\/tspan><tspan class="ul ul6" fill="#26C6DA">a<\/tspan><tspan class="ul ul7" fill="#66BB6A">l<\/tspan>/);
    assert.match(ultrathink, /<g class="body-ultra">[\s\S]*class="eyes-ultra"[\s\S]*class="mouth eyes-ultra"/);
    assert.doesNotMatch(wizard, /\.arm-wand \{/);
    assert.doesNotMatch(wizard, /\.magic-star \{/);
    assert.match(wizard, /\.wizard-mojo \{[^}]*animation: wizard-mojo 6s infinite ease-in-out;/);
    assert.match(wizard, /\.wizard-apple \{[^}]*animation: wizard-apple 6s infinite ease-in-out;/);
    assert.match(wizard, /<g class="smoke-burst-a">[\s\S]*attributeName="opacity" values="0;0;0\.55;0\.3;0;0"[\s\S]*dur="6s" repeatCount="indefinite"/);
    assert.match(wizard, /<g class="smoke-burst-b">[\s\S]*attributeName="opacity" values="0;0;0\.55;0\.3;0;0"[\s\S]*dur="6s" repeatCount="indefinite"/);
    assert.match(wizard, /\.apple-eyes \{[^}]*animation: apple-blink 6s infinite ease-in-out;/);
    assert.match(wizard, /@keyframes apple-blink \{[\s\S]*35%, 43% \{ transform: scaleY\(0\.08\); \}/);
    assert.match(wizard, /<g class="wizard-apple">[\s\S]*class="apple-body"[\s\S]*class="apple-face"/);
    assert.match(wizard, /<g class="apple-body">[\s\S]*<image href="data:image\/png;base64,[^"]+" x="-6\.4" y="-9\.2" width="24" height="24" \/>/);
    assert.match(wizard, /<g class="apple-eyes">[\s\S]*<image href="data:image\/png;base64,[^"]+" x="-6\.4" y="-9\.2" width="24" height="24" \/>/);
    assert.match(wizard, /<g class="apple-mouth">[\s\S]*<image href="data:image\/png;base64,[^"]+" x="-6\.4" y="-9\.2" width="24" height="24" \/>/);
  });

  it("keeps tracked eyes split into an outer JS wrapper and an inner animated layer", () => {
    const idle = readSvg("clawd-idle-follow.svg");
    const miniIdle = readSvg("clawd-mini-idle.svg");

    assert.match(idle, /<g id="eyes-js">\s*<g class="eyes-blink">/);
    assert.doesNotMatch(idle, /<g id="eyes-js" class="eyes-blink">/);

    assert.match(miniIdle, /<g id="eyes-js">\s*<g class="eyes-mini">/);
    assert.doesNotMatch(miniIdle, /<g id="eyes-js" class="eyes-mini">/);
  });

  it("keeps tracked mouths split into an outer JS wrapper and an inner animated layer", () => {
    const idle = readSvg("clawd-idle-follow.svg");
    const miniIdle = readSvg("clawd-mini-idle.svg");

    assert.match(idle, /<g id="mouth-js">\s*<g class="mouth eyes-blink"/);
    assert.doesNotMatch(idle, /<g id="mouth-js" class="mouth eyes-blink"/);

    assert.match(miniIdle, /<g id="mouth-js">\s*<g class="mouth eyes-mini"/);
    assert.doesNotMatch(miniIdle, /<g id="mouth-js" class="mouth eyes-mini"/);
  });

  it("groups tracked eyes and mouth under one shared face tracking wrapper", () => {
    const idle = readSvg("clawd-idle-follow.svg");
    const miniIdle = readSvg("clawd-mini-idle.svg");

    assert.match(idle, /<g id="face-js">\s*<g id="eyes-js">[\s\S]*<g id="mouth-js">/);
    assert.match(miniIdle, /<g id="face-js">\s*<g id="eyes-js">[\s\S]*<g id="mouth-js">/);
  });

  it("makes happy face layers jump together with the mojocarrot body", () => {
    const happy = readSvg("clawd-happy.svg");
    const miniHappy = readSvg("clawd-mini-happy.svg");

    assert.match(happy, /<g class="happy-bounce">[\s\S]*class="eyes-happy"[\s\S]*class="mouth eyes-happy"/);
    assert.match(miniHappy, /<g class="mini-happy-bounce">[\s\S]*class="eyes-mini"[\s\S]*class="mouth eyes-mini"/);
    assert.doesNotMatch(miniHappy, /class="arm-happy"/);
    assert.match(miniHappy, /class="sparkler-wand"/);
    assert.match(miniHappy, /<g id="px-sparkle">/);
    assert.match(miniHappy, /\.spark-center \{[^}]*animation-delay: var\(--delay, 0s\);/);
    assert.match(miniHappy, /\.spark-outer \{[^}]*animation-delay: var\(--delay, 0s\);/);
    assert.match(miniHappy, /@keyframes sparkler-tilt \{ 0% \{ transform: rotate\(38deg\); \} 100% \{ transform: rotate\(56deg\); \} \}/);
    assert.match(miniHappy, /<use href="#px-sparkle" x="-3" y="-5" fill="#FFD93D" style="--delay: 0s"\/>/);
    assert.match(miniHappy, /<use href="#px-sparkle" x="-6" y="1" fill="#FF8A3D" style="--delay: 0.4s"\/>/);
    assert.match(miniHappy, /<use href="#px-sparkle" x="0" y="-10" fill="#FFF59D" style="--delay: 0.8s"\/>/);
  });

  it("does not render face layers in sleep and doze scenes where leaves cover the face", () => {
    const hiddenFaceScenes = [
      "clawd-idle-doze.svg",
      "clawd-sleeping.svg",
      "clawd-mini-sleep.svg",
    ];

    hiddenFaceScenes.forEach((name) => {
      const svg = readSvg(name);
      assert.doesNotMatch(svg, /id="eyes-js"|id="eyes-doze"|class="[^"]*\beyes-/);
      assert.doesNotMatch(svg, mouthPattern);
      assert.doesNotMatch(svg, new RegExp(ASSET_HREFS.eyes.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.doesNotMatch(svg, new RegExp(ASSET_HREFS.mouth.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    });

    const doze = readSvg("clawd-idle-doze.svg");
    assert.match(doze, /@keyframes doze-breathe \{[\s\S]*0%, 100% \{ transform: scale\(1, 1\); \}[\s\S]*35%, 45% \{ transform: scale\(1\.02, 1\.05\) translate\(0, -0\.3px\); \}/);
  });

  it("animates collapse-sleep as a settle-then-cover transition and mini-enter-sleep as a leaf-first cover", () => {
    const collapse = readSvg("clawd-collapse-sleep.svg");
    const miniEnterSleep = readSvg("clawd-mini-enter-sleep.svg");

    assert.match(collapse, /class="leaves-collapse"/);
    assert.match(collapse, /class="leaves-settle"/);
    assert.match(collapse, /class="settle-collapse"/);
    assert.match(collapse, /class="face-settle"/);
    assert.match(collapse, /class="sleep-shadow-reveal"/);
    assert.match(collapse, /class="sleep-reveal"/);
    assert.match(collapse, new RegExp(ASSET_HREFS.sleep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(collapse.indexOf('class="face-settle"') < collapse.indexOf('class="leaves-settle"'));
    assert.ok(collapse.indexOf('class="leaves-settle"') < collapse.indexOf('class="leaves-collapse"'));
    assert.ok(collapse.indexOf('class="leaves-collapse"') < collapse.indexOf('class="sleep-reveal"'));
    assert.match(collapse, /\.settle-collapse \{[^}]*animation: settle-collapse 1\.45s ease-out forwards/);
    assert.match(collapse, /\.face-settle \{[^}]*animation: face-settle 1\.45s ease-out forwards/);
    assert.match(collapse, /\.leaves-settle \{[^}]*animation: leaves-settle 1\.45s ease-out forwards/);
    assert.match(collapse, /\.leaves-collapse \{[^}]*animation: leaves-collapse 1\.45s ease-out forwards/);
    assert.match(collapse, /\.sleep-shadow-reveal \{[^}]*animation: sleep-shadow-reveal 1\.45s ease-out forwards/);
    assert.match(collapse, /\.sleep-reveal \{[^}]*animation: sleep-reveal 1\.45s ease-out forwards/);
    assert.match(collapse, /@keyframes settle-collapse \{[\s\S]*42% \{ opacity: 1; transform: translate\(-0\.28px, 1\.2px\) rotate\(4deg\); \}[\s\S]*56%, 74% \{ opacity: 1; transform: translate\(-0\.4px, 1\.8px\) rotate\(8deg\); \}/);
    assert.match(collapse, /@keyframes face-settle \{[\s\S]*42% \{ opacity: 1; transform: translate\(-0\.28px, 1\.2px\) rotate\(4deg\); \}[\s\S]*56%, 82% \{ opacity: 1; transform: translate\(-0\.4px, 1\.8px\) rotate\(8deg\); \}/);
    assert.match(collapse, /@keyframes leaves-settle \{[\s\S]*56% \{ opacity: 1; transform: translate\(-0\.4px, 1\.8px\) rotate\(8deg\); \}[\s\S]*64% \{ opacity: 0\.72; transform: translate\(-0\.4px, 1\.8px\) rotate\(8deg\); \}/);
    assert.match(collapse, /@keyframes leaves-collapse \{[\s\S]*60% \{ opacity: 1; transform: translate\(-0\.4px, 1\.8px\) rotate\(6deg\) scale\(1\.01, 1\.01\); \}[\s\S]*78% \{ opacity: 1; transform: translate\(-0\.47px, 2\.18px\) rotate\(-14deg\) scale\(1\.02, 1\.08\); \}[\s\S]*100% \{ opacity: 0; transform: translate\(-0\.52px, 2\.8px\) rotate\(-26deg\) scale\(1\.03, 1\.13\); \}/);

    assert.match(miniEnterSleep, /class="leaves-enter-sleep"/);
    assert.doesNotMatch(miniEnterSleep, /class="face-enter-sleep"/);
    assert.doesNotMatch(miniEnterSleep, /class="eyes-enter-sleep"/);
    assert.doesNotMatch(miniEnterSleep, /class="mouth mouth-enter-sleep"/);
    assert.match(miniEnterSleep, /class="sleep-reveal"/);
    assert.match(miniEnterSleep, /class="z-particle z1"/);
    assert.match(miniEnterSleep, /class="z-particle z2"/);
    assert.match(miniEnterSleep, /class="z-particle z3"/);
    assert.match(miniEnterSleep, /id="pixel-z"/);
    assert.match(miniEnterSleep, /id="pixel-z-small"/);
    assert.match(miniEnterSleep, new RegExp(ASSET_HREFS.sleep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.ok(miniEnterSleep.indexOf('class="mouth"') < miniEnterSleep.indexOf('class="leaves-enter-sleep"'));
    assert.ok(miniEnterSleep.indexOf('class="leaves-enter-sleep"') < miniEnterSleep.indexOf('class="sleep-reveal"'));
    assert.ok(miniEnterSleep.indexOf('class="sleep-reveal"') < miniEnterSleep.indexOf('class="z-particle z1"'));
    assert.match(miniEnterSleep, /\.leaves-enter-sleep \{[^}]*animation: leaves-enter-sleep 1\.15s ease-out forwards/);
    assert.match(miniEnterSleep, /\.sleep-reveal \{[^}]*animation: sleep-reveal 1\.15s ease-out forwards/);
    assert.match(miniEnterSleep, /\.z1 \{[^}]*animation: enter-float-1 1\.15s ease-out forwards/);
    assert.match(miniEnterSleep, /\.z2 \{[^}]*animation: enter-float-2 1\.15s ease-out forwards/);
    assert.match(miniEnterSleep, /\.z3 \{[^}]*animation: enter-float-3 1\.15s ease-out forwards/);
    assert.doesNotMatch(miniEnterSleep, /face-enter-sleep 2\.6s infinite|eyes-enter-sleep 2\.6s infinite|mouth-enter-sleep 2\.6s infinite/);
    assert.match(miniEnterSleep, /@keyframes leaves-enter-sleep \{[\s\S]*28% \{ opacity: 1; transform: rotate\(-6deg\) translate\(-0\.03px, 0\.16px\) scale\(1, 1\); \}[\s\S]*36% \{ opacity: 0\.8; transform: rotate\(-10deg\) translate\(-0\.05px, 0\.42px\) scale\(1\.01, 1\.02\); \}[\s\S]*100% \{ opacity: 0; transform: rotate\(-27deg\) translate\(-0\.16px, 2\.25px\) scale\(1\.03, 1\.14\); \}/);
    assert.match(miniEnterSleep, /@keyframes enter-float-1 \{[\s\S]*0%, 54% \{ transform: translate\(4px, 7px\) scale\(0\.4\); opacity: 0; \}[\s\S]*68% \{ opacity: 0\.72; \}/);
  });
});
