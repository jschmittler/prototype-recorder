/**
 * AIProvider abstraction — lets the model implementation change (hosted
 * Anthropic key, future BYOK, or a deterministic fake) without touching job
 * logic. The real AnthropicProvider lands in Phase 3; the FakeAIProvider here
 * powers the vertical slice and tests and always emits a valid script.
 */

export interface InspectionSummary {
  finalUrl: string;
  title: string;
  elements: {
    buttons: string[];
    links: string[];
    textboxes: string[];
    tabs: string[];
    headings: string[];
  };
  requiresAuthGuess: boolean;
}

export interface GenerateScriptInput {
  url: string;
  instructions: string;
  viewport: { width: number; height: number };
  outputBaseName: string;
  targetSeconds?: number;
  closeIgnore?: string[];
  inspection?: InspectionSummary;
  /** Present on repair attempts. */
  previousScript?: string;
  validationErrors?: string[];
}

export interface GenerateScriptResult {
  script: string;
  tokensIn?: number;
  tokensOut?: number;
}

export interface AIProvider {
  readonly name: string;
  generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult>;
}

/** Build a valid, sensible script deterministically from the inputs. */
export function buildDeterministicScript(input: GenerateScriptInput): string {
  const title = firstLine(input.instructions) || input.inspection?.title || "Walkthrough";
  const has = (name: RegExp) => input.inspection?.elements.buttons.some((b) => name.test(b)) ?? false;
  const firstHeading = input.inspection?.elements.headings[0];

  const fm: string[] = ["---", `name: ${title.slice(0, 100)}`, `url: ${input.url}`, `viewport: ${input.viewport.width}x${input.viewport.height}`];
  if (input.targetSeconds) fm.push(`target_seconds: ${input.targetSeconds}`);
  if (input.closeIgnore && input.closeIgnore.length) fm.push(`close_ignore: [${input.closeIgnore.map((s) => `"${s}"`).join(", ")}]`);
  fm.push(`output: ${input.outputBaseName}`);
  fm.push("---", "");

  const steps: string[] = ["## 1. Start"];
  if (firstHeading) steps.push(`- waitFor text "${firstHeading.replace(/"/g, "")}"`);
  steps.push("- pause 2s");
  if (has(/sign\s*in|log\s*in/i)) {
    steps.push('- click "Sign In" 1s');
  }
  if (input.inspection?.elements.textboxes.some((t) => /search/i.test(t))) {
    steps.push("", "## 2. Search", '- fill placeholder "Search" "Fusion"', "- pause 2s", "- closeOverlay");
  }
  const tab = input.inspection?.elements.tabs[0];
  if (tab) {
    steps.push("", "## 3. Explore a tab", `- click "${tab.replace(/"/g, "")}" 1s`);
  }
  steps.push("", "## 4. Survey", "- scrollToBottom", "- pause 1s", "- scrollToTop");
  steps.push("", "## 5. End", "- hold 3s");

  return fm.join("\n") + steps.join("\n") + "\n";
}

function firstLine(s: string): string {
  return (s.split(/[.\n]/)[0] || "").trim();
}

/** Deterministic provider for local dev, the slice, and tests. */
export class FakeAIProvider implements AIProvider {
  readonly name = "fake";
  async generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult> {
    const script = buildDeterministicScript(input);
    return { script, tokensIn: 0, tokensOut: script.length };
  }
}

/**
 * Select the AI provider from the environment:
 *   AI_PROVIDER=anthropic  -> real Anthropic (requires ANTHROPIC_API_KEY)
 *   otherwise              -> FakeAIProvider (default; slice + tests)
 * AnthropicProvider is imported lazily so the SDK isn't loaded on the fake path.
 */
export async function getAIProvider(): Promise<AIProvider> {
  if ((process.env.AI_PROVIDER ?? "fake") === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not configured (required for AI_PROVIDER=anthropic).");
    }
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider();
  }
  return new FakeAIProvider();
}
