const fs = require("fs");
const path = require("path");

function toDataUri(filename) {
  const assetPath = path.join(__dirname, "..", "assets", filename);
  const mime = filename.endsWith(".png") ? "image/png" : "application/octet-stream";
  return `data:${mime};base64,${fs.readFileSync(assetPath).toString("base64")}`;
}

const ASSET_HREFS = Object.freeze({
  body: toDataUri("mojocarrot-body.png"),
  stemless: toDataUri("mojocarrot-stemless.png"),
  leaves: toDataUri("mojocarrot-leaves.png"),
  eyes: toDataUri("mojocarrot-eyes.png"),
  sleep: toDataUri("mojocarrot-sleep.png"),
  mouth: toDataUri("mojocarrot-mouth.png"),
  apple8Body: toDataUri("apple8-body.png"),
  apple8Eyes: toDataUri("apple8-eyes.png"),
  apple8Mouth: toDataUri("apple8-mouth.png"),
  carry10: toDataUri("10.png"),
  carry11: toDataUri("11.png"),
  carry12: toDataUri("12.png"),
  carry14: toDataUri("14.png"),
});

function buildShadow({
  id = null,
  className = "",
  x = 3,
  y = 15,
  width = 9,
  height = 1,
  opacity = 0.5,
} = {}) {
  const attrs = [
    id ? `id="${id}"` : "",
    className ? `class="${className}"` : "",
    `x="${x}"`,
    `y="${y}"`,
    `width="${width}"`,
    `height="${height}"`,
    `fill="#000000"`,
    `opacity="${opacity}"`,
  ].filter(Boolean).join(" ");

  return `<rect ${attrs} />`;
}

function buildMouth({
  className = "",
  x = 5.3,
  y = 11.1,
  width = 4.1,
  height = 1.2,
  rx = 0.55,
  fill = "#7F4028",
  opacity = 0.9,
} = {}) {
  const attrs = [
    className ? `class="${className}"` : "",
    `x="${x}"`,
    `y="${y}"`,
    `width="${width}"`,
    `height="${height}"`,
    `rx="${rx}"`,
    `fill="${fill}"`,
    `opacity="${opacity}"`,
  ].filter(Boolean).join(" ");

  return `<rect ${attrs} />`;
}

function buildMouthModule(mouth = null) {
  if (!mouth) {
    return "";
  }

  const {
    markup = "",
    className = "",
    href = "",
    ...shape
  } = mouth;

  if (markup) {
    return markup;
  }

  const assetHref = href || ASSET_HREFS.mouth;

  if (assetHref) {
    return `<g ${className ? `class="${className}"` : ""}><image href="${assetHref}" x="-15" y="-25" width="45" height="45" /></g>`;
  }

  return buildMouth({ className, ...shape });
}

function buildMojocarrotLayers(options = {}) {
  const {
    bodyId = null,
    bodyClass = "",
    eyesId = null,
    eyesClass = "",
    shadowId = null,
    shadowClass = "",
    includeLeaves = true,
    includeEyes = true,
    mouth = null,
    sleeping = false,
    bodyAsset = sleeping ? ASSET_HREFS.sleep : ASSET_HREFS.stemless,
    leavesClass = "",
    faceClass = "",
    extraBodyMarkup = "",
    eyesMarkup = "",
    shadowWidth = 9,
    shadowY = 15,
    shadowOpacity = 0.5,
  } = options;

  const parts = [];

  parts.push(buildShadow({
    id: shadowId,
    className: shadowClass,
    width: shadowWidth,
    y: shadowY,
    opacity: shadowOpacity,
  }));

  const layerChildren = [
    `<image href="${bodyAsset}" x="-15" y="-25" width="45" height="45" />`,
  ];

  if (includeLeaves) {
    layerChildren.push(
      `<g class="${leavesClass || "mojocarrot-leaves"}"><image href="${ASSET_HREFS.leaves}" x="-15" y="-25" width="45" height="45" /></g>`
    );
  }

  const renderedMouth = buildMouthModule(mouth);
  if (renderedMouth) {
    layerChildren.push(renderedMouth);
  }

  if (extraBodyMarkup) {
    layerChildren.push(extraBodyMarkup);
  }

  const bodyAttrs = [
    bodyId ? `id="${bodyId}"` : "",
    [bodyClass, faceClass].filter(Boolean).join(" ").trim()
      ? `class="${[bodyClass, faceClass].filter(Boolean).join(" ")}"`
      : "",
  ].filter(Boolean).join(" ");

  parts.push(`<g ${bodyAttrs}>${layerChildren.join("")}</g>`);

  if (includeEyes) {
    const eyesAttrs = [
      eyesId ? `id="${eyesId}"` : "",
      eyesClass ? `class="${eyesClass}"` : "",
    ].filter(Boolean).join(" ");
    parts.push(
      `<g ${eyesAttrs}>${eyesMarkup || `<image href="${ASSET_HREFS.eyes}" x="-15" y="-25" width="45" height="45" />`}</g>`
    );
  }

  return parts.join("\n");
}

module.exports = {
  ASSET_HREFS,
  buildShadow,
  buildMouth,
  buildMouthModule,
  buildMojocarrotLayers,
};
