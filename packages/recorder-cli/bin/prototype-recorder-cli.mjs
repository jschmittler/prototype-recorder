#!/usr/bin/env node
/**
 * Executable entry point. Runs the TypeScript CLI (src/cli.ts) through tsx so
 * the package can ship TS sources directly with no build step.
 */
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const cli = path.join(here, "..", "src", "cli.ts");

// Resolve the tsx executable robustly across versions.
const tsxPkgPath = require.resolve("tsx/package.json");
const tsxPkg = require(tsxPkgPath);
const tsxBinRel = typeof tsxPkg.bin === "string" ? tsxPkg.bin : tsxPkg.bin.tsx;
const tsxBin = path.join(path.dirname(tsxPkgPath), tsxBinRel);

const res = spawnSync(process.execPath, [tsxBin, cli, ...process.argv.slice(2)], { stdio: "inherit" });
process.exit(res.status ?? 1);
