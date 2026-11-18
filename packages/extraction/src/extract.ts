import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ammanToday } from "@oroud/shared";
import { buildUserText, PROMPT_VERSION, SYSTEM_PROMPT } from "./prompt.ts";
import { postProcess, type ProcessedExtraction } from "./postprocess.ts";
import { ExtractionOutputSchema, type ExtractionInput } from "./schema.ts";

export const EXTRACTION_MODEL = "claude-opus-5-5";
const MAX_IMAGES = 4;

export interface ExtractionRecord {
  model: string;
  promptVersion: string;
  output: ProcessedExtraction;
  usage: { inputTokens: number; outputTokens: number };
}

export class ExtractionError extends Error {}

/**
 * Turn one source (text and optional images) into a validated offer (spec section 6).
 * Retries once if the model's output fails validation (FR-AI-01).
 */
export async function extractOffer(
  input: ExtractionInput,
  client: Anthropic = new Anthropic(),
): Promise<ExtractionRecord> {
  const images = (input.images ?? []).slice(0, MAX_IMAGES);
  const content: Anthropic.ContentBlockParam[] = [
    ...images.map(
      (img): Anthropic.ImageBlockParam => ({
        type: "image",
        source: { type: "base64", media_type: img.mediaType, data: img.base64 },
      }),
    ),
    { type: "text", text: buildUserText(input.text, ammanToday(input.now), input.shopBranches) },
  ];

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await client.messages.parse({
      model: EXTRACTION_MODEL,
      max_tokens: 4000,
      // Extraction is a routine task; low effort keeps the WhatsApp reply under 30 s (NFR-01).
      output_config: { effort: "low", format: zodOutputFormat(ExtractionOutputSchema) },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      throw new ExtractionError(`Model declined: ${response.stop_details?.category ?? "unknown"}`);
    }
    if (response.parsed_output) {
      return {
        model: response.model,
        promptVersion: PROMPT_VERSION,
        output: postProcess(response.parsed_output),
        usage: {
          inputTokens: response.usage.input_tokens,
          outputTokens: response.usage.output_tokens,
        },
      };
    }
    lastError = new ExtractionError(`Invalid output (stop_reason: ${response.stop_reason})`);
  }
  throw lastError;
}
