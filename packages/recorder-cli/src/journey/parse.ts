/**
 * Parser for `script.md` walkthrough files.
 *
 * A script has optional YAML-ish front-matter between `---` fences, then
 * `## N. Section` headers, each followed by `- <verb> <args>` step lines.
 * Blank lines and `#` comments are ignored. See PLAYBOOK.md / script.template.md
 * for the full step vocabulary.
 */

export type Token =
  | { kind: "word"; value: string }
  | { kind: "string"; value: string }
  | { kind: "regex"; source: string; flags: string }
  | { kind: "list"; items: string[] };

export interface Step {
  verb: string;
  tokens: Token[]; // args after the verb
  raw: string;
  line: number;
  section: string;
}

export interface Section {
  title: string;
  steps: Step[];
}

export interface ScriptConfig {
  name: string;
  url?: string;
  viewport: { width: number; height: number };
  targetSeconds?: number;
  storageState?: string;
  output?: string;
  /** Text snippets identifying persistent chrome whose close X should be ignored. */
  closeIgnore: string[];
}

export interface ParsedScript {
  config: ScriptConfig;
  sections: Section[];
}

/** Tokenize a single step's argument text (quotes, /regex/flags, [lists], words). */
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
    if (ch === "#") break; // inline comment
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let val = "";
      while (j < n && input[j] !== quote) {
        if (input[j] === "\\" && j + 1 < n) {
          val += input[j + 1];
          j += 2;
        } else {
          val += input[j];
          j++;
        }
      }
      tokens.push({ kind: "string", value: val });
      i = j + 1;
      continue;
    }
    if (ch === "/") {
      // /regex/flags
      let j = i + 1;
      let src = "";
      while (j < n && input[j] !== "/") {
        if (input[j] === "\\" && j + 1 < n) {
          src += input[j] + input[j + 1];
          j += 2;
        } else {
          src += input[j];
          j++;
        }
      }
      j++; // closing slash
      let flags = "";
      while (j < n && /[a-z]/i.test(input[j])) {
        flags += input[j];
        j++;
      }
      tokens.push({ kind: "regex", source: src, flags });
      i = j;
      continue;
    }
    if (ch === "[") {
      const end = input.indexOf("]", i);
      const inner = input.slice(i + 1, end < 0 ? n : end);
      const items = inner
        .split(",")
        .map((s) => s.trim())
        .map((s) => s.replace(/^["']|["']$/g, ""))
        .filter(Boolean);
      tokens.push({ kind: "list", items });
      i = end < 0 ? n : end + 1;
      continue;
    }
    // bare word (until whitespace)
    let j = i;
    let word = "";
    while (j < n && input[j] !== " " && input[j] !== "\t") {
      word += input[j];
      j++;
    }
    tokens.push({ kind: "word", value: word });
    i = j;
  }
  return tokens;
}

function parseFrontMatter(lines: string[]): { config: ScriptConfig; rest: string[] } {
  const config: ScriptConfig = {
    name: "walkthrough",
    viewport: { width: 1440, height: 900 },
    closeIgnore: [],
  };
  if (lines[0]?.trim() !== "---") return { config, rest: lines };
  let i = 1;
  const fm: Record<string, string> = {};
  for (; i < lines.length; i++) {
    if (lines[i].trim() === "---") {
      i++;
      break;
    }
    const m = lines[i].match(/^([a-zA-Z_]+)\s*:\s*(.*)$/);
    if (m) fm[m[1].trim()] = m[2].trim();
  }
  if (fm.name) config.name = fm.name.replace(/^["']|["']$/g, "");
  if (fm.url) config.url = fm.url.replace(/^["']|["']$/g, "");
  if (fm.viewport) {
    const vm = fm.viewport.match(/(\d+)\s*[x×]\s*(\d+)/);
    if (vm) config.viewport = { width: Number(vm[1]), height: Number(vm[2]) };
  }
  if (fm.target_seconds) config.targetSeconds = Number(fm.target_seconds);
  if (fm.storage_state) config.storageState = fm.storage_state.replace(/^["']|["']$/g, "");
  if (fm.output) config.output = fm.output.replace(/^["']|["']$/g, "");
  if (fm.close_ignore) {
    const raw = fm.close_ignore.trim();
    if (raw.startsWith("[")) {
      config.closeIgnore = raw
        .slice(1, raw.indexOf("]") < 0 ? undefined : raw.indexOf("]"))
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (raw) {
      config.closeIgnore = [raw.replace(/^["']|["']$/g, "")];
    }
  }
  return { config, rest: lines.slice(i) };
}

export function parseScript(text: string): ParsedScript {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const { config, rest } = parseFrontMatter(lines);

  const sections: Section[] = [];
  let current: Section | null = null;
  let lineNo = lines.length - rest.length;

  for (const line of rest) {
    lineNo++;
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("<!--")) continue;
    const sectionMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (sectionMatch) {
      current = { title: sectionMatch[1].trim(), steps: [] };
      sections.push(current);
      continue;
    }
    const stepMatch = trimmed.match(/^[-*]\s+(.*)$/);
    if (stepMatch) {
      if (!current) {
        current = { title: "Walkthrough", steps: [] };
        sections.push(current);
      }
      const body = stepMatch[1];
      const tokens = tokenize(body);
      if (!tokens.length) continue;
      const first = tokens[0];
      const verb = first.kind === "word" ? first.value : String((first as { value?: string }).value ?? "");
      current.steps.push({
        verb,
        tokens: tokens.slice(1),
        raw: body,
        line: lineNo,
        section: current.title,
      });
    }
    // Non-list, non-header prose lines are treated as comments/notes and ignored.
  }

  return { config, sections };
}
