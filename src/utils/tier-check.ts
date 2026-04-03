type Tier = "free" | "paid";

const TIER_ACCESS: Record<string, Tier[]> = {
  cost_log: ["free", "paid"],
  cost_report: ["free", "paid"],
  cost_compare: ["free", "paid"],
  budget_check: ["free", "paid"],
  cost_estimate: ["free", "paid"],
  pricing_table: ["free", "paid"],
};

export function isTierAllowed(_tool: string, _tier: Tier): boolean {
  // V1: Everything unlocked
  return true;

  // V2: Uncomment for billing integration
  // return TIER_ACCESS[tool]?.includes(tier) ?? false;
}

export function getTier(_userId?: string): Tier {
  // V1: Everyone is free tier
  return "free";

  // V2: Lookup user's subscription status from billing DB
  // return userBillingStatus[userId] ?? "free";
}
