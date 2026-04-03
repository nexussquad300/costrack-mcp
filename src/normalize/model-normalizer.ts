const MODEL_ALIASES: Record<string, string> = {
  // ANTHROPIC
  "claude-opus-4": "anthropic/claude-opus-4",
  "claude-4-opus": "anthropic/claude-opus-4",
  "opus-4": "anthropic/claude-opus-4",
  "opus": "anthropic/claude-opus-4",
  "claude-opus-4-6": "anthropic/claude-opus-4-6",

  "claude-sonnet-4": "anthropic/claude-sonnet-4",
  "claude-4-sonnet": "anthropic/claude-sonnet-4",
  "sonnet-4": "anthropic/claude-sonnet-4",
  "sonnet": "anthropic/claude-sonnet-4",
  "claude-sonnet-4-6": "anthropic/claude-sonnet-4-6",

  "claude-haiku-4": "anthropic/claude-haiku-4",
  "claude-4-haiku": "anthropic/claude-haiku-4",
  "haiku-4": "anthropic/claude-haiku-4",
  "haiku": "anthropic/claude-haiku-4",

  // OPENAI
  "gpt-4o": "openai/gpt-4o",
  "gpt4o": "openai/gpt-4o",
  "4o": "openai/gpt-4o",

  "gpt-4o-mini": "openai/gpt-4o-mini",
  "gpt4o-mini": "openai/gpt-4o-mini",
  "4o-mini": "openai/gpt-4o-mini",

  "gpt-4-turbo": "openai/gpt-4-turbo",
  "gpt4-turbo": "openai/gpt-4-turbo",
  "turbo": "openai/gpt-4-turbo",

  "o1": "openai/o1",
  "o1-mini": "openai/o1-mini",

  // GOOGLE
  "gemini-2.5-pro": "google/gemini-2.5-pro",
  "gemini-pro": "google/gemini-2.5-pro",
  "gemini-2.5": "google/gemini-2.5-pro",

  "gemini-2.5-flash": "google/gemini-2.5-flash",
  "gemini-flash": "google/gemini-2.5-flash",

  "gemini-2.0-flash": "google/gemini-2.0-flash",

  // META
  "llama-4-scout": "meta/llama-4-scout",
  "llama-scout": "meta/llama-4-scout",
  "scout": "meta/llama-4-scout",

  "llama-4-maverick": "meta/llama-4-maverick",
  "llama-maverick": "meta/llama-4-maverick",
  "maverick": "meta/llama-4-maverick",

  // DEEPSEEK
  "deepseek-v3": "deepseek/deepseek-v3",
  "deepseek-r1": "deepseek/deepseek-r1",
};

export function normalizeModel(input: string): string | null {
  const normalized = input.toLowerCase().trim();

  // Already in canonical format (contains "/")
  if (normalized.includes("/")) {
    return normalized;
  }

  // Lookup in alias map
  return MODEL_ALIASES[normalized] ?? null;
}
