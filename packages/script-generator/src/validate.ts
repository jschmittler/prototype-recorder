/**
 * Deterministic, security-critical validation of a generated walkthrough
 * script BEFORE it is ever executed. Model output is never trusted: we parse
 * the front-matter, enforce a strict schema, parse every step against the DSL
 * grammar, and reject navigation, unknown verbs, shell/script-ish content,
 * path traversal, off-target URLs, and oversized scripts.
 */
import { z } from "zod";
import { ALLOWED_VERBS, REJECTED_VERBS, FRONT_MATTER_KEYS, splitScript, stepLines, tokenize } from "./dsl";

export interface ValidateOptions {
  /** The URL the user submitted; the script's url must match this. */
  expectedUrl: string;
  /** Allowed recording viewports (width×height). */
  allowedViewports: { width: number; height: number }[];
  maxBytes: number;
  maxSteps: number;
}

export interface ScriptMeta {
  name?: string;
  url: string;
  viewport: { width: number; height: number };
  targetSeconds?: number;
  output?: string;
  closeIgnore: string[];
  stepCount: number;
}

export type ValidationResult = { ok: true; meta: ScriptMeta } | { ok: false; errors: string[] };

const DANGEROUS = [
  { re: /`/, msg: "backticks are not allowed" },
  { re: /\$\(/, msg: "command substitution `$(` is not allowed" },
  { re: /\$\{/, msg: "template/shell expansion `${` is not allowed" },
  { re: /&&|\|\|/, msg: "shell operators `&&`/`||` are not allowed" },
  { re: /<script/i, msg: "`<script` is not allowed" },
  { re: /javascript:/i, msg: "`javascript:` URLs are not allowed" },
  { re: /\bdata:/i, msg: "`data:` URLs are not allowed" },
  { re: /\bfile:/i, msg: "`file:` references are not allowed" },
  { re: /\.\.\//, msg: "path traversal `../` is not allowed" },
];

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u.trim());
    url.hash = "";
    let s = url.toString();
    s = s.replace(/\/$/, "");
    return s.toLowerCase();
  } catch {
    return u.trim().toLowerCase().replace(/\/$/, "");
  }
}

function parseCloseIgnore(raw: string | undefined): string[] {
  if (!raw) return [];
  const t = raw.trim();
  if (t.startsWith("[")) {
    const end = t.indexOf("]");
    return t
      .slice(1, end < 0 ? undefined : end)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  return [t.replace(/^["']|["']$/g, "")];
}

/** Minimal per-verb arity so obviously-malformed output is caught + repaired. */
function checkArity(verb: string, raw: string): string | null {
  const args = tokenize(raw).slice(1);
  const needsTarget = new Set([
    "click",
    "selectTab",
    "clickIfPresent",
    "waitFor",
    "waitForHidden",
    "scrollTo",
    "fill",
  ]);
  if (needsTarget.has(verb) && args.length === 0) return `"${verb}" needs a target`;
  if (verb === "type" && !args.some((a) => a.kind === "string")) return `"type" needs a "text" argument`;
  if (verb === "fill" && !args.some((a) => a.kind === "string")) return `"fill" needs a "text" argument`;
  if (verb === "clickEach" && !args.some((a) => a.kind === "list")) return `"clickEach" needs a [list]`;
  if (verb === "clickInRow" && args.filter((a) => a.kind === "string").length < 2)
    return `"clickInRow" needs "<row>" "<control>"`;
  return null;
}

export function validateScript(script: string, opts: ValidateOptions): ValidationResult {
  const errors: string[] = [];

  const bytes = Buffer.byteLength(script, "utf8");
  if (bytes > opts.maxBytes) errors.push(`Script is too large (${bytes} > ${opts.maxBytes} bytes).`);

  for (const d of DANGEROUS) if (d.re.test(script)) errors.push(`Disallowed content: ${d.msg}.`);

  const { frontMatterRaw, hadFrontMatter, bodyLines } = splitScript(script);
  if (!hadFrontMatter) errors.push("Missing front-matter (--- … ---).");

  for (const key of Object.keys(frontMatterRaw)) {
    if (!FRONT_MATTER_KEYS.has(key)) errors.push(`Unknown front-matter key: "${key}".`);
  }
  if ("storage_state" in frontMatterRaw) {
    errors.push("`storage_state` is not allowed in generated scripts.");
  }

  // Front-matter schema.
  const fmSchema = z.object({
    name: z.string().max(120).optional(),
    url: z.string().url(),
    viewport: z.string().regex(/^\d+\s*[x×]\s*\d+$/, "viewport must look like 1440x900"),
    target_seconds: z
      .string()
      .regex(/^\d+$/)
      .optional(),
    output: z
      .string()
      .regex(/^[a-zA-Z0-9 _.\-]*$/, "output has invalid characters")
      .optional(),
  });
  const fm = fmSchema.safeParse({
    name: frontMatterRaw.name?.replace(/^["']|["']$/g, ""),
    url: frontMatterRaw.url?.replace(/^["']|["']$/g, ""),
    viewport: frontMatterRaw.viewport,
    target_seconds: frontMatterRaw.target_seconds,
    output: frontMatterRaw.output?.replace(/^["']|["']$/g, ""),
  });

  let meta: ScriptMeta | null = null;
  if (!fm.success) {
    for (const issue of fm.error.issues) errors.push(`Front-matter ${issue.path.join(".")}: ${issue.message}`);
  } else {
    const vm = fm.data.viewport.match(/(\d+)\s*[x×]\s*(\d+)/)!;
    const viewport = { width: Number(vm[1]), height: Number(vm[2]) };
    const vpOk = opts.allowedViewports.some((v) => v.width === viewport.width && v.height === viewport.height);
    if (!vpOk) errors.push(`Viewport ${viewport.width}x${viewport.height} is not allowed.`);

    if (normalizeUrl(fm.data.url) !== normalizeUrl(opts.expectedUrl)) {
      errors.push(`Script url must match the submitted URL (${opts.expectedUrl}).`);
    }
    const output = fm.data.output?.trim();
    if (output && (output.includes("..") || output.includes("/") || output.includes("\\"))) {
      errors.push("`output` must be a plain file name.");
    }
    meta = {
      name: fm.data.name,
      url: fm.data.url,
      viewport,
      targetSeconds: fm.data.target_seconds ? Number(fm.data.target_seconds) : undefined,
      output,
      closeIgnore: parseCloseIgnore(frontMatterRaw.close_ignore),
      stepCount: 0,
    };
  }

  // Steps.
  const steps = stepLines(bodyLines);
  if (steps.length === 0) errors.push("Script has no steps.");
  if (steps.length > opts.maxSteps) errors.push(`Too many steps (${steps.length} > ${opts.maxSteps}).`);
  for (const s of steps) {
    if (REJECTED_VERBS.has(s.verb)) {
      errors.push(`Line ${s.line}: "${s.verb}" is not allowed.`);
      continue;
    }
    if (!ALLOWED_VERBS.has(s.verb)) {
      errors.push(`Line ${s.line}: unknown step "${s.verb}".`);
      continue;
    }
    const arityErr = checkArity(s.verb, s.raw);
    if (arityErr) errors.push(`Line ${s.line}: ${arityErr}.`);
  }
  if (meta) meta.stepCount = steps.length;

  if (errors.length || !meta) return { ok: false, errors: errors.length ? errors : ["Invalid script."] };
  return { ok: true, meta };
}
