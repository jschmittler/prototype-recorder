/**
 * Tracked Hostinger entry (output directory = "." ).
 * hPanel → Entry file: hostinger-entry.cjs  |  Start: node hostinger-entry.cjs
 */
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const bundle = path.join(__dirname, "hostinger-dist", "server.js");

if (!fs.existsSync(bundle)) {
  console.error("[hostinger-entry] Missing hostinger-dist/server.js — run npm run build first");
  process.exit(1);
}

require(bundle);
