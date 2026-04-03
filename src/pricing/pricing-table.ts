export interface ModelPricing {
  model_canonical: string;
  provider: string;
  capability: string;
  input_price_per_mtok: number;
  output_price_per_mtok: number;
  context_window: number;
}

export const PRICING_TABLE: ModelPricing[] = [
  // ━━━ ANTHROPIC ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    model_canonical: "anthropic/claude-opus-4",
    provider: "anthropic",
    capability: "flagship",
    input_price_per_mtok: 15.0,
    output_price_per_mtok: 75.0,
    context_window: 200000,
  },
  {
    model_canonical: "anthropic/claude-opus-4-6",
    provider: "anthropic",
    capability: "flagship",
    input_price_per_mtok: 15.0,
    output_price_per_mtok: 75.0,
    context_window: 200000,
  },
  {
    model_canonical: "anthropic/claude-sonnet-4",
    provider: "anthropic",
    capability: "mid",
    input_price_per_mtok: 3.0,
    output_price_per_mtok: 15.0,
    context_window: 200000,
  },
  {
    model_canonical: "anthropic/claude-sonnet-4-6",
    provider: "anthropic",
    capability: "mid",
    input_price_per_mtok: 3.0,
    output_price_per_mtok: 15.0,
    context_window: 200000,
  },
  {
    model_canonical: "anthropic/claude-haiku-4",
    provider: "anthropic",
    capability: "fast",
    input_price_per_mtok: 0.8,
    output_price_per_mtok: 4.0,
    context_window: 200000,
  },

  // ━━━ OPENAI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    model_canonical: "openai/gpt-4o",
    provider: "openai",
    capability: "flagship",
    input_price_per_mtok: 2.5,
    output_price_per_mtok: 10.0,
    context_window: 128000,
  },
  {
    model_canonical: "openai/gpt-4o-mini",
    provider: "openai",
    capability: "fast",
    input_price_per_mtok: 0.15,
    output_price_per_mtok: 0.6,
    context_window: 128000,
  },
  {
    model_canonical: "openai/gpt-4-turbo",
    provider: "openai",
    capability: "mid",
    input_price_per_mtok: 10.0,
    output_price_per_mtok: 30.0,
    context_window: 128000,
  },
  {
    model_canonical: "openai/o1",
    provider: "openai",
    capability: "flagship",
    input_price_per_mtok: 15.0,
    output_price_per_mtok: 60.0,
    context_window: 200000,
  },
  {
    model_canonical: "openai/o1-mini",
    provider: "openai",
    capability: "mid",
    input_price_per_mtok: 3.0,
    output_price_per_mtok: 12.0,
    context_window: 128000,
  },

  // ━━━ GOOGLE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    model_canonical: "google/gemini-2.5-pro",
    provider: "google",
    capability: "flagship",
    input_price_per_mtok: 1.25,
    output_price_per_mtok: 5.0,
    context_window: 2000000,
  },
  {
    model_canonical: "google/gemini-2.5-flash",
    provider: "google",
    capability: "fast",
    input_price_per_mtok: 0.075,
    output_price_per_mtok: 0.3,
    context_window: 1000000,
  },
  {
    model_canonical: "google/gemini-2.0-flash",
    provider: "google",
    capability: "fast",
    input_price_per_mtok: 0.1,
    output_price_per_mtok: 0.4,
    context_window: 1000000,
  },

  // ━━━ META ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    model_canonical: "meta/llama-4-scout",
    provider: "meta",
    capability: "fast",
    input_price_per_mtok: 0.2,
    output_price_per_mtok: 0.2,
    context_window: 128000,
  },
  {
    model_canonical: "meta/llama-4-maverick",
    provider: "meta",
    capability: "mid",
    input_price_per_mtok: 0.6,
    output_price_per_mtok: 0.6,
    context_window: 128000,
  },

  // ━━━ DEEPSEEK ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  {
    model_canonical: "deepseek/deepseek-v3",
    provider: "deepseek",
    capability: "mid",
    input_price_per_mtok: 0.27,
    output_price_per_mtok: 1.1,
    context_window: 64000,
  },
  {
    model_canonical: "deepseek/deepseek-r1",
    provider: "deepseek",
    capability: "flagship",
    input_price_per_mtok: 0.55,
    output_price_per_mtok: 2.19,
    context_window: 64000,
  },
];

export const PRICING_TABLE_VERSION = "2026-04-03";
export const PRICING_TABLE_LAST_UPDATED = "2026-04-03T00:00:00.000Z";

// Index for fast lookup by canonical model name
const PRICING_INDEX = new Map<string, ModelPricing>();
for (const entry of PRICING_TABLE) {
  PRICING_INDEX.set(entry.model_canonical, entry);
}

export function lookupPricing(modelCanonical: string): ModelPricing | null {
  return PRICING_INDEX.get(modelCanonical) ?? null;
}
