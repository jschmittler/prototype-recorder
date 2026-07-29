/**
 * Smooth, readable scrolling helpers.
 *
 * All visible scrolling is animated in-page with requestAnimationFrame easing
 * so the recording never shows an instant `scrollIntoView` jump. We scroll the
 * document by default, but also support scrolling an arbitrary scroll container
 * (used by full-screen overlays such as the Starter Path that manage their own
 * scroll region).
 */
import type { Locator, Page } from "@playwright/test";

/** Animate the window scroll to an absolute Y position. */
export async function smoothScrollWindowTo(page: Page, targetY: number, duration = 1400): Promise<void> {
  await page.evaluate(
    ({ targetY, duration }) =>
      new Promise<void>((resolve) => {
        const startY = window.scrollY;
        const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const goal = Math.max(0, Math.min(targetY, maxY));
        const delta = goal - startY;
        if (Math.abs(delta) < 2) return resolve();
        const startTime = performance.now();
        const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const step = (now: number) => {
          const p = Math.min(1, (now - startTime) / duration);
          window.scrollTo(0, startY + delta * ease(p));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { targetY, duration }
  );
}

/** Animate the window scroll by a relative amount. */
export async function smoothScrollWindowBy(page: Page, dy: number, duration = 1000): Promise<void> {
  const startY = await page.evaluate(() => window.scrollY);
  await smoothScrollWindowTo(page, startY + dy, duration);
}

/** Animate the window scroll to the very bottom of the document. */
export async function smoothScrollWindowToBottom(page: Page, duration = 2600): Promise<void> {
  await page.evaluate(
    ({ duration }) =>
      new Promise<void>((resolve) => {
        const startY = window.scrollY;
        const goal = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
        const delta = goal - startY;
        if (Math.abs(delta) < 2) return resolve();
        const startTime = performance.now();
        const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const step = (now: number) => {
          const p = Math.min(1, (now - startTime) / duration);
          // Recompute goal each frame in case lazy content grows the page.
          const liveGoal = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
          window.scrollTo(0, startY + (Math.max(delta, liveGoal - startY)) * ease(p));
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    { duration }
  );
}

export async function smoothScrollWindowToTop(page: Page, duration = 1400): Promise<void> {
  await smoothScrollWindowTo(page, 0, duration);
}

/**
 * Find the dominant scrollable element (largest scrollable overflow) and
 * animate it to the bottom. Returns true if such a container was scrolled.
 * Used for overlays whose content scrolls inside a panel rather than the window.
 */
export async function smoothScrollOverlayToBottom(page: Page, duration = 2400): Promise<boolean> {
  return page.evaluate(
    ({ duration }) =>
      new Promise<boolean>((resolve) => {
        const candidates = Array.from(document.querySelectorAll<HTMLElement>("*")).filter((el) => {
          const style = getComputedStyle(el);
          const oy = style.overflowY;
          return (
            (oy === "auto" || oy === "scroll") &&
            el.scrollHeight - el.clientHeight > 40 &&
            el.clientHeight > 200
          );
        });
        if (!candidates.length) return resolve(false);
        // Pick the one with the most hidden content.
        candidates.sort((a, b) => b.scrollHeight - b.clientHeight - (a.scrollHeight - a.clientHeight));
        const el = candidates[0];
        const startTop = el.scrollTop;
        const goal = el.scrollHeight - el.clientHeight;
        const delta = goal - startTop;
        if (Math.abs(delta) < 2) return resolve(true);
        const startTime = performance.now();
        const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
        const step = (now: number) => {
          const p = Math.min(1, (now - startTime) / duration);
          const liveGoal = el.scrollHeight - el.clientHeight;
          el.scrollTop = startTop + Math.max(delta, liveGoal - startTop) * ease(p);
          if (p < 1) requestAnimationFrame(step);
          else resolve(true);
        };
        requestAnimationFrame(step);
      }),
    { duration }
  );
}

/**
 * Smoothly reveal a locator ONLY if it is not already fully within the
 * viewport, scrolling the minimum amount needed. Unlike `bringIntoViewSmooth`
 * this never re-centres an element that is already visible, so clicking a fixed
 * / already-on-screen control (e.g. a floating button or header logo) does not
 * trigger a spurious scroll.
 */
export async function revealIfNeeded(page: Page, locator: Locator, duration = 700): Promise<void> {
  const box = await locator.boundingBox().catch(() => null);
  const vh = page.viewportSize()?.height ?? 900;
  if (!box) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    return;
  }
  const margin = 48;
  const top = box.y;
  const bottom = box.y + box.height;
  if (top >= 0 && bottom <= vh) return; // fully visible
  let dy = 0;
  if (top < margin) dy = top - margin;
  else if (bottom > vh - margin) dy = bottom - (vh - margin);
  if (Math.abs(dy) < 4) return;
  await smoothScrollWindowBy(page, dy, duration);
}

/**
 * Smoothly bring a locator comfortably into the viewport by animating the
 * window scroll so the element's center sits around 45% of the viewport height.
 * `scrollIntoViewIfNeeded` is used only to locate (it does not animate); the
 * visible movement is the eased window scroll.
 */
export async function bringIntoViewSmooth(page: Page, locator: Locator, duration = 900): Promise<void> {
  const box = await locator.boundingBox();
  const vh = page.viewportSize()?.height ?? 900;
  if (!box) {
    await locator.scrollIntoViewIfNeeded().catch(() => {});
    return;
  }
  const centerY = box.y + box.height / 2;
  const desired = vh * 0.45;
  const dy = centerY - desired;
  if (Math.abs(dy) < 24) return; // already comfortably visible
  await smoothScrollWindowBy(page, dy, duration);
}
