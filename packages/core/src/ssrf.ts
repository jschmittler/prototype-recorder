/**
 * SSRF guard: scheme + credential + private/loopback/link-local/metadata host
 * rejection. Applied to the submitted URL (the engine re-checks redirects).
 */
export interface UrlCheck {
  ok: boolean;
  reason?: string;
}

const PRIVATE_HOST_PATTERNS: RegExp[] = [
  /^localhost$/i,
  /^127\./,
  /^0\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^169\.254\./, // link-local incl. cloud metadata 169.254.169.254
  /^::1$/,
  /^fe80:/i,
  /^fc00:/i,
  /\.local$/i,
  /^metadata\./i,
];

export function checkUrl(raw: string, allowlist: string[] = []): UrlCheck {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "Not a valid URL." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:")
    return { ok: false, reason: "Only http and https URLs are allowed." };
  if (url.username || url.password)
    return { ok: false, reason: "URLs with embedded credentials are not allowed." };
  const host = url.hostname;
  if (allowlist.length && allowlist.includes(host)) return { ok: true };
  if (PRIVATE_HOST_PATTERNS.some((re) => re.test(host)))
    return { ok: false, reason: "That address points to a private or internal host." };
  return { ok: true };
}
