import { describe, expect, it } from "vitest";
import { VIEWPORTS } from "@ptw/job-contracts";
import { OpenAIProvider, extractScript, type MinimalOpenAI } from "../openai";
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

function stub(text: string): MinimalOpenAI & { lastArgs?: Record<string, unknown> } {
  const client: MinimalOpenAI & { lastArgs?: Record<string, unknown> } = {
    responses: {
      async create(args: unknown) {
        client.lastArgs = args as Record<string, unknown>;
        return {
          output_text: text,
          status: "completed",
          usage: { input_tokens: 11, output_tokens: 22 },
        };
      },
    },
  };
  return client;
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

describe("OpenAIProvider", () => {
  it("returns a clean, valid script from a Responses API result", async () => {
    const provider = new OpenAIProvider({ client: stub("```markdown\n" + GOOD + "```") });
    const result = await provider.generateScript(INPUT);
    expect(result.script.startsWith("---")).toBe(true);
    expect(result.tokensIn).toBe(11);
    const generated = await generateValidatedScript(provider, INPUT, OPTS);
    expect(generated.meta.url).toBe(URL);
    expect(generated.attempts).toBe(1);
  });

  it("uses the Responses API with explicit model and reasoning settings", async () => {
    const client = stub(GOOD);
    await new OpenAIProvider({ client, model: "gpt-5.6-sol", reasoningEffort: "medium" }).generateScript(INPUT);
    expect(client.lastArgs).toMatchObject({
      model: "gpt-5.6-sol",
      reasoning: { effort: "medium" },
      max_output_tokens: 8000,
    });
    expect(client.lastArgs?.instructions).toBeTruthy();
    expect(client.lastArgs?.input).toContain("Sign in and look around.");
  });

  it("throws on a refusal", async () => {
    const client: MinimalOpenAI = {
      responses: {
        async create() {
          return {
            output: [{ type: "message", content: [{ type: "refusal", refusal: "No." }] }],
            status: "completed",
          };
        },
      },
    };
    await expect(new OpenAIProvider({ client }).generateScript(INPUT)).rejects.toThrow(/declined/i);
  });

  it("throws when output is incomplete", async () => {
    const client: MinimalOpenAI = {
      responses: {
        async create() {
          return {
            status: "incomplete",
            incomplete_details: { reason: "max_output_tokens" },
          };
        },
      },
    };
    await expect(new OpenAIProvider({ client }).generateScript(INPUT)).rejects.toThrow(/max_output_tokens/i);
  });

  it("throws on an empty response", async () => {
    await expect(new OpenAIProvider({ client: stub("") }).generateScript(INPUT)).rejects.toThrow(/empty/i);
  });
});

describe("buildUserPrompt", () => {
  it("includes required values and inspected controls", () => {
    const prompt = buildUserPrompt(INPUT);
    expect(prompt).toContain(`url: ${URL}`);
    expect(prompt).toContain("viewport: 1440x900");
    expect(prompt).toContain('"Sign In"');
  });

  it("includes validation errors on a repair attempt", () => {
    const prompt = buildUserPrompt({ ...INPUT, previousScript: "bad", validationErrors: ['unknown step "frobnicate"'] });
    expect(prompt).toContain("FAILED VALIDATION");
    expect(prompt).toContain("frobnicate");
  });

  it("asks for a targeted rewrite after a failed dry run", () => {
    const prompt = buildUserPrompt({
      ...INPUT,
      previousScript: GOOD,
      preflightFailures: [
        { step: 'click "See all products"', error: "No element found", suggestions: ["Products", "Home"] },
      ],
    });
    expect(prompt).toContain("COULD NOT BE FOUND");
    expect(prompt).toContain('click "See all products"');
    expect(prompt).toContain('"Products"');
  });
});
