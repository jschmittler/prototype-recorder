/**
 * Assemble a self-contained Hostinger deploy folder.
 * Hostinger copies Output directory → .builds/current/nodejs/ and require()s server.js.
 * The entry file MUST call listen() in-process (no child_process.spawn).
 */
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const webRoot = path.join(root, "apps/web");
const standaloneApp = path.join(webRoot, ".next/standalone/apps/web");
const outDir = path.join(root, "hostinger-dist");
const reqFilesPath = path.join(webRoot, ".next/required-server-files.json");

function copy(from, to) {
  mkdirSync(path.dirname(to), { recursive: true });
  cpSync(from, to, { recursive: true });
}

if (!existsSync(path.join(standaloneApp, "server.js"))) {
  console.error("[hostinger] standalone server missing — run: npm run build");
  process.exit(1);
}

if (!existsSync(reqFilesPath)) {
  console.error("[hostinger] required-server-files.json missing — run: npm run build");
  process.exit(1);
}

const nextConfig = JSON.parse(readFileSync(reqFilesPath, "utf8")).config;
// Drop machine-specific paths from the build host (breaks on Hostinger Linux).
nextConfig.outputFileTracingRoot = ".";
if (nextConfig.turbopack) {
  nextConfig.turbopack.root = ".";
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

copy(standaloneApp, outDir);
copy(path.join(webRoot, "public"), path.join(outDir, "public"));
copy(path.join(webRoot, ".next/static"), path.join(outDir, ".next/static"));

const serverSource = `'use strict';
const dir = __dirname;

process.env.NODE_ENV = 'production';
process.chdir(dir);

// Demo defaults for shared hosting (override in hPanel if needed).
if (!process.env.APP_MODE) process.env.APP_MODE = 'demo';
if (!process.env.EXECUTOR) process.env.EXECUTOR = 'fake';
if (!process.env.AI_PROVIDER) process.env.AI_PROVIDER = 'fake';
if (!process.env.JOB_STORE) process.env.JOB_STORE = 'memory';
if (!process.env.QUEUE_DRIVER) process.env.QUEUE_DRIVER = 'memory';
if (!process.env.STORAGE_DRIVER) process.env.STORAGE_DRIVER = 'local';

const currentPort = parseInt(process.env.PORT, 10) || 3000;
const hostname = process.env.HOSTNAME || '0.0.0.0';
const nextConfig = ${JSON.stringify(nextConfig)};

process.env.__NEXT_PRIVATE_STANDALONE_CONFIG = JSON.stringify(nextConfig);

require('next');
const { startServer } = require('next/dist/server/lib/start-server');

startServer({
  dir,
  isDev: false,
  config: nextConfig,
  hostname,
  port: currentPort,
  allowRetry: false,
}).catch((err) => {
  console.error(err);
  process.exit(1);
});
`;

writeFileSync(path.join(outDir, "server.js"), serverSource, "utf8");

const pkgPath = path.join(outDir, "package.json");
if (existsSync(pkgPath)) {
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  delete pkg.type;
  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
}

if (!existsSync(path.join(outDir, "server.js")) || !existsSync(path.join(outDir, ".next/BUILD_ID"))) {
  console.error("[hostinger] deploy bundle incomplete");
  process.exit(1);
}

console.log(`[hostinger] deploy bundle ready at ${outDir}/server.js`);
