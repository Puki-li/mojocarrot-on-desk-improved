const { describe, it } = require("node:test");
const assert = require("node:assert");
const path = require("path");
const { execFileSync } = require("node:child_process");

function readBox(imagePath, mode) {
  const script = `
from PIL import Image
img = Image.open(r"${imagePath}").convert("RGBA")
xs = []
ys = []
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = img.getpixel((x, y))
        if "${mode}" == "source":
            keep = a > 0 and ((r > 180 and g > 180 and b > 180) or (b > 90 and b > r + 20 and b > g + 20))
        else:
            keep = a > 0
        if keep:
            xs.append(x)
            ys.append(y)
print(f"{min(xs)},{min(ys)},{max(xs)},{max(ys)}")
`;
  const output = execFileSync("python3", ["-c", script], { encoding: "utf8" }).trim();
  const [minX, minY, maxX, maxY] = output.split(",").map(Number);
  return { minX, minY, maxX, maxY };
}

describe("mojocarrot prototype face assets", () => {
  it("keeps the full original eye area when splitting eyes from the prototype", () => {
    const root = path.join(__dirname, "..", "assets");
    const sourceBox = readBox(path.join(root, "custom.png"), "source");
    const splitBox = readBox(path.join(root, "mojocarrot-eyes.png"), "split");

    assert.deepStrictEqual(splitBox, sourceBox);
  });
});
