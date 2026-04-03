import {
  PRICING_TABLE,
  PRICING_TABLE_LAST_UPDATED,
} from "../pricing/pricing-table.js";
import type { PricingTableInput, PricingTableOutput } from "../types/index.js";

export async function pricingTable(args: PricingTableInput): Promise<PricingTableOutput> {
  const providerFilter = args.provider ?? "all";
  const capabilityFilter = args.capability ?? "all";

  const filtered = PRICING_TABLE.filter((m) => {
    if (providerFilter !== "all" && m.provider !== providerFilter) return false;
    if (capabilityFilter !== "all" && m.capability !== capabilityFilter) return false;
    return true;
  });

  return {
    models: filtered.map((m) => ({
      model_canonical: m.model_canonical,
      provider: m.provider,
      capability: m.capability,
      input_price_per_mtok: m.input_price_per_mtok,
      output_price_per_mtok: m.output_price_per_mtok,
      context_window: m.context_window,
    })),
    last_updated: PRICING_TABLE_LAST_UPDATED,
  };
}
