import { doGetReport } from "../storage/do-client.js";
import { validateNonEmptyString, ValidationError } from "../utils/validate.js";
import type { Env, CostReportInput, CostReportOutput } from "../types/index.js";

export async function costReport(env: Env, args: CostReportInput): Promise<CostReportOutput> {
  // Validate inputs
  const scope = validateNonEmptyString(args.scope, "scope");
  const period = validateNonEmptyString(args.period, "period");
  if (!["all", "agent", "task", "session", "model"].includes(scope))
    throw new ValidationError(`scope must be one of: all, agent, task, session, model`);
  if (!["today", "7d", "30d", "all"].includes(period))
    throw new ValidationError(`period must be one of: today, 7d, 30d, all`);
  if (scope !== "all" && !args.scope_id?.trim())
    throw new ValidationError(`scope_id is required when scope is "${scope}"`);

  const report = await doGetReport(env, scope, args.scope_id, period);

  const avgCostPerEvent =
    report.total_events > 0 ? report.total_cost_usd / report.total_events : 0;

  // Build top spenders (top 5 across models, agents, tasks)
  const candidates: Array<{ type: string; id: string; cost_usd: number }> = [];

  for (const m of report.by_model) {
    candidates.push({ type: "model", id: m.model, cost_usd: m.cost_usd });
  }
  for (const a of report.by_agent) {
    candidates.push({ type: "agent", id: a.agent_id, cost_usd: a.cost_usd });
  }
  for (const t of report.by_task) {
    candidates.push({ type: "task", id: t.task_id, cost_usd: t.cost_usd });
  }

  candidates.sort((a, b) => b.cost_usd - a.cost_usd);
  const topSpenders = candidates.slice(0, 5);

  return {
    scope,
    period,
    total_cost_usd: report.total_cost_usd,
    total_events: report.total_events,
    avg_cost_per_event: Math.round(avgCostPerEvent * 1e10) / 1e10,
    by_model: report.by_model,
    by_agent: report.by_agent,
    by_task: report.by_task,
    top_spenders: topSpenders,
  };
}
