/**
 * Deterministic cost calculation.
 * Same inputs + same pricing = same output. No floating-point variance.
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  inputPricePerMtok: number,
  outputPricePerMtok: number
): { cost_usd: number; input_cost_usd: number; output_cost_usd: number } {
  const inputCost = (inputTokens / 1_000_000) * inputPricePerMtok;
  const outputCost = (outputTokens / 1_000_000) * outputPricePerMtok;
  return {
    input_cost_usd: round10(inputCost),
    output_cost_usd: round10(outputCost),
    cost_usd: round10(inputCost + outputCost),
  };
}

function round10(n: number): number {
  return Math.round(n * 1e10) / 1e10;
}
