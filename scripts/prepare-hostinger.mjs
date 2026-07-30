/**
 * Validates Hostinger deploy artifacts before Hostinger copies the output folder.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const required = [
  path.join(root, "server.cjs"),
  path.join(root, "apps/web/.next/BUILD_ID"),
  path.join(root, "package.json"),
];

for (const file of required) {
  if (!existsSync(file)) {
    console.error(`[hostinger] missing deploy artifact: ${file}`);
    process.exit(1);
  }
}

console.log("[hostinger] deploy artifacts OK (server.cjs, apps/web/.next, package.json)");
