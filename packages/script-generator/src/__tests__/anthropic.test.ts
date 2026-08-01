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
    elements: { buttons: ["Sign In"], links: [], textboxes: [], tabs: [], headings: ["Welcome"], imgAlts: [] },
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

function stub(text: string, stopReason = "end_turn"): MinimalAnthropic & { lastArgs?: Record<string, unknown> } {
  const s: MinimalAnthropic & { lastArgs?: Record<string, unknown> } = {
    messages: {
      async create(args: unknown) {
        s.lastArgs = args as Record<string, unknown>;
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
  return s;
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

  it("pins temperature and omits thinking so the same brief yields the same script", async () => {
    AnthropicProvider.temperatureSupported = true;
    const client = stub(GOOD);
    await new AnthropicProvider({ client }).generateScript(INPUT);
    expect(client.lastArgs?.temperature).toBe(0);
    expect(client.lastArgs?.thinking).toBeUndefined();
  });

  it("swaps temperature for thinking when explicitly opted in", async () => {
    AnthropicProvider.temperatureSupported = true;
    const client = stub(GOOD);
    await new AnthropicProvider({ client, thinking: true }).generateScript(INPUT);
    expect(client.lastArgs?.thinking).toEqual({ type: "adaptive" });
    expect(client.lastArgs?.temperature).toBeUndefined();
  });

  it("retries without temperature when the model has deprecated it", async () => {
    AnthropicProvider.temperatureSupported = true;
    let calls = 0;
    const client: MinimalAnthropic = {
      messages: {
        async create(args: unknown) {
          calls++;
          if ((args as { temperature?: number }).temperature !== undefined) {
            throw new Error("400 `temperature` is deprecated for this model.");
          }
          return { content: [{ type: "text", text: GOOD }], stop_reason: "end_turn" };
        },
      },
    };
    const r = await new AnthropicProvider({ client }).generateScript(INPUT);
    expect(r.script.startsWith("---")).toBe(true);
    expect(calls).toBe(2);
    // The rejection is remembered, so later calls skip the doomed attempt.
    expect(AnthropicProvider.temperatureSupported).toBe(false);
  });

  it("does not swallow unrelated API errors", async () => {
    AnthropicProvider.temperatureSupported = true;
    const client: MinimalAnthropic = {
      messages: {
        async create() {
          throw new Error("529 overloaded_error");
        },
      },
    };
    await expect(new AnthropicProvider({ client }).generateScript(INPUT)).rejects.toThrow(/overloaded/);
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

  it("lists the controls found on each explored screen", () => {
    const p = buildUserPrompt({
      ...INPUT,
      inspection: {
        ...INPUT.inspection!,
        screens: [
          {
            label: "Products",
            buttons: ["Manage"],
            links: [],
            textboxes: [],
            tabs: ["Usage"],
            headings: ["All products"],
            imgAlts: [],
          },
        ],
      },
    });
    expect(p).toContain("SCREENS REACHED FROM THE LANDING PAGE");
    expect(p).toContain('after clicking "Products"');
    expect(p).toContain('"Manage"');
    expect(p).toContain('"All products"');
  });

  it("asks for a targeted rewrite when a dry run failed", () => {
    const p = buildUserPrompt({
      ...INPUT,
      previousScript: GOOD,
      preflightFailures: [
        { step: 'click "See all products"', error: "No element found", suggestions: ["Products", "Home"] },
      ],
    });
    expect(p).toContain("COULD NOT BE FOUND");
    expect(p).toContain('click "See all products"');
    expect(p).toContain('"Products"');
    expect(p).toContain("keep every step that is not listed here");
  });
});
