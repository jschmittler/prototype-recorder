/**
 * Visible in-page cursor overlay.
 *
 * Playwright's native pointer is not captured in the recorded video, so we
 * inject a professional-looking cursor element into the page itself. It:
 *   - lives on <html> with the maximum z-index, so it floats above every
 *     dialog, panel, and the prototype content;
 *   - never blocks pointer events (pointer-events: none);
 *   - moves with eased interpolation driven by requestAnimationFrame in-page,
 *     so motion is smooth at the display refresh rate;
 *   - shows a subtle ripple on click.
 *
 * The prototype is a same-origin published figma.site rendered at the top
 * level (no cross-origin iframe), so injecting directly into the page works.
 */
import type { Page } from "@playwright/test";

export const CURSOR_START = { x: 720, y: 450 };

/**
 * Register init scripts so the cursor exists on the first document and is
 * re-created after any navigation. Also injects a shim for esbuild's __name
 * helper, which tsx bakes into functions serialized for the browser.
 */
export async function installCursor(page: Page): Promise<void> {
  // Must run before any other injected/evaluated function that esbuild touched.
  await page.addInitScript(() => {
    // @ts-expect-error runtime shim for esbuild keepNames output in the page
    globalThis.__name = globalThis.__name || ((fn: unknown) => fn);
  });

  await page.addInitScript((start) => {
    // @ts-expect-error guard flag
    if (window.__cursorInstalled) return;
    // @ts-expect-error guard flag
    window.__cursorInstalled = true;

    const CURSOR_ID = "__pw_cursor_overlay";
    const state = { x: start.x, y: start.y };
    // @ts-expect-error expose state for duration calculations
    window.__cursorState = state;

    const injectStyle = () => {
      if (document.getElementById("__pw_cursor_style")) return;
      const style = document.createElement("style");
      style.id = "__pw_cursor_style";
      style.textContent = `
        #${CURSOR_ID}{
          position: fixed; top: 0; left: 0; width: 28px; height: 28px;
          z-index: 2147483647; pointer-events: none;
          transform: translate(${state.x}px, ${state.y}px);
          will-change: transform; transition: none;
        }
        #${CURSOR_ID} svg{ display:block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.35)); }
        #${CURSOR_ID} .__pw_ripple{
          position:absolute; top:-6px; left:-6px; width:24px; height:24px;
          border-radius:50%; border:2px solid rgba(37,99,235,.9);
          background: rgba(37,99,235,.18);
          opacity:0; transform: scale(.2); pointer-events:none;
        }
        #${CURSOR_ID}.__pw_clicking .__pw_ripple{ animation: __pw_ripple_anim .45s ease-out; }
        @keyframes __pw_ripple_anim{
          0%{ opacity:.9; transform: scale(.2); }
          100%{ opacity:0; transform: scale(1.9); }
        }
      `;
      (document.head || document.documentElement).appendChild(style);
    };

    const ensure = (): HTMLElement => {
      injectStyle();
      let c = document.getElementById(CURSOR_ID);
      if (!c) {
        c = document.createElement("div");
        c.id = CURSOR_ID;
        // Arrow pointer whose tip sits at (0,0) so translate == pointer position.
        c.innerHTML = `
          <span class="__pw_ripple"></span>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 2 L4 22 L9.5 16.8 L13 24.5 L16.2 23 L12.7 15.4 L20 15.2 Z"
                  fill="#ffffff" stroke="#111827" stroke-width="1.4" stroke-linejoin="round"/>
          </svg>`;
        c.style.transform = `translate(${state.x}px, ${state.y}px)`;
        (document.body || document.documentElement).appendChild(c);
      }
      return c;
    };

    const easeInOutQuad = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

    // @ts-expect-error expose API
    window.__cursorMoveTo = (tx: number, ty: number, duration: number) =>
      new Promise<void>((resolve) => {
        const c = ensure();
        const sx = state.x;
        const sy = state.y;
        const dur = Math.max(1, duration);
        const startTime = performance.now();
        const step = (now: number) => {
          const p = Math.min(1, (now - startTime) / dur);
          const e = easeInOutQuad(p);
          state.x = sx + (tx - sx) * e;
          state.y = sy + (ty - sy) * e;
          c.style.transform = `translate(${state.x}px, ${state.y}px)`;
          if (p < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });

    // @ts-expect-error expose API
    window.__cursorClick = () => {
      const c = ensure();
      c.classList.remove("__pw_clicking");
      // Force reflow so the animation restarts on repeated clicks.
      void c.offsetWidth;
      c.classList.add("__pw_clicking");
      setTimeout(() => c.classList.remove("__pw_clicking"), 480);
    };

    // Keep the cursor alive if the SPA re-renders <body>.
    const keepAlive = () => {
      ensure();
      requestAnimationFrame(keepAlive);
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        ensure();
        requestAnimationFrame(keepAlive);
      });
    } else {
      ensure();
      requestAnimationFrame(keepAlive);
    }
  }, CURSOR_START);
}

/** Make sure the overlay exists on the currently loaded document. */
export async function ensureCursor(page: Page): Promise<void> {
  await page.evaluate(() => {
    // @ts-expect-error injected
    if (typeof window.__cursorMoveTo !== "function") return;
    // touch move-to with zero distance to force ensure()
    // @ts-expect-error injected
    return window.__cursorMoveTo(window.__cursorState.x, window.__cursorState.y, 1);
  });
}

/** Current cursor position in viewport coordinates. */
export async function cursorPosition(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    // @ts-expect-error injected
    const s = window.__cursorState || { x: 0, y: 0 };
    return { x: s.x, y: s.y };
  });
}

/** Duration (ms) scaled by travel distance, clamped to the 300–800ms band. */
export function durationForDistance(dx: number, dy: number): number {
  const dist = Math.hypot(dx, dy);
  return Math.round(Math.min(800, Math.max(300, 300 + dist * 0.55)));
}

/** Move the visible cursor smoothly to a viewport point. */
export async function moveCursorTo(page: Page, x: number, y: number, duration?: number): Promise<void> {
  const pos = await cursorPosition(page);
  const dur = duration ?? durationForDistance(x - pos.x, y - pos.y);
  await page.evaluate(
    ({ x, y, dur }) =>
      // @ts-expect-error injected
      window.__cursorMoveTo(x, y, dur),
    { x, y, dur }
  );
}

/** Trigger the click ripple on the visible cursor. */
export async function cursorClickAnimation(page: Page): Promise<void> {
  await page.evaluate(() => {
    // @ts-expect-error injected
    window.__cursorClick && window.__cursorClick();
  });
}
