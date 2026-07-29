import { describe, it, expect } from "vitest";
import { VIEWPORTS } from "@ptw/job-contracts";
import {
  FakeAIProvider,
  generateValidatedScript,
  ScriptGenerationError,
  type AIProvider,
  type GenerateScriptInput,
  type ValidateOptions,
} from "../index";

const URL = "https://acme.figma.site/";
const OPTS: ValidateOptions = {
  expectedUrl: URL,
  allowedViewports: Object.values(VIEWPORTS).map((v) => ({ width: v.width, height: v.height })),
  maxBytes: 20_000,
  maxSteps: 120,
};

const INPUT: GenerateScriptInput = {
  url: URL,
  instructions: "Start on the home page, sign in, search for Fusion, open a tab, then return.",
  viewport: { width: 1440, height: 900 },
  outputBaseName: "demo-walkthrough",
  targetSeconds: 60,
  inspection: {
    finalUrl: URL,
    title: "Acme",
    elements: {
      buttons: ["Sign In", "Products"],
      links: [],
      textboxes: ["Search"],
      tabs: ["Overview"],
      headings: ["Welcome"],
    },
    requiresAuthGuess: false,
  },
};

const goodScript = `---
name: Demo
url: ${URL}
viewport: 1440x900
output: demo-walkthrough
---

## 1. Start
- waitFor text "Welcome"
- pause 2s

## 2. End
- hold 3s
`;

describe("generateValidatedScript", () => {
  it("produces a valid script from the fake provider in one attempt", async () => {
    const r = await generateValidatedScript(new FakeAIProvider(), INPUT, OPTS);
    expect(r.attempts).toBe(1);
    expect(r.meta.url).toBe(URL);
    expect(r.script).toMatch(/click "Sign In"/);
  });

  it("repairs invalid output within the attempt budget", async () => {
    let calls = 0;
    const flaky: AIProvider = {
      name: "flaky",
      async generateScript() {
        calls++;
        // invalid on the first two calls, valid on the third
        return { script: calls < 3 ? "not a script" : goodScript };
      },
    };
    const r = await generateValidatedScript(flaky, INPUT, OPTS, 2);
    expect(calls).toBe(3);
    expect(r.attempts).toBe(3);
    expect(r.meta.url).toBe(URL);
  });

  it("fails gracefully when the model never produces a valid script", async () => {
    const bad: AIProvider = {
      name: "bad",
      async generateScript() {
        return { script: "still not valid" };
      },
    };
    await expect(generateValidatedScript(bad, INPUT, OPTS, 2)).rejects.toBeInstanceOf(ScriptGenerationError);
  });

  it("passes validation errors back to the provider on repair", async () => {
    const seen: (string[] | undefined)[] = [];
    let calls = 0;
    const spy: AIProvider = {
      name: "spy",
      async generateScript(input) {
        seen.push(input.validationErrors);
        calls++;
        return { script: calls < 2 ? "nope" : goodScript };
      },
    };
    await generateValidatedScript(spy, INPUT, OPTS, 2);
    expect(seen[0]).toBeUndefined();
    expect(seen[1]?.length).toBeGreaterThan(0);
  });
});
