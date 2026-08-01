/**
 * prototype-recorder-cli CLI.
 *
 * Commands:
 *   record    [script.md] [--url U] [--headed] [--pace N] record a walkthrough
 *   preflight [script.md] [--url U]                       dry-run a script, no video
 *   inspect   [url]        [--headed]                     inspect a prototype
 *   auth                                                   headed Figma auth setup
 *   setup                                                  install the Chromium browser
 *   list                                                   list available scripts
 *   help | --help | -h                                     show usage
 *   version | --version | -v                               show version
 *
 * The `npm run walkthrough:*` scripts still work directly; this is the shareable
 * command-line front-end over the same engine.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { PROJECT_ROOT } from "./config.js";

interface Flags {
  positionals: string[];
  url?: string;
  headed?: boolean;
  pace?: string;
  screens?: string;
  help?: boolean;
  version?: boolean;
}

function parse(argv: string[]): Flags {
  const f: Flags = { positionals: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--headed") f.headed = true;
    else if (a === "--help" || a === "-h") f.help = true;
    else if (a === "--version" || a === "-v") f.version = true;
    else if (a === "--url") f.url = argv[++i];
    else if (a.startsWith("--url=")) f.url = a.slice(6);
    else if (a === "--pace") f.pace = argv[++i];
    else if (a.startsWith("--pace=")) f.pace = a.slice(7);
    else if (a === "--screens") f.screens = argv[++i];
    else if (a.startsWith("--screens=")) f.screens = a.slice(10);
    else f.positionals.push(a);
  }
  return f;
}

function pkgVersion(): string {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
    return `${p.name}@${p.version}`;
  } catch {
    return "prototype-recorder-cli";
  }
}

const USAGE = `prototype-recorder-cli — record automated walkthroughs of hosted Figma prototypes

Usage:
  prototype-recorder-cli record [script.md] [--url <url>] [--headed] [--pace <n>]
  prototype-recorder-cli preflight [script.md] [--url <url>]
  prototype-recorder-cli inspect [url] [--headed] [--screens <n>]
  prototype-recorder-cli auth
  prototype-recorder-cli setup
  prototype-recorder-cli list
  prototype-recorder-cli help | version

Options:
  --url <url>    prototype URL (overrides the script's front-matter; = PROTOTYPE_URL)
  --headed       run with a visible browser window (default: headless)
  --pace <n>     scale every pause/scroll duration (e.g. 0.85 faster, 1.3 slower)
  --screens <n>  screens to open past the landing page while inspecting (default 6, 0 off)

Examples:
  prototype-recorder-cli preflight scripts/acme.md --url https://acme.figma.site
  prototype-recorder-cli record scripts/acme.md --url https://acme.figma.site
  npx @your-org/prototype-recorder-cli record ./my-journey.md
  prototype-recorder-cli inspect https://acme.figma.site --headed`;

/** Resolve the Chromium install command from the bundled Playwright. */
function installBrowser(): void {
  const require = createRequire(import.meta.url);
  let cli: string | undefined;
  for (const spec of ["playwright/cli.js", "playwright-core/cli.js"]) {
    try {
      cli = require.resolve(spec);
      break;
    } catch {
      /* try next */
    }
  }
  if (cli) {
    execFileSync(process.execPath, [cli, "install", "chromium"], { stdio: "inherit" });
  } else {
    execFileSync("npx", ["playwright", "install", "chromium"], { stdio: "inherit" });
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const flags = parse(rest);

  if (!command || command === "help" || flags.help) {
    console.log(USAGE);
    return;
  }
  if (command === "version" || flags.version) {
    console.log(pkgVersion());
    return;
  }

  // Map CLI flags onto the env vars the engine already understands.
  if (flags.url) process.env.PROTOTYPE_URL = flags.url;
  if (flags.headed) process.env.HEADED = "1";
  if (flags.pace) process.env.PACE = flags.pace;
  if (flags.screens) process.env.INSPECT_SCREENS = flags.screens;

  switch (command) {
    case "record": {
      const { run } = await import("./record-walkthrough.js");
      await run(flags.positionals[0]);
      return;
    }
    case "preflight": {
      const { preflight } = await import("./preflight.js");
      const report = await preflight(flags.positionals[0], flags.url);
      // Non-zero exit signals "this script will not record cleanly".
      if (report.failedCount > 0) process.exit(3);
      return;
    }
    case "inspect": {
      if (flags.positionals[0]) process.env.PROTOTYPE_URL = flags.positionals[0];
      if (!flags.headed) process.env.HEADLESS = "1";
      const { main: inspect } = await import("./inspect-prototype.js");
      await inspect();
      return;
    }
    case "auth": {
      const { main: auth } = await import("./setup-auth.js");
      await auth();
      return;
    }
    case "setup": {
      console.log("[setup] installing Chromium for Playwright…");
      installBrowser();
      console.log("[setup] done.");
      return;
    }
    case "list": {
      const dir = path.join(PROJECT_ROOT, "scripts");
      const scripts = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".md")) : [];
      console.log(scripts.length ? "Available scripts:\n" + scripts.map((s) => `  scripts/${s}`).join("\n") : "No scripts found in scripts/.");
      console.log(`\nTemplate: script.template.md  ·  Guide: PLAYBOOK.md`);
      return;
    }
    default:
      console.error(`Unknown command: "${command}"\n\n${USAGE}`);
      process.exit(2);
  }
}

main().catch((err) => {
  console.error("[prototype-recorder-cli] FATAL:", err instanceof Error ? err.message : err);
  process.exit(1);
});
