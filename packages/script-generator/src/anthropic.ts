/**
 * AnthropicProvider — real script generation via the Anthropic API
 * (@anthropic-ai/sdk). Server-side only; the key never reaches the browser.
 * The client is injectable so the pipeline is unit-testable without a key.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, GenerateScriptInput, GenerateScriptResult } from "./provider";
import { WALKTHROUGH_SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

/** The subset of the SDK we depend on — lets tests inject a stub. */
export interface MinimalAnthropic {
  messages: {
    create(args: unknown): Promise<{
      content: Array<{ type: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      stop_reason?: string;
    }>;
  };
}

export interface AnthropicProviderOptions {
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  client?: MinimalAnthropic;
}

export class AnthropicProvider implements AIProvider {
  readonly name = "anthropic";
  private client: MinimalAnthropic;
  private model: string;
  private maxTokens: number;

  constructor(opts: AnthropicProviderOptions = {}) {
    this.client = opts.client ?? (new Anthropic({ apiKey: opts.apiKey }) as unknown as MinimalAnthropic);
    this.model = opts.model ?? process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
    this.maxTokens = opts.maxTokens ?? Number(process.env.ANTHROPIC_MAX_TOKENS ?? 8000);
  }

  async generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult> {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: this.maxTokens,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      system: WALKTHROUGH_SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input) }],
    });
    if (res.stop_reason === "refusal") {
      throw new Error("The model declined to generate a script for this request.");
    }
    const text = res.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();
    return {
      script: extractScript(text),
      tokensIn: res.usage?.input_tokens,
      tokensOut: res.usage?.output_tokens,
    };
  }
}

/** Strip any accidental prose/code-fences and return just the script.md body. */
export function extractScript(text: string): string {
  let s = text.trim();
  const fence = s.match(/```(?:markdown|md|yaml)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1].trim();
  const idx = s.indexOf("---");
  if (idx > 0) s = s.slice(idx);
  return s.trim() + "\n";
}
