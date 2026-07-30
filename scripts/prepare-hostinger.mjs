/**
 * Assemble a self-contained Hostinger deploy folder.
 * Hostinger copies Output directory → .builds/current/nodejs/ and requires server.js there.
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRoot = path.join(root, "apps/web");
const standaloneApp = path.join(webRoot, ".next/standalone/apps/web");
const outDir = path.join(root, "hostinger-dist");

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

if (!existsSync(path.join(standaloneApp, "server.js"))) {
  console.error("[hostinger] standalone server missing — enable output: 'standalone' and run next build");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

copy(standaloneApp, outDir);
copy(path.join(webRoot, "public"), path.join(outDir, "public"));
copy(path.join(webRoot, ".next/static"), path.join(outDir, ".next/static"));

// Next standalone server.js is ESM; Hostinger lsnode loads the entry via require().
const nextServer = path.join(outDir, "server.js");
const appServer = path.join(outDir, "app-server.mjs");
if (existsSync(nextServer)) {
  renameSyncSafe(nextServer, appServer);
}

writeFileSync(
  path.join(outDir, "server.js"),
  `/**
 * Hostinger entry (CommonJS). lsnode require() cannot load ESM directly.
 */
const { spawn } = require("node:child_process");
const path = require("node:path");

const port = String(process.env.PORT || "3000");
process.env.PORT = port;
process.env.HOSTNAME = process.env.HOSTNAME || "0.0.0.0";
process.env.NODE_ENV = "production";

const appServer = path.join(__dirname, "app-server.mjs");
const child = spawn(process.execPath, [appServer], {
  cwd: __dirname,
  stdio: "inherit",
  env: process.env,
});

child.on("error", (err) => {
  console.error("[ptw-start] failed to launch app-server.mjs:", err.message);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (code !== 0) {
    console.error("[ptw-start] app-server.mjs exited code=%s signal=%s", code, signal);
  }
  process.exit(code ?? 1);
});
`,
  "utf8",
);

// Drop "type":"module" so lsnode treats server.js as CommonJS.
const pkgPath = path.join(outDir, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.type;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

if (!existsSync(path.join(outDir, "server.js")) || !existsSync(appServer)) {
  console.error("[hostinger] deploy bundle incomplete");
  process.exit(1);
}

console.log(`[hostinger] deploy bundle ready at ${outDir}/server.js`);

function renameSyncSafe(from, to) {
  rmSync(to, { force: true });
  cpSync(from, to);
  rmSync(from, { force: true });
}
