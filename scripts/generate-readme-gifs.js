const { app, BrowserWindow } = require("electron");
const { execFileSync } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { pathToFileURL } = require("url");

const ROOT = path.resolve(__dirname, "..");
const SVG_DIR = path.join(ROOT, "assets", "svg");
const GIF_DIR = path.join(ROOT, "assets", "gif");
const TMP_ROOT = path.join(os.tmpdir(), "mojocarrot-readme-gifs");

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

  if (svg.includes("sleep") || svg.includes("doze") || svg.includes("wake")) {
    return { durationMs: 3600, fps: 12, size: 320, scale: 0.9 };
  }

  if (svg.startsWith("clawd-react-")) {
    return { durationMs: 3200, fps: 12, size: 320, scale: 0.9 };
  }

  return { durationMs: 3200, fps: 12, size: 320, scale: 0.9 };
}

function buildGifSpecs() {
  const specs = [];
  const seen = new Set();
  const svgs = fs.readdirSync(SVG_DIR)
    .filter((name) => name.endsWith(".svg") && !SVG_EXCLUDES.has(name))
    .sort();

  const pushSpec = (gif, svg) => {
    const key = `${gif}::${svg}`;
    if (seen.has(key)) return;
    seen.add(key);
    specs.push({
      gif,
      svg,
      ...defaultSpecForSvg(svg),
      ...(SVG_OVERRIDES[svg] || {}),
    });
  };

  for (const svg of svgs) {
    pushSpec(svg.replace(/\.svg$/i, ".gif"), svg);
  }

  for (const [gif, svg] of Object.entries(GIF_ALIASES)) {
    pushSpec(gif, svg);
  }

  return specs;
}

const GIF_SPECS = buildGifSpecs();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildCaptureHtml(svgPath, size, scale) {
  const svgUrl = pathToFileURL(svgPath).href;
  const spriteSize = Math.round(size * scale);
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: transparent;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #stage {
        width: ${size}px;
        height: ${size}px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: transparent;
      }
      #sprite {
        width: ${spriteSize}px;
        height: ${spriteSize}px;
        border: 0;
        display: block;
      }
    </style>
  </head>
  <body>
    <div id="stage">
      <object id="sprite" type="image/svg+xml" data="${svgUrl}"></object>
    </div>
  </body>
</html>`;
}

async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

async function resetDir(dir) {
  await fsp.rm(dir, { recursive: true, force: true });
  await ensureDir(dir);
}

async function captureFrames(win, spec, frameDir) {
  const frameCount = Math.max(1, Math.round((spec.durationMs / 1000) * spec.fps));
  const frameDelay = Math.round(1000 / spec.fps);

  for (let i = 0; i < frameCount; i += 1) {
    const image = await win.webContents.capturePage();
    const framePath = path.join(frameDir, `frame-${String(i).padStart(4, "0")}.png`);
    await fsp.writeFile(framePath, image.toPNG());
    await delay(frameDelay);
  }

  return frameCount;
}

function runFfmpeg(frameDir, spec) {
  const palettePath = path.join(frameDir, "palette.png");
  const inputPattern = path.join(frameDir, "frame-%04d.png");
  const outputPath = path.join(GIF_DIR, spec.gif);

  execFileSync("ffmpeg", [
    "-y",
    "-framerate", String(spec.fps),
    "-i", inputPattern,
    "-vf", "palettegen=stats_mode=diff:reserve_transparent=1",
    palettePath,
  ], { stdio: "ignore" });

  execFileSync("ffmpeg", [
    "-y",
    "-framerate", String(spec.fps),
    "-i", inputPattern,
    "-i", palettePath,
    "-lavfi", "paletteuse=dither=sierra2_4a:alpha_threshold=128",
    outputPath,
  ], { stdio: "ignore" });

  return outputPath;
}

async function renderSpec(spec) {
  const svgPath = path.join(SVG_DIR, spec.svg);
  if (!fs.existsSync(svgPath)) {
    throw new Error(`Missing SVG: ${spec.svg}`);
  }

  const workDir = path.join(TMP_ROOT, spec.gif.replace(/\.gif$/i, ""));
  await resetDir(workDir);

  const html = buildCaptureHtml(svgPath, spec.size, spec.scale);
  const htmlPath = path.join(workDir, "capture.html");
  await fsp.writeFile(htmlPath, html, "utf8");

  const win = new BrowserWindow({
    width: spec.size,
    height: spec.size,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    paintWhenInitiallyHidden: true,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  try {
    await win.loadFile(htmlPath);
    await delay(500);
    await captureFrames(win, spec, workDir);
    return runFfmpeg(workDir, spec);
  } finally {
    if (!win.isDestroyed()) win.destroy();
  }
}

function resolveSpecs() {
  const requested = process.argv.slice(2);
  if (requested.length === 0) return GIF_SPECS;

  const wanted = new Set(requested);
  const filtered = GIF_SPECS.filter((spec) => wanted.has(spec.gif) || wanted.has(spec.svg));
  if (filtered.length === 0) {
    throw new Error(`No GIF specs matched: ${requested.join(", ")}`);
  }
  return filtered;
}

async function main() {
  await ensureDir(GIF_DIR);
  await resetDir(TMP_ROOT);

  const specs = resolveSpecs();
  console.log(`Generating ${specs.length} GIF preview(s)...`);

  for (const spec of specs) {
    const out = await renderSpec(spec);
    console.log(`Generated ${path.basename(out)}`);
  }
}

app.commandLine.appendSwitch("disable-renderer-backgrounding");
app.commandLine.appendSwitch("disable-background-timer-throttling");
app.commandLine.appendSwitch("disable-backgrounding-occluded-windows");
app.commandLine.appendSwitch("disable-features", "CalculateNativeWinOcclusion");
app.on("window-all-closed", (event) => event.preventDefault());

app.whenReady()
  .then(main)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error);
    app.exitCode = 1;
    app.quit();
  });
