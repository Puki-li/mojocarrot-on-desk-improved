const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

test("remote deploy includes every local dependency of the Claude hook", () => {
  const hook = fs.readFileSync(path.join(__dirname, "..", "hooks", "clawd-hook.js"), "utf8");
  const deploy = fs.readFileSync(path.join(__dirname, "..", "scripts", "remote-deploy.sh"), "utf8");
  const relativeRequires = [...hook.matchAll(/require\("\.\/(.+?)"\)/g)].map((match) => match[1]);
  for (const dependency of relativeRequires) {
    assert.match(deploy, new RegExp(`\\$HOOKS_DIR/${dependency.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.js`));
  }
});
