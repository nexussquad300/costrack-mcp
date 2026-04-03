import { getEnv } from "../index.js";
import { doGetBudgetData } from "../storage/do-client.js";
import type { BudgetCheckInput, BudgetCheckOutput } from "../types/index.js";

export async function budgetCheck(args: BudgetCheckInput): Promise<BudgetCheckOutput> {
  const env = getEnv();
  const data = await doGetBudgetData(env, args.scope, args.scope_id, args.period);

  const currentSpend = data.current_spend_usd;
  const budgetRemaining = Math.max(0, args.budget_usd - currentSpend);
  const percentageUsed =
    args.budget_usd > 0
      ? Math.round((currentSpend / args.budget_usd) * 10000) / 100
      : 0;

  // Calculate average daily spend and projection
  const daysElapsed = data.days_in_period;
  const daysWithSpend = daysElapsed > 0 ? daysElapsed : 1;
  const avgDailySpend = currentSpend / daysWithSpend;

  // Days remaining in the period
  let daysRemaining: number;
  switch (args.period) {
    case "today":
      daysRemaining = 0;
      break;
    case "7d":
      daysRemaining = Math.max(0, 7 - daysElapsed);
      break;
    case "30d":
      daysRemaining = Math.max(0, 30 - daysElapsed);
      break;
    default:
      daysRemaining = 0;
  }

  const projectedSpend = currentSpend + avgDailySpend * daysRemaining;
  const projectedOverage = Math.max(0, projectedSpend - args.budget_usd);

  // Determine status
  let status: BudgetCheckOutput["status"];
  if (currentSpend >= args.budget_usd) {
    status = "EXCEEDED";
  } else if (percentageUsed >= 80 || projectedSpend > args.budget_usd) {
    if (currentSpend < args.budget_usd && projectedSpend > args.budget_usd) {
      status = "PROJECTED_OVERAGE";
    } else {
      status = "WARNING";
    }
  } else {
    status = "OK";
  }

  return {
    budget_usd: args.budget_usd,
    current_spend_usd: Math.round(currentSpend * 1e10) / 1e10,
    budget_remaining_usd: Math.round(budgetRemaining * 1e10) / 1e10,
    percentage_used: percentageUsed,
    avg_daily_spend_usd: Math.round(avgDailySpend * 1e10) / 1e10,
    days_remaining: daysRemaining,
    projected_end_of_period_spend_usd: Math.round(projectedSpend * 1e10) / 1e10,
    projected_overage_usd: Math.round(projectedOverage * 1e10) / 1e10,
    status,
  };
}
