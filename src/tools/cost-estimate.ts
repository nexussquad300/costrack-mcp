import { normalizeModel } from "../normalize/model-normalizer.js";
import { PRICING_TABLE, lookupPricing } from "../pricing/pricing-table.js";
import { calculateCost } from "../utils/cost-calculator.js";
import type { CostEstimateInput, CostEstimateOutput } from "../types/index.js";

export async function costEstimate(args: CostEstimateInput): Promise<CostEstimateOutput> {
  const modelCanonical = normalizeModel(args.model) ?? args.model;
  const pricing = lookupPricing(modelCanonical);
  const numCalls = args.num_calls ?? 1;

  // Calculate cost for the requested model
  let costPerCall = 0;
  let totalCost = 0;

  if (pricing) {
    const calc = calculateCost(
      args.estimated_input_tokens,
      args.estimated_output_tokens,
      pricing.input_price_per_mtok,
      pricing.output_price_per_mtok
    );
    costPerCall = calc.cost_usd;
    totalCost = costPerCall * numCalls;
  }

  // Find alternatives
  const alternatives: CostEstimateOutput["alternatives"] = [];
  const requestedProvider = pricing?.provider;
  const requestedCapability = pricing?.capability;

  if (pricing) {
    // Calculate cost for all models in the same capability tier
    const sameTier = PRICING_TABLE.filter(
      (m) => m.capability === requestedCapability && m.model_canonical !== modelCanonical
    );

    // Cheapest overall in same tier
    let cheapestModel: { model: string; cost: number } | null = null;
    for (const m of sameTier) {
      const c = calculateCost(
        args.estimated_input_tokens,
        args.estimated_output_tokens,
        m.input_price_per_mtok,
        m.output_price_per_mtok
      );
      if (!cheapestModel || c.cost_usd < cheapestModel.cost) {
        cheapestModel = { model: m.model_canonical, cost: c.cost_usd };
      }
    }

    if (cheapestModel && cheapestModel.cost < costPerCall) {
      const savings = costPerCall - cheapestModel.cost;
      alternatives.push({
        category: "cheapest",
        model: cheapestModel.model,
        estimated_total_cost_usd:
          Math.round(cheapestModel.cost * numCalls * 1e10) / 1e10,
        savings_usd: Math.round(savings * numCalls * 1e10) / 1e10,
        savings_percent:
          costPerCall > 0
            ? Math.round((savings / costPerCall) * 1000) / 10
            : 0,
      });
    }

    // Best value: flagship > mid > fast for capability-to-cost ratio
    // Find a mid-tier model if requested is flagship, or fast if requested is mid
    const TIER_ORDER = ["flagship", "mid", "fast"];
    const requestedTierIdx = TIER_ORDER.indexOf(requestedCapability ?? "");
    if (requestedTierIdx < TIER_ORDER.length - 1) {
      const nextTier = TIER_ORDER[requestedTierIdx + 1];
      const nextTierModels = PRICING_TABLE.filter((m) => m.capability === nextTier);
      let bestValue: { model: string; cost: number } | null = null;
      for (const m of nextTierModels) {
        const c = calculateCost(
          args.estimated_input_tokens,
          args.estimated_output_tokens,
          m.input_price_per_mtok,
          m.output_price_per_mtok
        );
        if (!bestValue || c.cost_usd < bestValue.cost) {
          bestValue = { model: m.model_canonical, cost: c.cost_usd };
        }
      }
      if (bestValue && bestValue.cost < costPerCall) {
        const savings = costPerCall - bestValue.cost;
        alternatives.push({
          category: "best_value",
          model: bestValue.model,
          estimated_total_cost_usd:
            Math.round(bestValue.cost * numCalls * 1e10) / 1e10,
          savings_usd: Math.round(savings * numCalls * 1e10) / 1e10,
          savings_percent:
            costPerCall > 0
              ? Math.round((savings / costPerCall) * 1000) / 10
              : 0,
        });
      }
    }

    // Same provider cheaper
    if (requestedProvider) {
      const sameProvider = PRICING_TABLE.filter(
        (m) =>
          m.provider === requestedProvider && m.model_canonical !== modelCanonical
      );
      let cheapestSameProvider: { model: string; cost: number } | null = null;
      for (const m of sameProvider) {
        const c = calculateCost(
          args.estimated_input_tokens,
          args.estimated_output_tokens,
          m.input_price_per_mtok,
          m.output_price_per_mtok
        );
        if (!cheapestSameProvider || c.cost_usd < cheapestSameProvider.cost) {
          cheapestSameProvider = { model: m.model_canonical, cost: c.cost_usd };
        }
      }
      if (cheapestSameProvider && cheapestSameProvider.cost < costPerCall) {
        const savings = costPerCall - cheapestSameProvider.cost;
        alternatives.push({
          category: "same_provider_cheaper",
          model: cheapestSameProvider.model,
          estimated_total_cost_usd:
            Math.round(cheapestSameProvider.cost * numCalls * 1e10) / 1e10,
          savings_usd: Math.round(savings * numCalls * 1e10) / 1e10,
          savings_percent:
            costPerCall > 0
              ? Math.round((savings / costPerCall) * 1000) / 10
              : 0,
        });
      }
    }
  }

  return {
    model_canonical: modelCanonical,
    estimated_total_cost_usd: Math.round(totalCost * 1e10) / 1e10,
    cost_per_call_usd: Math.round(costPerCall * 1e10) / 1e10,
    alternatives,
  };
}
