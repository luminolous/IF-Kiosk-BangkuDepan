// Runs the relay protocol tests (backend/tests/relay.test.js) against this
// Worker, served locally by `wrangler dev`. Nothing here touches Cloudflare:
// wrangler dev runs the Worker and its Durable Objects in a local workerd.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here    = dirname(fileURLToPath(import.meta.url));
const relay   = resolve(here, "..");
const backend = resolve(here, "../../backend");
const PORT    = process.env.RELAY_TEST_PORT || "8787";

// Runs a package's command with this Node rather than through npx. On Windows
// npx is a .cmd file, which Node only spawns through a shell, and killing the
// shell would leave wrangler running.
const require = createRequire(import.meta.url);
function run(pkg, command, args, options) {
  const manifest = require.resolve(`${pkg}/package.json`);
  const { bin } = require(manifest);
  const script = typeof bin === "string" ? bin : bin[command];
  return spawn(process.execPath, [resolve(dirname(manifest), script), ...args], options);
}

const dev = run("wrangler", "wrangler", ["dev", "--ip", "127.0.0.1", "--port", PORT], {
  cwd: relay,
  env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  stdio: ["ignore", "pipe", "pipe"],
});
let log = "";
dev.stdout.on("data", (d) => { log += d; });
dev.stderr.on("data", (d) => { log += d; });

const stop = (code) => { dev.kill("SIGTERM"); process.exit(code); };

async function waitForWorker() {
  for (let i = 0; i < 120; i++) {
    if (dev.exitCode !== null) break;
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) return;
    } catch { /* not listening yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  console.error(`wrangler dev did not start:\n${log}`);
  stop(1);
}

await waitForWorker();
const jest = run("jest", "jest", ["--runInBand", "--forceExit", "tests/relay.test.js"], {
  cwd: backend,
  env: { ...process.env, RELAY_TEST_URL: `ws://127.0.0.1:${PORT}` },
  stdio: "inherit",
});
jest.on("exit", (code) => stop(code ?? 1));
