const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const SVG_DIR = path.join(ROOT, "assets", "svg");

const SVG_EXCLUDES = new Set([
  "clawd-static-base.svg",
  "clawd-working-ultrathink.svg",
  "clawd-working-wizard.svg",
]);

const SVG_OVERRIDES = {
  "clawd-idle-follow.svg": { durationMs: 3200, fps: 12, size: 320, scale: 0.9 },
  "clawd-idle-look.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-idle-reading.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-idle-living.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-idle-yawn.svg": { durationMs: 3200, fps: 12, size: 320, scale: 0.9 },
  "clawd-idle-doze.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-collapse-sleep.svg": { durationMs: 2600, fps: 12, size: 320, scale: 0.9 },
  "clawd-sleeping.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-wake.svg": { durationMs: 2600, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-thinking.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-typing.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-debugger.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-building.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-juggling.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-conducting.svg": { durationMs: 3200, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-sweeping.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-working-carrying.svg": { durationMs: 5000, fps: 12, size: 320, scale: 0.9 },
  "clawd-error.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-happy.svg": { durationMs: 2800, fps: 12, size: 320, scale: 0.9 },
  "clawd-notification.svg": { durationMs: 2800, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-left.svg": { durationMs: 3000, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-right.svg": { durationMs: 3000, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-annoyed.svg": { durationMs: 3500, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-double.svg": { durationMs: 5000, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-double-jump.svg": { durationMs: 3600, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-drag.svg": { durationMs: 3200, fps: 12, size: 320, scale: 0.9 },
  "clawd-react-wizard.svg": { durationMs: 4200, fps: 12, size: 320, scale: 0.9 },
  "clawd-mini-idle.svg": { durationMs: 2800, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-enter.svg": { durationMs: 3200, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-peek.svg": { durationMs: 2600, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-alert.svg": { durationMs: 2600, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-happy.svg": { durationMs: 2600, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-crabwalk.svg": { durationMs: 2600, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-enter-sleep.svg": { durationMs: 2600, fps: 12, size: 220, scale: 0.92 },
  "clawd-mini-sleep.svg": { durationMs: 3600, fps: 12, size: 220, scale: 0.92 },
};

const GIF_ALIASES = {
  "clawd-idle.gif": "clawd-idle-follow.svg",
  "clawd-debugger.gif": "clawd-working-debugger.svg",
  "clawd-thinking.gif": "clawd-working-thinking.svg",
  "clawd-typing.gif": "clawd-working-typing.svg",
  "clawd-building.gif": "clawd-working-building.svg",
  "clawd-juggling.gif": "clawd-working-juggling.svg",
  "clawd-conducting.gif": "clawd-working-conducting.svg",
  "clawd-sweeping.gif": "clawd-working-sweeping.svg",
  "clawd-carrying.gif": "clawd-working-carrying.svg",
};

function defaultSpecForSvg(svg) {
  if (svg.startsWith("clawd-mini-")) {
    return { durationMs: 2600, fps: 12, size: 220, scale: 0.92 };
  }
  return { durationMs: 3200, fps: 12, size: 320, scale: 0.9 };
}

function buildGifSpecs() {
  const specs = [];
  const seen = new Set();
  const svgs = fs.readdirSync(SVG_DIR)
    .filter((name) => name.endsWith(".svg") && !SVG_EXCLUDES.has(name))
    .sort();

  const pushSpec = (gif, svg, extra = {}) => {
    const key = `${gif}::${svg}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push({
      gif,
      svg,
      ...defaultSpecForSvg(svg),
      ...(SVG_OVERRIDES[svg] || {}),
      ...extra,
    });
  };

  for (const svg of svgs) {
    pushSpec(svg.replace(/\.svg$/i, ".gif"), svg);
  }
  for (const [gif, svg] of Object.entries(GIF_ALIASES)) {
    pushSpec(gif, svg);
  }
  pushSpec("clawd-idle-follow-demo.gif", "clawd-idle-follow.svg", {
    scene: "idle-follow-demo",
  });

  return specs;
}

function buildCaptureHtml(spec) {
  const svgUrl = pathToFileURL(path.join(SVG_DIR, spec.svg)).href;
  const spriteSize = Math.round(spec.size * spec.scale);
  const scriptedScene = spec.scene === "idle-follow-demo";
  const cursorMarkup = scriptedScene ? '<div id="cursor"></div>' : "";
  const sceneScript = scriptedScene ? `
    <script>
      const sprite = document.getElementById("sprite");
      const cursor = document.getElementById("cursor");
      const keyframes = [
        { t: 0, x: 38, y: 160 },
        { t: 0.25, x: 160, y: 62 },
        { t: 0.5, x: 278, y: 160 },
        { t: 0.75, x: 160, y: 258 },
        { t: 1, x: 38, y: 160 },
      ];
      const durationMs = ${Number(spec.durationMs) || 3200};
      const startedAt = performance.now();

      function interpolate(progress) {
        const scaled = progress * (keyframes.length - 1);
        const index = Math.min(keyframes.length - 2, Math.floor(scaled));
        const local = scaled - index;
        const from = keyframes[index];
        const to = keyframes[index + 1];
        return {
          x: from.x + (to.x - from.x) * local,
          y: from.y + (to.y - from.y) * local,
        };
      }

      function frame(now) {
        const progress = ((now - startedAt) % durationMs) / durationMs;
        const point = interpolate(progress);
        cursor.style.transform = \`translate(\${point.x}px, \${point.y}px)\`;

        const svg = sprite.contentDocument;
        const eyes = svg && svg.getElementById("eyes-js");
        if (eyes) {
          const dx = Math.max(-3, Math.min(3, (point.x - ${spec.size / 2}) / 45));
          const dy = Math.max(-1.5, Math.min(1.5, (point.y - ${spec.size / 2}) / 70));
          eyes.setAttribute("transform", \`translate(\${dx.toFixed(1)} \${dy.toFixed(1)})\`);
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    </script>` : "";

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: transparent; }
      body { display: flex; align-items: center; justify-content: center; }
      #stage { position: relative; width: ${spec.size}px; height: ${spec.size}px; display: flex; align-items: center; justify-content: center; background: transparent; }
      #sprite { width: ${spriteSize}px; height: ${spriteSize}px; border: 0; display: block; }
      #cursor { position: absolute; left: -7px; top: -7px; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.95); border-radius: 50%; box-sizing: border-box; filter: drop-shadow(0 1px 2px rgba(0,0,0,.45)); }
    </style>
  </head>
  <body>
    <div id="stage">
      <object id="sprite" type="image/svg+xml" data="${svgUrl}"></object>
      ${cursorMarkup}
    </div>
    ${sceneScript}
  </body>
</html>`;
}

module.exports = {
  ROOT,
  SVG_DIR,
  buildGifSpecs,
  buildCaptureHtml,
};
