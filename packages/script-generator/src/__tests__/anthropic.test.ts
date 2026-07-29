import { describe, it, expect } from "vitest";
import { VIEWPORTS } from "@ptw/job-contracts";
import { AnthropicProvider, extractScript, type MinimalAnthropic } from "../anthropic";
import { buildUserPrompt } from "../prompt";
import { generateValidatedScript, type GenerateScriptInput, type ValidateOptions } from "../index";

const URL = "https://acme.figma.site/";
const OPTS: ValidateOptions = {
  expectedUrl: URL,
  allowedViewports: Object.values(VIEWPORTS).map((v) => ({ width: v.width, height: v.height })),
  maxBytes: 20_000,
  maxSteps: 120,
};
const INPUT: GenerateScriptInput = {
  url: URL,
  instructions: "Sign in and look around.",
  viewport: { width: 1440, height: 900 },
  outputBaseName: "acme-demo",
  inspection: {
    finalUrl: URL,
    title: "Acme",
    elements: { buttons: ["Sign In"], links: [], textboxes: [], tabs: [], headings: ["Welcome"] },
    requiresAuthGuess: false,
  },
};

const GOOD = `---
name: Acme
url: ${URL}
viewport: 1440x900
output: acme-demo
---

## 1. Start
- waitFor text "Welcome"
- click "Sign In" 1s

## 2. End
- hold 3s
`;

function stub(text: string, stopReason = "end_turn"): MinimalAnthropic {
  return {
    messages: {
      async create() {
        return {
          content: [
            { type: "thinking", text: "" },
            { type: "text", text },
          ],
          usage: { input_tokens: 11, output_tokens: 22 },
          stop_reason: stopReason,
        };
      },
    },
  };
}

describe("extractScript", () => {
  it("strips code fences", () => {
    expect(extractScript("```markdown\n" + GOOD + "```")).toContain("name: Acme");
    expect(extractScript("```markdown\n" + GOOD + "```").startsWith("---")).toBe(true);
  });
  it("drops leading prose before the front-matter", () => {
    expect(extractScript("Here is your script:\n\n" + GOOD).startsWith("---")).toBe(true);
  });
});

describe("AnthropicProvider", () => {
  it("returns a clean, valid script from a fenced model response", async () => {
    const provider = new AnthropicProvider({ client: stub("```markdown\n" + GOOD + "```") });
    const r = await provider.generateScript(INPUT);
    expect(r.script.startsWith("---")).toBe(true);
    expect(r.tokensIn).toBe(11);
    const gen = await generateValidatedScript(provider, INPUT, OPTS);
    expect(gen.meta.url).toBe(URL);
    expect(gen.attempts).toBe(1);
  });

  it("throws on a model refusal", async () => {
    const provider = new AnthropicProvider({ client: stub("", "refusal") });
    await expect(provider.generateScript(INPUT)).rejects.toThrow(/declined/i);
  });
});

describe("buildUserPrompt", () => {
  it("includes the required front-matter values and inspected controls", () => {
    const p = buildUserPrompt(INPUT);
    expect(p).toContain(`url: ${URL}`);
    expect(p).toContain("viewport: 1440x900");
    expect(p).toContain('"Sign In"');
  });
  it("includes validation errors on a repair attempt", () => {
    const p = buildUserPrompt({ ...INPUT, previousScript: "bad", validationErrors: ['unknown step "frobnicate"'] });
    expect(p).toContain("FAILED VALIDATION");
    expect(p).toContain("frobnicate");
  });
});
