import { doGetBudgetData } from "../storage/do-client.js";
import { validatePositiveNumber, validateNonEmptyString, ValidationError } from "../utils/validate.js";
import type { Env, BudgetCheckInput, BudgetCheckOutput } from "../types/index.js";

export async function budgetCheck(env: Env, args: BudgetCheckInput): Promise<BudgetCheckOutput> {
  // Validate inputs
  const budget_usd = validatePositiveNumber(args.budget_usd, "budget_usd");
  if (budget_usd <= 0) throw new ValidationError("budget_usd must be greater than 0");
  const scope = validateNonEmptyString(args.scope, "scope");
  const period = validateNonEmptyString(args.period, "period");
  if (!["all", "agent", "task"].includes(scope))
    throw new ValidationError(`scope must be one of: all, agent, task`);
  if (!["today", "7d", "30d"].includes(period))
    throw new ValidationError(`period must be one of: today, 7d, 30d`);
  if (scope !== "all" && !args.scope_id?.trim())
    throw new ValidationError(`scope_id is required when scope is "${scope}"`);

  const data = await doGetBudgetData(env, scope, args.scope_id, period);

  const currentSpend = data.current_spend_usd;
  const budgetRemaining = Math.max(0, budget_usd - currentSpend);
  const percentageUsed =
    budget_usd > 0
      ? Math.round((currentSpend / budget_usd) * 10000) / 100
      : 0;

  // Calculate average daily spend and projection
  const daysElapsed = data.days_in_period;
  const daysWithSpend = daysElapsed > 0 ? daysElapsed : 1;
  const avgDailySpend = currentSpend / daysWithSpend;

  // Days remaining in the period
  let daysRemaining: number;
  switch (period) {
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
  const projectedOverage = Math.max(0, projectedSpend - budget_usd);

  // Determine status
  let status: BudgetCheckOutput["status"];
  if (currentSpend >= budget_usd) {
    status = "EXCEEDED";
  } else if (percentageUsed >= 80 || projectedSpend > budget_usd) {
    if (currentSpend < budget_usd && projectedSpend > budget_usd) {
      status = "PROJECTED_OVERAGE";
    } else {
      status = "WARNING";
    }
  } else {
    status = "OK";
  }

  return {
    budget_usd,
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
