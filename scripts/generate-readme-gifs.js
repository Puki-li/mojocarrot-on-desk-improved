const { app, BrowserWindow } = require("electron");
const { execFileSync } = require("child_process");
const fs = require("fs");
const fsp = require("fs/promises");
const os = require("os");
const path = require("path");
const { ROOT, SVG_DIR, buildGifSpecs, buildCaptureHtml } = require("./generate-readme-gifs-lib");

const GIF_DIR = path.join(ROOT, "assets", "gif");
const TMP_ROOT = path.join(os.tmpdir(), "mojocarrot-readme-gifs");
const GIF_SPECS = buildGifSpecs();

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

  const html = buildCaptureHtml(spec);
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
