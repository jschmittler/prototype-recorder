import { describe, it, expect } from "vitest";
import { VIEWPORTS } from "@ptw/job-contracts";
import { validateScript, type ValidateOptions } from "../validate";

const URL = "https://acme.figma.site/";
const OPTS: ValidateOptions = {
  expectedUrl: URL,
  allowedViewports: Object.values(VIEWPORTS).map((v) => ({ width: v.width, height: v.height })),
  maxBytes: 20_000,
  maxSteps: 120,
};

const good = (over: Partial<{ url: string; viewport: string; output: string; extraStep: string }> = {}) => `---
name: Demo
url: ${over.url ?? URL}
viewport: ${over.viewport ?? "1440x900"}
target_seconds: 60
output: ${over.output ?? "demo-walkthrough"}
---

## 1. Start
- waitFor text "Welcome"
- pause 2s
- click "Sign In" 1s
${over.extraStep ? "- " + over.extraStep + "\n" : ""}
## 2. Survey
- scrollToBottom
- scrollToTop

## 3. End
- hold 3s
`;

describe("validateScript", () => {
  it("accepts a well-formed script", () => {
    const r = validateScript(good(), OPTS);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.meta.url).toBe(URL);
      expect(r.meta.viewport).toEqual({ width: 1440, height: 900 });
      expect(r.meta.output).toBe("demo-walkthrough");
      expect(r.meta.stepCount).toBeGreaterThanOrEqual(6);
    }
  });

  it("rejects unknown verbs", () => {
    const r = validateScript(good({ extraStep: 'frobnicate "x"' }), OPTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/unknown step "frobnicate"/);
  });

  it("rejects navigation (goto)", () => {
    const r = validateScript(good({ extraStep: 'goto "http://elsewhere"' }), OPTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/"goto" is not allowed/);
  });

  it("rejects a url that does not match the submitted URL", () => {
    const r = validateScript(good({ url: "https://evil.example.com/" }), OPTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/must match the submitted URL/);
  });

  it("rejects disallowed viewports", () => {
    const r = validateScript(good({ viewport: "999x999" }), OPTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/not allowed/);
  });

  it("rejects shell/script-ish content", () => {
    const r = validateScript(good({ extraStep: 'log "$(whoami)"' }), OPTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/command substitution/);
  });

  it("rejects path traversal in output name", () => {
    const r = validateScript(good({ output: "../evil" }), OPTS);
    expect(r.ok).toBe(false);
  });

  it("enforces a maximum size", () => {
    const r = validateScript(good(), { ...OPTS, maxBytes: 50 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/too large/);
  });

  it("requires at least one step", () => {
    const empty = `---\nname: x\nurl: ${URL}\nviewport: 1440x900\noutput: x\n---\n\n## only a heading\n`;
    const r = validateScript(empty, OPTS);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.join(" ")).toMatch(/no steps/);
  });
});
