import { normalizeModel } from "../normalize/model-normalizer.js";
import { doGetCompareData } from "../storage/do-client.js";
import { ValidationError } from "../utils/validate.js";
import type { Env, CostCompareInput, CostCompareOutput } from "../types/index.js";

export async function costCompare(env: Env, args: CostCompareInput): Promise<CostCompareOutput> {
  // Validate inputs
  if (!Array.isArray(args.items) || args.items.length < 2)
    throw new ValidationError("items must be an array with at least 2 entries");
  if (args.items.length > 5)
    throw new ValidationError("items must have at most 5 entries");

  // Normalize model names if comparing models
  const items =
    args.compare_type === "models"
      ? args.items.map((i) => normalizeModel(i) ?? i)
      : args.items;

  const data = await doGetCompareData(env, args.compare_type, items);

  const comparisons = data.map((d) => ({
    id: d.id,
    total_cost_usd: d.total_cost_usd,
    total_events: d.total_events,
    avg_cost_per_event:
      d.total_events > 0
        ? Math.round((d.total_cost_usd / d.total_events) * 1e10) / 1e10
        : 0,
  }));

  // Find cheapest
  const withCost = comparisons.filter((c) => c.total_events > 0);
  const cheapest =
    withCost.length > 0
      ? withCost.reduce((a, b) => (a.total_cost_usd < b.total_cost_usd ? a : b)).id
      : comparisons[0]?.id ?? "none";

  // Build recommendation
  let recommendation: string;
  if (withCost.length < 2) {
    recommendation = "Insufficient data for comparison. Log more events to enable analysis.";
  } else {
    const sorted = [...withCost].sort((a, b) => a.total_cost_usd - b.total_cost_usd);
    const cheapestItem = sorted[0];
    const mostExpensive = sorted[sorted.length - 1];
    if (mostExpensive.total_cost_usd > 0) {
      const savingsPercent =
        ((mostExpensive.total_cost_usd - cheapestItem.total_cost_usd) /
          mostExpensive.total_cost_usd) *
        100;
      recommendation = `${cheapestItem.id} is ${savingsPercent.toFixed(1)}% cheaper than ${mostExpensive.id}.`;
    } else {
      recommendation = `${cheapestItem.id} is the cheapest option.`;
    }
  }

  return {
    compare_type: args.compare_type,
    comparisons,
    cheapest,
    recommendation,
  };
}
