/**
 * The walkthrough DSL grammar, mirrored from the prototype-recorder-cli engine
 * (src/journey/steps.ts + parse.ts). This is the deterministic contract the
 * validator enforces before any generated script is executed.
 *
 * NOTE: kept dependency-free and self-contained so the web/worker can validate
 * without pulling Playwright. Phase 3 unifies this with the engine's own parser
 * as the single source of truth (tracked in IMPLEMENTATION_STATUS.md).
 */

/** Verbs the engine understands. `goto` is intentionally excluded — the runner
 * always navigates to the configured URL itself, so generated scripts must not
 * navigate elsewhere. */
export const ALLOWED_VERBS = new Set<string>([
  "log",
  "pause",
  "hold",
  "settle",
  "press",
  "type",
  "fill",
  "click",
  "selectTab",
  "clickIfPresent",
  "tryClick",
  "clickIntent",
  "tryClickIntent",
  "clickEach",
  "clickInRow",
  "waitFor",
  "waitForHidden",
  "scrollTo",
  "scrollBy",
  "scrollToBottom",
  "scrollToTop",
  "scrollOverlayToBottom",
  "closeOverlay",
  "closeSearch",
  "moveCursor",
]);

/** Explicitly rejected verbs (navigation / anything not in ALLOWED_VERBS). */
export const REJECTED_VERBS = new Set<string>(["goto"]);

export const FRONT_MATTER_KEYS = new Set<string>([
  "name",
  "url",
  "viewport",
  "target_seconds",
  "output",
  "close_ignore",
  "storage_state",
]);

export type Token =
  | { kind: "word"; value: string }
  | { kind: "string"; value: string }
  | { kind: "regex"; source: string; flags: string }
  | { kind: "list"; items: string[] };

/** Tokenizer matching the engine: quotes, /regex/flags, [lists], words. */
export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = input.length;
  while (i < n) {
    const ch = input[i];
    if (ch === " " || ch === "\t") {
      i++;
      continue;
    }
    if (ch === "#") break;
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let val = "";
      while (j < n && input[j] !== quote) {
        if (input[j] === "\\" && j + 1 < n) {
          val += input[j + 1];
          j += 2;
        } else {
          val += input[j++];
        }
      }
      tokens.push({ kind: "string", value: val });
      i = j + 1;
      continue;
    }
    if (ch === "/") {
      let j = i + 1;
      let src = "";
      while (j < n && input[j] !== "/") {
        if (input[j] === "\\" && j + 1 < n) {
          src += input[j] + input[j + 1];
          j += 2;
        } else {
          src += input[j++];
        }
      }
      j++;
      let flags = "";
      while (j < n && /[a-z]/i.test(input[j])) flags += input[j++];
      tokens.push({ kind: "regex", source: src, flags });
      i = j;
      continue;
    }
    if (ch === "[") {
      const end = input.indexOf("]", i);
      const inner = input.slice(i + 1, end < 0 ? n : end);
      const items = inner
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      tokens.push({ kind: "list", items });
      i = end < 0 ? n : end + 1;
      continue;
    }
    let j = i;
    let word = "";
    while (j < n && input[j] !== " " && input[j] !== "\t") word += input[j++];
    tokens.push({ kind: "word", value: word });
    i = j;
  }
  return tokens;
}

export interface SplitScript {
  frontMatterRaw: Record<string, string>;
  hadFrontMatter: boolean;
  bodyLines: { text: string; line: number }[];
}

/** Split `---` front-matter from the body; parse simple `key: value` pairs. */
export function splitScript(script: string): SplitScript {
  const lines = script.replace(/\r\n/g, "\n").split("\n");
  const frontMatterRaw: Record<string, string> = {};
  let idx = 0;
  let hadFrontMatter = false;
  if (lines[0]?.trim() === "---") {
    hadFrontMatter = true;
    idx = 1;
    for (; idx < lines.length; idx++) {
      if (lines[idx].trim() === "---") {
        idx++;
        break;
      }
      const m = lines[idx].match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
      if (m) frontMatterRaw[m[1].trim()] = m[2].trim();
    }
  }
  const bodyLines = lines
    .slice(idx)
    .map((text, i) => ({ text, line: idx + i + 1 }));
  return { frontMatterRaw, hadFrontMatter, bodyLines };
}

/**
 * Force the front-matter `output:` to `name`.
 *
 * The engine names the file it writes from this key, while the pipeline looks
 * for a file named after the job. A reused or model-written script cannot know
 * the name of the job it will eventually run under, so the value is rewritten
 * here rather than trusted to match — a mismatch otherwise surfaces only after
 * a full recording, as a missing output file.
 */
export function withOutputName(script: string, name: string): string {
  const lines = script.replace(/\r\n/g, "\n").split("\n");
  // No front-matter at all is a validation error, not something to repair here.
  if (lines[0]?.trim() !== "---") return script;

  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      lines.splice(i, 0, `output: ${name}`);
      return lines.join("\n");
    }
    if (/^output\s*:/.test(lines[i])) {
      lines[i] = `output: ${name}`;
      return lines.join("\n");
    }
  }
  return script;
}

/** Extract step lines (`- verb …`) from body lines. */
export function stepLines(body: { text: string; line: number }[]): { verb: string; raw: string; line: number }[] {
  const steps: { verb: string; raw: string; line: number }[] = [];
  for (const { text, line } of body) {
    const t = text.trim();
    const m = t.match(/^[-*]\s+(.*)$/);
    if (!m) continue;
    const toks = tokenize(m[1]);
    if (!toks.length) continue;
    const first = toks[0];
    const verb = first.kind === "word" ? first.value : "";
    steps.push({ verb, raw: m[1], line });
  }
  return steps;
}
