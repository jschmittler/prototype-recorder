/**
 * High-level interaction helpers that combine the visible cursor, smooth
 * scrolling, human-like timing, and resilient waiting.
 *
 * Every click follows the required sequence: locate → scroll into view →
 * wait until visible & stable → compute center → move the visible cursor →
 * short pause → click once → click ripple → settle pause. Clicks are performed
 * by coordinate (synchronised with the visible cursor) and are never retried in
 * a way that could trigger the action twice.
 */
import type { Locator, Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { cursorClickAnimation, moveCursorTo } from "./cursor.js";
import { bringIntoViewSmooth } from "./scrolling.js";
import { TEST_RESULTS_DIR } from "../config.js";

/** Simple presentation pause. */
export async function pause(page: Page, ms: number): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Randomised micro-pause for a natural cadence. */
export function jitter(base: number, spread = 0): number {
  if (spread <= 0) return base;
  // Deterministic-enough variation without Math.random (unavailable in some ctx).
  const t = (base * 9301 + 49297) % 233280;
  return Math.round(base + (t / 233280) * spread);
}

/** Wait for the page to be meaningfully idle without depending only on networkidle. */
export async function settle(page: Page, ms = 500): Promise<void> {
  await page
    .waitForLoadState("networkidle", { timeout: 4000 })
    .catch(() => {});
  await page.waitForTimeout(ms);
}

/** Center of a locator in viewport coordinates. */
export async function centerOf(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Element has no bounding box (not visible / detached)");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

export interface ClickOptions {
  /** Human-readable step label used in logs and error messages. */
  label: string;
  /** Skip the smooth scroll-into-view (for elements already framed). */
  noScroll?: boolean;
  /** Pause (ms) after the click for the resulting state to appear. */
  settleMs?: number;
  /** Pause (ms) between arriving at the target and clicking. */
  preClickMs?: number;
}

/**
 * Move the visible cursor to an element and click it once.
 * Returns the clicked point.
 */
export async function moveAndClick(
  page: Page,
  locator: Locator,
  opts: ClickOptions
): Promise<{ x: number; y: number }> {
  const { label } = opts;
  await locator.waitFor({ state: "visible", timeout: 15_000 });
  if (!opts.noScroll) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    await bringIntoViewSmooth(page, locator);
  }
  // Wait until the element is stable (two consecutive equal boxes).
  const point = await waitForStablePoint(page, locator);
  await moveCursorTo(page, point.x, point.y);
  await page.mouse.move(point.x, point.y);
  await pause(page, opts.preClickMs ?? 180);
  await cursorClickAnimation(page);
  await page.mouse.click(point.x, point.y);
  console.log(`   ✓ clicked: ${label} @ (${Math.round(point.x)}, ${Math.round(point.y)})`);
  await pause(page, opts.settleMs ?? 700);
  return point;
}

/** Move the cursor to an element and click a precomputed point (already framed). */
export async function moveAndClickPoint(
  page: Page,
  point: { x: number; y: number },
  label: string,
  settleMs = 700
): Promise<void> {
  await moveCursorTo(page, point.x, point.y);
  await page.mouse.move(point.x, point.y);
  await pause(page, 180);
  await cursorClickAnimation(page);
  await page.mouse.click(point.x, point.y);
  console.log(`   ✓ clicked: ${label} @ (${Math.round(point.x)}, ${Math.round(point.y)})`);
  await pause(page, settleMs);
}

/** Poll a locator's box until it stops moving, then return its center. */
export async function waitForStablePoint(page: Page, locator: Locator): Promise<{ x: number; y: number }> {
  let prev = await locator.boundingBox();
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(120);
    const cur = await locator.boundingBox();
    if (prev && cur && Math.abs(prev.x - cur.x) < 1 && Math.abs(prev.y - cur.y) < 1) {
      return { x: cur.x + cur.width / 2, y: cur.y + cur.height / 2 };
    }
    prev = cur;
  }
  if (!prev) throw new Error("Element never produced a stable bounding box");
  return { x: prev.x + prev.width / 2, y: prev.y + prev.height / 2 };
}

/** Move the cursor to a field, click it, and type text one character at a time. */
export async function typeInto(
  page: Page,
  locator: Locator,
  text: string,
  opts: { label: string; perChar?: [number, number] } = { label: "field" }
): Promise<void> {
  await moveAndClick(page, locator, { label: `focus ${opts.label}`, settleMs: 250 });
  const [min, max] = opts.perChar ?? [80, 150];
  for (let i = 0; i < text.length; i++) {
    // Vary delay within the 80–150ms band deterministically.
    const delay = min + ((i * 37) % Math.max(1, max - min));
    await page.keyboard.type(text[i], { delay: 0 });
    await page.waitForTimeout(delay);
  }
  console.log(`   ✓ typed "${text}" into ${opts.label}`);
}

/**
 * Try a list of locators in priority order and return the first one that is
 * present and visible. Throws with context if none match.
 */
export async function firstVisible(
  page: Page,
  candidates: { locator: Locator; desc: string }[],
  label: string
): Promise<Locator> {
  for (const c of candidates) {
    const count = await c.locator.count().catch(() => 0);
    if (count > 0) {
      const loc = c.locator.first();
      if (await loc.isVisible().catch(() => false)) {
        return loc;
      }
    }
  }
  throw new Error(
    `No visible target for "${label}". Tried: ${candidates.map((c) => c.desc).join(" | ")}`
  );
}

/** Wait for an accessible element (by text) to appear, confirming a state change. */
export async function waitForText(page: Page, text: string | RegExp, timeout = 15_000): Promise<void> {
  await page.getByText(text).first().waitFor({ state: "visible", timeout });
}

/** Console/page error collector attached to a page. */
export function attachErrorCollectors(page: Page): { errors: string[] } {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return { errors };
}

/**
 * Persist failure artifacts under test-results/: screenshot, page text,
 * current URL, failing step + selector, console/page errors. The Playwright
 * trace is stopped/saved by the caller (it owns the tracing lifecycle).
 */
export async function captureFailure(
  page: Page,
  info: { step: string; selector?: string; errors: string[]; error: unknown }
): Promise<void> {
  fs.mkdirSync(TEST_RESULTS_DIR, { recursive: true });
  const stamp = "failure";
  try {
    await page.screenshot({ path: path.join(TEST_RESULTS_DIR, `${stamp}-screenshot.png`), fullPage: false });
  } catch {
    /* ignore */
  }
  let text = "(unavailable)";
  try {
    text = await page.evaluate(() => document.body?.innerText?.slice(0, 4000) ?? "");
  } catch {
    /* ignore */
  }
  const report = [
    `Failing step: ${info.step}`,
    `Failed selector: ${info.selector ?? "(n/a)"}`,
    `Current URL: ${page.url()}`,
    `Error: ${info.error instanceof Error ? info.error.stack ?? info.error.message : String(info.error)}`,
    ``,
    `Console / page errors:`,
    info.errors.length ? info.errors.join("\n") : "(none)",
    ``,
    `Visible page text (truncated):`,
    text,
  ].join("\n");
  fs.writeFileSync(path.join(TEST_RESULTS_DIR, `${stamp}-report.txt`), report);
  console.error(`\n[record] FAILURE captured to test-results/ — step "${info.step}"`);
}
