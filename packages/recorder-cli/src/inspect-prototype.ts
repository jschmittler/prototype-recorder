/**
 * Initial inspection of the hosted prototype.
 *
 * Launches Chromium (headed), opens the prototype URL, waits for it to settle,
 * then reports what kind of page it is (direct prototype, Figma Make editor,
 * auth wall, cookie banner, iframe, etc.) and dumps resilient selector
 * candidates (roles/names, labels, placeholders, visible text) so the
 * walkthrough can be built against real DOM targets rather than placeholders.
 *
 * Usage:  npm run walkthrough:inspect
 *         HEADLESS=1 npm run walkthrough:inspect   (CI-friendly)
 */
import { chromium, type Frame, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getPrototypeUrl,
  VIEWPORT,
  TEST_RESULTS_DIR,
  NAV_TIMEOUT,
  STORAGE_STATE_PATH,
} from "./config.js";

function log(section: string, msg: string) {
  console.log(`[inspect] ${section} :: ${msg}`);
}

async function describeFrame(frame: Frame, label: string) {
  const out: string[] = [];
  out.push(`\n===== ${label} =====`);
  out.push(`url: ${frame.url()}`);
  try {
    const title = await frame.title();
    out.push(`title: ${title}`);
  } catch {
    /* cross-origin title may be unavailable */
  }

  // Roles + accessible names (buttons, links, textboxes, tabs, headings).
  const roleDump = await frame
    .evaluate(() => {
      function accName(el: Element): string {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        const text = (el as HTMLElement).innerText || el.textContent || "";
        return text.replace(/\s+/g, " ").trim().slice(0, 80);
      }
      const results: Record<string, string[]> = {
        buttons: [],
        links: [],
        textboxes: [],
        tabs: [],
        headings: [],
        images: [],
      };
      document.querySelectorAll("button, [role=button]").forEach((el) => {
        const n = accName(el);
        if (n) results.buttons.push(n);
      });
      document.querySelectorAll("a, [role=link]").forEach((el) => {
        const n = accName(el);
        if (n) results.links.push(n);
      });
      document
        .querySelectorAll("input, textarea, [role=textbox], [contenteditable=true]")
        .forEach((el) => {
          const ph = (el as HTMLInputElement).placeholder || el.getAttribute("aria-label") || "";
          results.textboxes.push(ph.trim() || "(no placeholder/label)");
        });
      document.querySelectorAll("[role=tab]").forEach((el) => {
        const n = accName(el);
        if (n) results.tabs.push(n);
      });
      document.querySelectorAll("h1, h2, h3, [role=heading]").forEach((el) => {
        const n = accName(el);
        if (n) results.headings.push(n);
      });
      document.querySelectorAll("img[alt], [role=img][aria-label]").forEach((el) => {
        const n = el.getAttribute("alt") || el.getAttribute("aria-label") || "";
        if (n) results.images.push(n.trim());
      });
      // De-dup while preserving order.
      for (const k of Object.keys(results)) {
        results[k] = Array.from(new Set(results[k])).slice(0, 60);
      }
      return results;
    })
    .catch((e) => ({ error: String(e) }) as Record<string, unknown>);

  out.push(`accessible elements:\n${JSON.stringify(roleDump, null, 2)}`);

  // A sample of visible text.
  const visibleText = await frame
    .evaluate(() => (document.body?.innerText || "").replace(/\n{2,}/g, "\n").slice(0, 2000))
    .catch(() => "(unavailable)");
  out.push(`visible text (truncated):\n${visibleText}`);

  return out.join("\n");
}

/** Fall back to a script.md's declared URL when PROTOTYPE_URL is not set. */
function scriptUrlFallback(): string | undefined {
  const p = process.env.SCRIPT;
  if (!p) return undefined;
  const abs = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  if (!fs.existsSync(abs)) return undefined;
  const m = fs.readFileSync(abs, "utf8").match(/^\s*url\s*:\s*(.+)$/m);
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : undefined;
}

export async function main() {
  const url = getPrototypeUrl(scriptUrlFallback());
  const headless = process.env.HEADLESS === "1";
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });

  log("setup", `prototype url = ${url}`);
  log("setup", `headless = ${headless}`);

  const browser = await chromium.launch({ headless });
  const contextOptions: Parameters<typeof browser.newContext>[0] = {
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  };
  if (fs.existsSync(STORAGE_STATE_PATH)) {
    log("setup", `reusing storage state at ${STORAGE_STATE_PATH}`);
    contextOptions.storageState = STORAGE_STATE_PATH;
  }
  const context = await browser.newContext(contextOptions);
  // tsx/esbuild "keepNames" injects __name() into functions serialized for
  // page.evaluate; shim it in the page so those calls resolve harmlessly.
  await context.addInitScript(() => {
    // @ts-expect-error runtime shim
    globalThis.__name = globalThis.__name || ((fn: unknown) => fn);
  });
  const page = await context.newPage();

  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  page.on("pageerror", (e) => consoleErrors.push(`pageerror: ${e.message}`));

  log("navigate", `goto ${url}`);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });

  // Let the SPA settle without relying solely on networkidle.
  await page.waitForTimeout(4000);
  await page
    .waitForLoadState("networkidle", { timeout: 15_000 })
    .catch(() => log("navigate", "networkidle not reached (expected for hosted SPA) — continuing"));
  await page.waitForTimeout(2000);

  const finalUrl = page.url();
  log("navigate", `final url = ${finalUrl}`);

  // Classify the page.
  const classification = await classifyPage(page, finalUrl);
  log("classify", JSON.stringify(classification, null, 2));

  // Screenshot.
  const shotPath = path.join(TEST_RESULTS_DIR, "inspection-initial.png");
  await page.screenshot({ path: shotPath, fullPage: false });
  log("screenshot", `saved ${shotPath}`);
  const fullShot = path.join(TEST_RESULTS_DIR, "inspection-fullpage.png");
  await page.screenshot({ path: fullShot, fullPage: true }).catch(() => {});
  log("screenshot", `saved ${fullShot}`);

  // Describe the main frame and any child frames.
  const report: string[] = [];
  report.push(`Prototype inspection report`);
  report.push(`generated for: ${url}`);
  report.push(`final url: ${finalUrl}`);
  report.push(`classification: ${JSON.stringify(classification, null, 2)}`);

  report.push(await describeFrame(page.mainFrame(), "MAIN FRAME"));

  const childFrames = page.frames().filter((f) => f !== page.mainFrame());
  log("frames", `found ${childFrames.length} child frame(s)`);
  for (let i = 0; i < childFrames.length; i++) {
    report.push(await describeFrame(childFrames[i], `CHILD FRAME #${i} (${childFrames[i].url()})`));
  }

  if (consoleErrors.length) {
    report.push(`\n===== CONSOLE / PAGE ERRORS =====\n${consoleErrors.join("\n")}`);
  }

  const reportPath = path.join(TEST_RESULTS_DIR, "inspection-report.txt");
  fs.writeFileSync(reportPath, report.join("\n"));
  log("report", `saved ${reportPath}`);

  console.log("\n" + report.join("\n"));

  if (!headless) {
    log("done", "Keeping browser open 8s for visual inspection…");
    await page.waitForTimeout(8000);
  }

  await context.close();
  await browser.close();
  log("done", "inspection complete");
}

async function classifyPage(page: Page, finalUrl: string) {
  const iframeCount = page.frames().length - 1;
  const looksLikeFigmaEditor =
    /figma\.com\/(file|design|make)/i.test(finalUrl) ||
    (await page.locator("text=/Figma/i").count().catch(() => 0)) > 3;
  const looksLikeSSO = /login|signin|sso|auth|okta|autodesk\.com\/auth/i.test(finalUrl);
  const isFigmaSite = /figma\.site/i.test(finalUrl);

  // Cookie / consent banner heuristics.
  const consentSelectors = [
    "text=/accept all/i",
    "text=/accept cookies/i",
    "text=/i agree/i",
    "[id*=cookie i]",
    "[class*=cookie i]",
    "[aria-label*=consent i]",
  ];
  let consentBanner = false;
  for (const sel of consentSelectors) {
    if ((await page.locator(sel).count().catch(() => 0)) > 0) {
      consentBanner = true;
      break;
    }
  }

  return {
    finalUrl,
    isPublishedFigmaSite: isFigmaSite,
    iframeCount,
    prototypeInIframe: iframeCount > 0,
    looksLikeFigmaEditor,
    looksLikeSSOorAuth: looksLikeSSO,
    consentBannerDetected: consentBanner,
  };
}

const invokedDirectly = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((err) => {
    console.error("[inspect] FATAL", err);
    process.exit(1);
  });
}
