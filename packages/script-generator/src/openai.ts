/**
 * OpenAIProvider — real script generation via the OpenAI Responses API.
 * Server-side only; the key never reaches the browser. The small injectable
 * client surface keeps the pipeline unit-testable without a live API key.
 */
import OpenAI from "openai";
import type { AIProvider, GenerateScriptInput, GenerateScriptResult } from "./provider";
import { WALKTHROUGH_SYSTEM_PROMPT, buildUserPrompt } from "./prompt";

export interface MinimalOpenAI {
  responses: {
    create(args: unknown): Promise<{
      output_text?: string;
      output?: Array<{
        type?: string;
        content?: Array<{ type?: string; text?: string; refusal?: string }>;
      }>;
      usage?: { input_tokens?: number; output_tokens?: number };
      status?: string;
      incomplete_details?: { reason?: string } | null;
    }>;
  };
}

export interface OpenAIProviderOptions {
  apiKey?: string;
  model?: string;
  maxOutputTokens?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high" | "xhigh" | "max";
  client?: MinimalOpenAI;
}

export class OpenAIProvider implements AIProvider {
  readonly name = "openai";
  private client: MinimalOpenAI;
  private model: string;
  private maxOutputTokens: number;
  private reasoningEffort: NonNullable<OpenAIProviderOptions["reasoningEffort"]>;

  constructor(opts: OpenAIProviderOptions = {}) {
    this.client = opts.client ?? (new OpenAI({ apiKey: opts.apiKey }) as unknown as MinimalOpenAI);
    this.model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-5.6-sol";
    this.maxOutputTokens =
      opts.maxOutputTokens ?? Number(process.env.OPENAI_MAX_OUTPUT_TOKENS ?? 8000);
    this.reasoningEffort =
      opts.reasoningEffort ??
      (process.env.OPENAI_REASONING_EFFORT as OpenAIProviderOptions["reasoningEffort"]) ??
      "medium";
  }

  async generateScript(input: GenerateScriptInput): Promise<GenerateScriptResult> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: WALKTHROUGH_SYSTEM_PROMPT,
      input: buildUserPrompt(input),
      max_output_tokens: this.maxOutputTokens,
      reasoning: { effort: this.reasoningEffort },
    });

    if (response.status === "incomplete") {
      const reason = response.incomplete_details?.reason ?? "unknown reason";
      throw new Error(`OpenAI response was incomplete: ${reason}.`);
    }

    const refusal = response.output
      ?.flatMap((item) => item.content ?? [])
      .find((content) => content.type === "refusal")?.refusal;
    if (refusal) {
      throw new Error("The model declined to generate a script for this request.");
    }

    const text = (response.output_text ?? "").trim();
    if (!text) throw new Error("OpenAI returned an empty script response.");

    return {
      script: extractScript(text),
      tokensIn: response.usage?.input_tokens,
      tokensOut: response.usage?.output_tokens,
    };
  }
}

/** Strip any accidental prose/code-fences and return just the script.md body. */
export function extractScript(text: string): string {
  let script = text.trim();
  const fence = script.match(/```(?:markdown|md|yaml)?\s*([\s\S]*?)```/);
  if (fence) script = fence[1].trim();
  const frontMatter = script.indexOf("---");
  if (frontMatter > 0) script = script.slice(frontMatter);
  return script.trim() + "\n";
}
