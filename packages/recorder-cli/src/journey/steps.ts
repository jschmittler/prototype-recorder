/**
 * Step executor: turns parsed script.md steps into real browser actions using
 * the shared cursor / scrolling / interaction helpers.
 *
 * Target resolution follows the required selector priority:
 *   accessible role+name → label → placeholder → alt/testid → visible text →
 *   CSS. A bare quoted/regex target is tried as a button, link, tab, then text.
 * Icon-only close controls (no accessible name) are handled by `closeOverlay`,
 * which prefers an accessible "close" control and otherwise clicks the visible
 * X icon, skipping persistent chrome named in the front-matter `close_ignore`.
 */
import type { Locator, Page } from "@playwright/test";
import type { ScriptConfig, Step, Token } from "./parse.js";
import {
  moveAndClick,
  moveAndClickPoint,
  pause as pauseFn,
  settle,
} from "../helpers/interactions.js";
import {
  bringIntoViewSmooth,
  revealIfNeeded,
  smoothScrollWindowBy,
  smoothScrollWindowToBottom,
  smoothScrollWindowToTop,
  smoothScrollOverlayToBottom,
} from "../helpers/scrolling.js";
import { moveCursorTo } from "../helpers/cursor.js";

const TYPE_KEYWORDS = new Set(["role", "text", "placeholder", "label", "alt", "testid", "css"]);

interface Target {
  candidates: Locator[];
  describe: string;
}

function tokenName(t: Token): string | RegExp {
  if (t.kind === "string") return t.value;
  if (t.kind === "word") return t.value;
  if (t.kind === "regex") {
    // Default to case-insensitive so scripts match names regardless of CSS
    // text-transform (accessible names use raw DOM text, not the visual case).
    const flags = t.flags.includes("i") ? t.flags : t.flags + "i";
    return new RegExp(t.source, flags || undefined);
  }
  throw new Error(`Cannot use a list where a name is expected`);
}

function isDuration(t: Token | undefined): boolean {
  return !!t && t.kind === "word" && /^\d+(\.\d+)?(ms|s)$/.test(t.value);
}

/** Parse a duration token like "2.5s" or "800ms" to milliseconds. */
export function durationMs(value: string): number {
  const m = value.match(/^(\d+(?:\.\d+)?)(ms|s)$/);
  if (!m) throw new Error(`Invalid duration: "${value}"`);
  const n = Number(m[1]);
  return m[2] === "s" ? Math.round(n * 1000) : Math.round(n);
}

export class Executor {
  private pace: number;

  constructor(
    private page: Page,
    private config: ScriptConfig,
    private log: (msg: string) => void
  ) {
    const p = Number(process.env.PACE);
    this.pace = Number.isFinite(p) && p > 0 ? p : 1;
  }

  private ms(base: number): number {
    return Math.round(base * this.pace);
  }

  /** Scaled duration from an optional trailing token, else a scaled default. */
  private optDuration(tok: Token | undefined, fallback: number): number {
    return isDuration(tok) ? this.ms(durationMs((tok as { value: string }).value)) : this.ms(fallback);
  }

  /** Build a Target (ordered candidate locators) from the tokens after a verb. */
  private resolveTarget(tokens: Token[]): { target: Target; consumed: number } {
    const page = this.page;
    const t0 = tokens[0];
    if (t0?.kind === "word" && TYPE_KEYWORDS.has(t0.value)) {
      switch (t0.value) {
        case "role": {
          const role = (tokens[1] as { value: string }).value as Parameters<Page["getByRole"]>[0];
          const name = tokenName(tokens[2]);
          return {
            target: { candidates: [page.getByRole(role, { name })], describe: `role ${role} "${name}"` },
            consumed: 3,
          };
        }
        case "text":
          return { target: { candidates: [page.getByText(tokenName(tokens[1]))], describe: `text ${describeName(tokens[1])}` }, consumed: 2 };
        case "placeholder":
          return { target: { candidates: [page.getByPlaceholder(tokenName(tokens[1]))], describe: `placeholder ${describeName(tokens[1])}` }, consumed: 2 };
        case "label":
          return { target: { candidates: [page.getByLabel(tokenName(tokens[1]))], describe: `label ${describeName(tokens[1])}` }, consumed: 2 };
        case "alt":
          return { target: { candidates: [page.getByAltText(tokenName(tokens[1]))], describe: `alt ${describeName(tokens[1])}` }, consumed: 2 };
        case "testid":
          return { target: { candidates: [page.getByTestId(tokenName(tokens[1]) as string)], describe: `testid ${describeName(tokens[1])}` }, consumed: 2 };
        case "css": {
          const sel = tokens[1].kind === "string" ? tokens[1].value : (tokens[1] as { value: string }).value;
          return { target: { candidates: [page.locator(sel)], describe: `css ${sel}` }, consumed: 2 };
        }
      }
    }
    // Bare name → smart cascade.
    const name = tokenName(t0);
    return {
      target: {
        candidates: [
          page.getByRole("button", { name }),
          page.getByRole("link", { name }),
          page.getByRole("tab", { name }),
          page.getByText(name),
        ],
        describe: `"${describeName(t0)}" (button/link/tab/text)`,
      },
      consumed: 1,
    };
  }

  /** Return the first visible candidate (polling briefly), or the first that exists. */
  private async pick(target: Target, timeout = 12_000): Promise<Locator> {
    const deadline = Date.now() + timeout;
    do {
      for (const c of target.candidates) {
        if ((await c.count().catch(() => 0)) > 0 && (await c.first().isVisible().catch(() => false))) {
          return c.first();
        }
      }
      await this.page.waitForTimeout(150);
    } while (Date.now() < deadline);
    for (const c of target.candidates) {
      if ((await c.count().catch(() => 0)) > 0) return c.first();
    }
    throw new Error(`No element found for ${target.describe}`);
  }

  private async waitVisible(target: Target, timeout = 15_000): Promise<void> {
    const deadline = Date.now() + timeout;
    do {
      for (const c of target.candidates) {
        if (await c.first().isVisible().catch(() => false)) return;
      }
      await this.page.waitForTimeout(200);
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for ${target.describe} to be visible`);
  }

  private async waitHidden(target: Target, timeout = 15_000): Promise<void> {
    const deadline = Date.now() + timeout;
    do {
      let anyVisible = false;
      for (const c of target.candidates) {
        if (await c.first().isVisible().catch(() => false)) anyVisible = true;
      }
      if (!anyVisible) return;
      await this.page.waitForTimeout(200);
    } while (Date.now() < deadline);
    throw new Error(`Timed out waiting for ${target.describe} to be hidden`);
  }

  /** Type into the currently focused element, one char at a time. */
  private async typeChars(text: string): Promise<void> {
    for (let i = 0; i < text.length; i++) {
      await this.page.keyboard.type(text[i]);
      await this.page.waitForTimeout(80 + ((i * 37) % 70)); // 80–150ms band
    }
  }

  /** Close a modal/panel: accessible close first, else the visible X icon. */
  private async closeOverlay(): Promise<void> {
    // 1) accessible close control
    const accessible = [
      this.page.getByRole("button", { name: /^(close|dismiss)$/i }),
      this.page.getByRole("button", { name: /close/i }),
      this.page.locator('[aria-label*="close" i], [aria-label*="dismiss" i]'),
    ];
    for (const loc of accessible) {
      if ((await loc.count().catch(() => 0)) > 0 && (await loc.first().isVisible().catch(() => false))) {
        await moveAndClick(this.page, loc.first(), { label: "close overlay (accessible)", noScroll: true, settleMs: this.ms(800) });
        return;
      }
    }
    // 2) icon-only X, skipping persistent chrome from close_ignore
    const pt = await this.page.evaluate((ignore: string[]) => {
      const isX = (el: Element): boolean => {
        if (el.querySelector("svg.lucide-x, svg.lucide-x-icon")) return true;
        const svgPath = el.querySelector("svg path");
        const d = svgPath?.getAttribute("d") || "";
        if (/M18 6\s*[, ]?6 18|M6 6l12 12|M6 18L18 6/i.test(d)) return true;
        const txt = (el.textContent || "").trim();
        return ["×", "✕", "✖", "⨯", "x", "X"].includes(txt);
      };
      const cands = Array.from(document.querySelectorAll("button, [role=button]"))
        .filter((b) => isX(b))
        .map((b) => {
          const r = b.getBoundingClientRect();
          let anc: HTMLElement | null = b.parentElement;
          let ptxt = "";
          for (let i = 0; i < 2 && anc; i++) {
            ptxt += " " + (anc.innerText || "");
            anc = anc.parentElement;
          }
          const ignored = ignore.some((s) => s && ptxt.toLowerCase().includes(s.toLowerCase()));
          return { x: r.x + r.width / 2, y: r.y + r.height / 2, vis: r.width > 0 && r.height > 0 && r.top < window.innerHeight && r.bottom > 0, ignored };
        })
        .filter((c) => c.vis && !c.ignored)
        .sort((a, b) => a.y - b.y);
      return cands[0] || null;
    }, this.config.closeIgnore);
    if (!pt) throw new Error("closeOverlay: no accessible or icon close control found");
    await moveAndClickPoint(this.page, { x: pt.x, y: pt.y }, "close overlay (X icon)", this.ms(800));
  }

  /** Execute one parsed step. Throws on failure (the runner captures artifacts). */
  async execute(step: Step): Promise<void> {
    const { verb, tokens } = step;
    const page = this.page;
    switch (verb) {
      case "log":
        this.log(`   ▸ ${tokens.map((t) => ("value" in t ? t.value : "")).join(" ")}`);
        return;
      case "pause":
      case "hold": {
        const d = tokens[0] && tokens[0].kind === "word" ? durationMs(tokens[0].value) : 1000;
        await pauseFn(page, this.ms(d));
        return;
      }
      case "settle":
        await settle(page, this.ms(tokens[0]?.kind === "word" ? durationMs(tokens[0].value) : 500));
        return;
      case "goto": {
        const url = tokens[0]?.kind === "string" ? tokens[0].value : this.config.url;
        if (!url) throw new Error("goto: no URL provided or configured");
        await page.goto(url, { waitUntil: "domcontentloaded" });
        return;
      }
      case "press": {
        const key = (tokens[0] as { value: string }).value;
        await page.keyboard.press(key);
        return;
      }
      case "type": {
        const textTok = tokens.find((t) => t.kind === "string");
        if (!textTok || textTok.kind !== "string") throw new Error('type: expected a "text" argument');
        await this.typeChars(textTok.value);
        this.log(`   ✓ typed "${textTok.value}"`);
        return;
      }
      case "fill": {
        const { target, consumed } = this.resolveTarget(tokens);
        const textTok = tokens[consumed];
        if (!textTok || textTok.kind !== "string") throw new Error('fill: expected <target> "text"');
        const loc = await this.pick(target);
        await revealIfNeeded(page, loc);
        await moveAndClick(page, loc, { label: `focus ${target.describe}`, noScroll: true, settleMs: this.ms(250) });
        await this.typeChars(textTok.value);
        this.log(`   ✓ filled ${target.describe} with "${textTok.value}"`);
        return;
      }
      case "click":
      case "selectTab": {
        const { target, consumed } = this.resolveTarget(tokens);
        const settleTok = tokens[consumed];
        const settleMs = isDuration(settleTok) ? this.ms(durationMs((settleTok as { value: string }).value)) : this.ms(700);
        const loc = await this.pick(target);
        await revealIfNeeded(page, loc);
        await moveAndClick(page, loc, { label: target.describe, noScroll: true, settleMs });
        return;
      }
      case "clickIfPresent": {
        const { target } = this.resolveTarget(tokens);
        for (const c of target.candidates) {
          if ((await c.count().catch(() => 0)) > 0 && (await c.first().isVisible().catch(() => false))) {
            await revealIfNeeded(page, c.first());
            await moveAndClick(page, c.first(), { label: target.describe, noScroll: true, settleMs: this.ms(700) });
            return;
          }
        }
        this.log(`   • not present, skipping: ${target.describe}`);
        return;
      }
      case "clickEach": {
        const listTok = tokens.find((t) => t.kind === "list");
        if (!listTok || listTok.kind !== "list") throw new Error("clickEach: expected a [list] of names");
        const durTok = tokens.find((t) => isDuration(t));
        const perItem = durTok ? this.ms(durationMs((durTok as { value: string }).value)) : this.ms(1000);
        for (const item of listTok.items) {
          const target: Target = {
            candidates: [
              page.getByRole("button", { name: item, exact: true }),
              page.getByRole("button", { name: item }),
              page.getByRole("tab", { name: item }),
              page.getByText(item),
            ],
            describe: `each › "${item}"`,
          };
          const loc = await this.pick(target);
          await revealIfNeeded(page, loc);
          await moveAndClick(page, loc, { label: target.describe, noScroll: true, settleMs: perItem });
        }
        return;
      }
      case "clickInRow": {
        // clickInRow "<scope text>" "<button name>" [settle]
        // Clicks the control named <button name> inside the smallest element
        // that also contains <scope text> — e.g. the "Manage" button in the
        // "Fusion" row when several identical buttons exist.
        const scope = tokens[0]?.kind === "string" ? tokens[0].value : "";
        const nameTok = tokens[1];
        const name = nameTok && (nameTok.kind === "string" || nameTok.kind === "word") ? String(nameTok.value) : "";
        if (!scope || !name) throw new Error('clickInRow: expected "<scope>" "<name>"');
        const settleTok = tokens[2];
        const pt = await page.evaluate(
          ({ scope, name }) => {
            const norm = (s: string | null) => (s || "").replace(/\s+/g, " ").trim().toLowerCase();
            const wanted = norm(name);
            const scopeL = scope.toLowerCase();
            const btns = Array.from(document.querySelectorAll("button, [role=button], a")).filter((b) => {
              const t = norm((b as HTMLElement).innerText);
              return t === wanted || t.includes(wanted);
            });
            let best: { x: number; y: number } | null = null;
            let bestSize = Infinity;
            for (const b of btns) {
              let anc: HTMLElement | null = b as HTMLElement;
              for (let i = 0; i < 6 && anc; i++) {
                if ((anc.innerText || "").toLowerCase().includes(scopeL)) {
                  const ar = anc.getBoundingClientRect();
                  const size = ar.width * ar.height;
                  if (size < bestSize) {
                    bestSize = size;
                    const br = (b as HTMLElement).getBoundingClientRect();
                    best = { x: br.x + br.width / 2, y: br.y + br.height / 2 };
                  }
                  break;
                }
                anc = anc.parentElement;
              }
            }
            return best;
          },
          { scope, name }
        );
        if (!pt) throw new Error(`clickInRow: no "${name}" control found in a row containing "${scope}"`);
        await moveAndClickPoint(page, pt, `"${name}" in "${scope}" row`, isDuration(settleTok) ? this.ms(durationMs((settleTok as { value: string }).value)) : this.ms(800));
        return;
      }
      case "waitFor": {
        const { target } = this.resolveTarget(tokens);
        await this.waitVisible(target);
        this.log(`   ✓ visible: ${target.describe}`);
        return;
      }
      case "waitForHidden": {
        const { target } = this.resolveTarget(tokens);
        await this.waitHidden(target);
        this.log(`   ✓ hidden: ${target.describe}`);
        return;
      }
      case "scrollTo": {
        const { target, consumed } = this.resolveTarget(tokens);
        const dur = this.optDuration(tokens[consumed], 1000);
        const loc = await this.pick(target);
        await bringIntoViewSmooth(page, loc, dur);
        return;
      }
      case "scrollBy": {
        const px = Number((tokens[0] as { value: string }).value);
        await smoothScrollWindowBy(page, px, this.optDuration(tokens[1], 1200));
        return;
      }
      case "scrollToBottom":
        await smoothScrollWindowToBottom(page, this.optDuration(tokens[0], 2300));
        return;
      case "scrollToTop":
        await smoothScrollWindowToTop(page, this.optDuration(tokens[0], 1300));
        return;
      case "scrollOverlayToBottom": {
        const dur = this.optDuration(tokens[0], 2300);
        const ok = await smoothScrollOverlayToBottom(page, dur);
        if (!ok) await smoothScrollWindowToBottom(page, dur);
        return;
      }
      case "closeOverlay":
      case "closeSearch":
        await this.closeOverlay();
        return;
      case "moveCursor": {
        const x = Number((tokens[0] as { value: string }).value);
        const y = Number((tokens[1] as { value: string }).value);
        await moveCursorTo(page, x, y, this.ms(600));
        return;
      }
      default:
        throw new Error(`Unknown verb "${verb}" (line ${step.line}): ${step.raw}`);
    }
  }
}

function describeName(t: Token): string {
  if (t.kind === "string") return `"${t.value}"`;
  if (t.kind === "regex") return `/${t.source}/${t.flags}`;
  if (t.kind === "word") return t.value;
  return "[list]";
}
