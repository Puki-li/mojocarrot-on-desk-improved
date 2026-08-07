const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawn } = require("node:child_process");
const serverConfig = require("../hooks/server-config");

const tempDirs = [];

function makeTempHome() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "clawd-server-config-"));
  tempDirs.push(tmpDir);
  return tmpDir;
}

afterEach(() => {
  while (tempDirs.length) {
    fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
  }
});

describe("server-config helpers", () => {
  it("creates and reuses a private authentication token", () => {
    const tmpHome = makeTempHome();
    const tokenPath = path.join(tmpHome, ".clawd", "auth-token");
    const first = serverConfig.getOrCreateAuthToken(tokenPath);
    const second = serverConfig.getOrCreateAuthToken(tokenPath);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.strictEqual(second, first);
    if (process.platform !== "win32") {
      assert.strictEqual(fs.statSync(tokenPath).mode & 0o777, 0o600);
    }
  });

  it("tightens permissions on an existing valid authentication token", () => {
    const tmpHome = makeTempHome();
    const tokenPath = path.join(tmpHome, ".clawd", "auth-token");
    const token = "b".repeat(64);
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, token, { mode: 0o644 });

    assert.strictEqual(serverConfig.getOrCreateAuthToken(tokenPath), token);
    if (process.platform !== "win32") {
      assert.strictEqual(fs.statSync(tokenPath).mode & 0o777, 0o600);
    }
  });

  it("concurrent cold starts converge on one authentication token", async () => {
    const tmpHome = makeTempHome();
    const tokenPath = path.join(tmpHome, ".clawd", "auth-token");
    const modulePath = path.join(__dirname, "..", "hooks", "server-config.js");
    const script = "const c=require(process.argv[1]); process.stdout.write(c.getOrCreateAuthToken(process.argv[2]));";
    const run = () => new Promise((resolve, reject) => {
      const child = spawn(process.execPath, ["-e", script, modulePath, tokenPath], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (chunk) => { stdout += chunk; });
      child.stderr.on("data", (chunk) => { stderr += chunk; });
      child.on("error", reject);
      child.on("close", (code) => code === 0 ? resolve(stdout) : reject(new Error(stderr)));
    });
    const [first, second] = await Promise.all([run(), run()]);
    assert.match(first, /^[a-f0-9]{64}$/);
    assert.strictEqual(second, first);
    assert.strictEqual(fs.readFileSync(tokenPath, "utf8"), first);
  });

  it("recovers a stale partial authentication token", () => {
    const tmpHome = makeTempHome();
    const tokenPath = path.join(tmpHome, ".clawd", "auth-token");
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, "partial", { mode: 0o600 });
    const token = serverConfig.getOrCreateAuthToken(tokenPath);
    assert.match(token, /^[a-f0-9]{64}$/);
    assert.strictEqual(fs.readFileSync(tokenPath, "utf8"), token);
  });

  it("recovers a stale empty authentication token", () => {
    const tmpHome = makeTempHome();
    const tokenPath = path.join(tmpHome, ".clawd", "auth-token");
    fs.mkdirSync(path.dirname(tokenPath), { recursive: true });
    fs.writeFileSync(tokenPath, "", { mode: 0o600 });
    const token = serverConfig.getOrCreateAuthToken(tokenPath);
    assert.match(token, /^[a-f0-9]{64}$/);
  });

  it("adds authentication to permission URLs and state posts", async () => {
    const token = "a".repeat(64);
    assert.strictEqual(
      serverConfig.buildPermissionUrl(23333, token),
      `http://127.0.0.1:23333/permission?token=${token}`
    );
    let requestOptions;
    await new Promise((resolve, reject) => {
      const req = new (require("node:events").EventEmitter)();
      req.end = () => {};
      req.destroy = () => {};
      serverConfig.postStateToPort(23333, "{}", 100, (ok) => {
        try {
          assert.strictEqual(ok, true);
          assert.strictEqual(requestOptions.headers["x-clawd-token"], token);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, {
        authToken: token,
        httpRequest(options, onResponse) {
          requestOptions = options;
          const res = new (require("node:events").EventEmitter)();
          res.statusCode = 200;
          res.headers = { "x-clawd-server": "clawd-on-desk" };
          res.resume = () => {};
          onResponse(res);
          return req;
        },
      });
    });
  });

  it("clearRuntimeConfig removes runtime.json when present", () => {
    const tmpHome = makeTempHome();
    const runtimeDir = path.join(tmpHome, ".clawd");
    fs.mkdirSync(runtimeDir, { recursive: true });
    const runtimePath = path.join(runtimeDir, "runtime.json");
    fs.writeFileSync(runtimePath, JSON.stringify({ app: "clawd-on-desk", port: 23333 }));

    assert.strictEqual(serverConfig.clearRuntimeConfig(runtimePath), true);
    assert.strictEqual(fs.existsSync(runtimePath), false);
  });

  it("splitPortCandidates prioritizes preferred and runtime ports", () => {
    const result = serverConfig.splitPortCandidates(23335, { runtimePort: 23334 });
    assert.deepStrictEqual(result.direct, [23335, 23334]);
    assert.ok(result.fallback.includes(23333));
    assert.ok(!result.fallback.includes(23334));
    assert.ok(!result.fallback.includes(23335));
  });

  it("probePort recognizes signed Clawd responses", async () => {
    await new Promise((resolve, reject) => {
      const req = {
        on(event, handler) {
          if (event === "error" || event === "timeout") this[`_${event}`] = handler;
        },
        destroy() {},
      };

      serverConfig.probePort(23337, 100, (ok) => {
        try {
          assert.strictEqual(ok, true);
          resolve();
        } catch (err) {
          reject(err);
        }
      }, {
        httpGet(_options, onResponse) {
          const res = {
            headers: { "x-clawd-server": "clawd-on-desk" },
            setEncoding() {},
            on(event, handler) {
              if (event === "data") handler("");
              if (event === "end") handler();
            },
          };
          onResponse(res);
          return req;
        },
      });
    });
  });

  it("postStateToRunningServer probes fallback ports before posting", async () => {
    const probes = [];
    const posts = [];

    await new Promise((resolve, reject) => {
      serverConfig.postStateToRunningServer(
        JSON.stringify({ state: "idle" }),
        {
          timeoutMs: 50,
          preferredPort: 23335,
          runtimePort: 23334,
          probePort(port, _timeoutMs, cb) {
            probes.push(port);
            cb(port === 23336);
          },
          postStateToPort(port, _payload, _timeoutMs, cb) {
            posts.push(port);
            cb(port === 23336, port);
          },
        },
        (ok, port) => {
          try {
            assert.strictEqual(ok, true);
            assert.strictEqual(port, 23336);
            assert.deepStrictEqual(posts, [23335, 23334, 23336]);
            assert.deepStrictEqual(probes, [23333, 23336]);
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  });
});
