/**
 * Tokenizer utilities – real token counting per model using the `js-tiktoken` library.
 * The library supports OpenAI, Anthropic and other GPT‑style models.
 */

import { encoding_for_model } from "npm:js-tiktoken@1.0.5";

/** Cache of encodings per model name */
const encoderCache = new Map<string, ReturnType<typeof encoding_for_model>>();

/** Get or create an encoder for a given model */
function getEncoder(modelName: string) {
  if (!encoderCache.has(modelName)) {
    try {
      encoderCache.set(modelName, encoding_for_model(modelName));
    } catch (e) {
      // Fallback to a simple whitespace encoder if the model is unknown.
      encoderCache.set(modelName, encoding_for_model("gpt2")); // gpt2 is a generic fallback
    }
  }
  return encoderCache.get(modelName)!;
}

/** Count tokens for a string using the model‑specific encoder */
export function countTokensForModel(text: string, modelName: string): number {
  const enc = getEncoder(modelName);
  const tokens = enc.encode(text);
  return tokens.length;
}
