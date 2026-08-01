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

/** How many screens past the landing page to open (0 disables exploration). */
function maxScreens(): number {
  const n = Number(process.env.INSPECT_SCREENS);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, 10) : 6;
}

export interface ExploredScreen {
  /** The control that was clicked to reach this screen. */
  label: string;
  url: string;
  buttons: string[];
  links: string[];
  textboxes: string[];
  tabs: string[];
  headings: string[];
  imgAlts: string[];
}

/** Accessible names, by role, for whatever is currently rendered. */
async function dumpElements(page: Page): Promise<Record<string, string[]>> {
  return page
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
      for (const k of Object.keys(results)) {
        results[k] = Array.from(new Set(results[k])).slice(0, 60);
      }
      return results;
    })
    .catch(() => ({}) as Record<string, string[]>);
}

/**
 * Accessible names of the primary navigation controls — the things a walkthrough
 * is most likely to click. Prefers real nav landmarks and falls back to whatever
 * sits in the top strip of the page.
 */
async function navCandidates(page: Page, limit: number): Promise<string[]> {
  return page
    .evaluate((max) => {
      const name = (el: Element): string => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria.trim();
        return ((el as HTMLElement).innerText || "").replace(/\s+/g, " ").trim();
      };
      const visible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.top >= 0 && r.top < window.innerHeight;
      };
      const usable = (n: string): boolean => n.length > 1 && n.length <= 40 && /[a-z]{2}/i.test(n);

      const pick = (roots: Element[]): string[] => {
        const out: string[] = [];
        for (const root of roots) {
          root.querySelectorAll("a, [role=link], button, [role=button], [role=tab]").forEach((el) => {
            if (!visible(el)) return;
            const n = name(el);
            if (usable(n)) out.push(n);
          });
        }
        return out;
      };

      const landmarks = Array.from(document.querySelectorAll("nav, header, aside, [role=navigation]"));
      let names = pick(landmarks);

      if (names.length < 2) {
        // No landmarks: take controls from the top strip of the viewport.
        const all: string[] = [];
        document.querySelectorAll("a, [role=link], button, [role=button], [role=tab]").forEach((el) => {
          if (!visible(el)) return;
          if (el.getBoundingClientRect().top > window.innerHeight * 0.25) return;
          const n = name(el);
          if (usable(n)) all.push(n);
        });
        names = all;
      }
      return Array.from(new Set(names)).slice(0, max);
    }, limit)
    .catch(() => [] as string[]);
}

/** URL plus leading heading — enough to tell "somewhere new" from "same screen". */
function screenSignature(url: string, headings: string[]): string {
  return `${url}|${headings[0] ?? ""}`;
}

/**
 * Click primary nav controls and record the screens they open. Navigation is
 * usually persistent, so screens are visited without resetting; if a control
 * goes missing the landing page is reloaded and exploration continues.
 *
 * Many controls (logos, home links, locale switchers) lead straight back to the
 * landing page, so candidates are tried until `limit` *distinct* screens have
 * been captured or the time budget runs out.
 */
async function exploreScreens(page: Page, url: string, limit: number): Promise<ExploredScreen[]> {
  if (limit === 0) return [];
  const candidates = await navCandidates(page, Math.min(limit * 3, 18));
  log("explore", `nav candidates: ${candidates.join(", ") || "(none)"}`);

  const landing = await dumpElements(page);
  const seen = new Set([screenSignature(page.url(), landing.headings ?? [])]);
  const screens: ExploredScreen[] = [];
  const deadline = Date.now() + 60_000;

  for (const label of candidates) {
    if (screens.length >= limit || Date.now() > deadline) break;
    try {
      const locator = page
        .getByRole("link", { name: label, exact: true })
        .or(page.getByRole("button", { name: label, exact: true }));

      if (!(await locator.first().isVisible().catch(() => false))) {
        // The control is gone — the previous click left the shared nav behind.
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: NAV_TIMEOUT });
        await page.waitForTimeout(2000);
        if (!(await locator.first().isVisible().catch(() => false))) continue;
      }
      await locator.first().click({ timeout: 5000 });
      await page.waitForTimeout(2200);

      const el = await dumpElements(page);
      const signature = screenSignature(page.url(), el.headings ?? []);
      if (seen.has(signature)) {
        log("explore", `"${label}" led nowhere new — skipped`);
        continue;
      }
      seen.add(signature);

      screens.push({
        label,
        url: page.url(),
        buttons: el.buttons ?? [],
        links: el.links ?? [],
        textboxes: el.textboxes ?? [],
        tabs: el.tabs ?? [],
        headings: el.headings ?? [],
        imgAlts: el.images ?? [],
      });
      log("explore", `"${label}" -> ${(el.headings ?? [])[0] ?? "(no heading)"}`);
    } catch (e) {
      log("explore", `"${label}" skipped (${String(e).slice(0, 80)})`);
    }
  }
  return screens;
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

  // Exploration navigates away, so it runs after every frame has been described.
  const screens = await exploreScreens(page, finalUrl, maxScreens());
  log("explore", `captured ${screens.length} screen(s) beyond the landing page`);
  report.push(`\n===== EXPLORED SCREENS =====\n${JSON.stringify(screens, null, 2)}`);

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
