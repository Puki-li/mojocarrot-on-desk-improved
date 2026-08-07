const { describe, it } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

describe("repository integrity", () => {
  it("keeps local package-script entrypoints in version control", () => {
    const pkg = require("../package.json");
    const localEntrypoints = Object.values(pkg.scripts)
      .map((command) => command.match(/^(?:node|electron)\s+(?!-)([^\s]+)/))
      .filter(Boolean)
      .map((match) => match[1]);

    for (const entrypoint of localEntrypoints) {
      const absolutePath = path.join(ROOT, entrypoint);
      assert.ok(fs.existsSync(absolutePath), `Missing package-script entrypoint: ${entrypoint}`);
    }
  });
});
