const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const packageJson = require("../package.json");

test("update checks and downloads use the packaged repository", () => {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === "electron") return { app: {}, dialog: {}, shell: {}, Notification: class {} };
    return originalLoad.call(this, request, parent, isMain);
  };
  let updater;
  try {
    delete require.cache[require.resolve("../src/updater")];
    updater = require("../src/updater");
  } finally {
    Module._load = originalLoad;
  }
  const publish = packageJson.build.publish[0];
  assert.deepStrictEqual(updater.UPDATE_REPOSITORY, { owner: publish.owner, repo: publish.repo });
  assert.equal(updater.LATEST_RELEASE_PATH, `/repos/${publish.owner}/${publish.repo}/releases/latest`);
  assert.equal(updater.RELEASES_URL, `https://github.com/${publish.owner}/${publish.repo}/releases/latest`);
});
