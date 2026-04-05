/**
 * CostAggregator Durable Object — maintains running aggregations for all cost data.
 *
 * Storage keys:
 *   "totals"            → AggregatorTotals (all-time rollups)
 *   "day:{YYYY-MM-DD}"  → DayBreakdown (per-day rollups with model/agent/task splits)
 *   "idem:{key}"        → true (idempotency markers)
 */
import { DurableObject } from "cloudflare:workers";
import type {
  AggregatorTotals,
  DayBreakdown,
  AddEventInput,
  AddEventResult,
  ReportResult,
  BudgetDataResult,
  CompareDataResult,
} from "../types/index.js";

function defaultTotals(): AggregatorTotals {
  return {
    total_cost_usd: 0,
    total_events: 0,
    by_model: {},
    by_agent: {},
    by_task: {},
    by_session: {},
  };
}

function defaultDay(date: string): DayBreakdown {
  return { date, cost_usd: 0, events: 0, by_model: {}, by_agent: {}, by_task: {} };
}

function roundCost(value: number): number {
  return Math.round(value * 1e10) / 1e10;
}

function getDateRange(period: string): string[] {
  const dates: string[] = [];
  const now = new Date();

  if (period === "today") {
    dates.push(now.toISOString().split("T")[0]);
    return dates;
  }

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export class CostAggregator extends DurableObject {
  // In-memory cache for hot-path reads
  private totalsCache: AggregatorTotals | null = null;
  private idempotencyCache = new Set<string>();

  // ── Internal helpers ──────────────────────────────────────────────────────

  private async getTotals(): Promise<AggregatorTotals> {
    if (!this.totalsCache) {
      this.totalsCache =
        (await this.ctx.storage.get<AggregatorTotals>("totals")) ?? defaultTotals();
    }
    return this.totalsCache;
  }

  private async saveTotals(): Promise<void> {
    if (this.totalsCache) {
      await this.ctx.storage.put("totals", this.totalsCache);
    }
  }

  private async getDay(date: string): Promise<DayBreakdown> {
    return (await this.ctx.storage.get<DayBreakdown>(`day:${date}`)) ?? defaultDay(date);
  }

  private async saveDay(day: DayBreakdown): Promise<void> {
    await this.ctx.storage.put(`day:${day.date}`, day);
  }

  private async isIdempotent(key: string): Promise<boolean> {
    if (this.idempotencyCache.has(key)) return true;
    const stored = await this.ctx.storage.get(`idem:${key}`);
    if (stored !== undefined) {
      this.idempotencyCache.add(key);
      return true;
    }
    return false;
  }

  private async markIdempotent(key: string): Promise<void> {
    // Cap in-memory cache as safety valve (storage is source of truth)
    if (this.idempotencyCache.size > 10_000) {
      this.idempotencyCache.clear();
    }
    this.idempotencyCache.add(key);
    await this.ctx.storage.put(`idem:${key}`, Date.now());
    // Bootstrap cleanup alarm on first idempotency key
    const alarm = await this.ctx.storage.getAlarm();
    if (!alarm) {
      await this.ctx.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000);
    }
  }

  // ── Idempotency TTL cleanup ──────────────────────────────────────────────

  private async cleanupIdempotencyKeys(): Promise<void> {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours
    const entries = await this.ctx.storage.list({ prefix: "idem:" });
    const toDelete: string[] = [];
    for (const [key, timestamp] of entries) {
      if (typeof timestamp === "number" && timestamp < cutoff) {
        toDelete.push(key);
        this.idempotencyCache.delete(key.slice("idem:".length));
      }
    }
    if (toDelete.length > 0) {
      await this.ctx.storage.delete(toDelete);
    }
  }

  async alarm(): Promise<void> {
    await this.cleanupIdempotencyKeys();
    // Reschedule every 6 hours
    await this.ctx.storage.setAlarm(Date.now() + 6 * 60 * 60 * 1000);
  }

  // ── Fetch router ──────────────────────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/^\//, "");

    try {
      const body =
        request.method === "POST" ? ((await request.json()) as Record<string, unknown>) : {};

      switch (path) {
        case "add-event":
          return Response.json(await this.handleAddEvent(body as unknown as AddEventInput));
        case "get-report":
          return Response.json(
            await this.handleGetReport(
              body.scope as string,
              body.scope_id as string | undefined,
              body.period as string
            )
          );
        case "get-budget-data":
          return Response.json(
            await this.handleGetBudgetData(
              body.scope as string,
              body.scope_id as string | undefined,
              body.period as string
            )
          );
        case "get-compare-data":
          return Response.json(
            await this.handleGetCompareData(
              body.compare_type as string,
              body.items as string[]
            )
          );
        default:
          return new Response("Not found", { status: 404 });
      }
    } catch (err) {
      return Response.json({ error: String(err) }, { status: 500 });
    }
  }

  // ── Add Event ─────────────────────────────────────────────────────────────

  private async handleAddEvent(input: AddEventInput): Promise<AddEventResult> {
    // Idempotency check
    if (input.idempotency_key) {
      if (await this.isIdempotent(input.idempotency_key)) {
        const totals = await this.getTotals();
        const sessionTotal = input.session_id
          ? totals.by_session[input.session_id]?.cost_usd ?? 0
          : null;
        return {
          running_global_total: totals.total_cost_usd,
          running_session_total: sessionTotal,
          was_duplicate: true,
        };
      }
      await this.markIdempotent(input.idempotency_key);
    }

    const cost = input.cost_usd ?? 0;
    const today = new Date().toISOString().split("T")[0];

    // Update all-time totals
    const totals = await this.getTotals();
    totals.total_cost_usd = roundCost(totals.total_cost_usd + cost);
    totals.total_events += 1;

    // By model
    const mc = input.model_canonical;
    if (!totals.by_model[mc]) {
      totals.by_model[mc] = { cost_usd: 0, events: 0, input_tokens: 0, output_tokens: 0 };
    }
    totals.by_model[mc].cost_usd = roundCost(totals.by_model[mc].cost_usd + cost);
    totals.by_model[mc].events += 1;
    totals.by_model[mc].input_tokens += input.input_tokens;
    totals.by_model[mc].output_tokens += input.output_tokens;

    // By agent
    if (input.agent_id) {
      if (!totals.by_agent[input.agent_id]) {
        totals.by_agent[input.agent_id] = { cost_usd: 0, events: 0 };
      }
      totals.by_agent[input.agent_id].cost_usd = roundCost(totals.by_agent[input.agent_id].cost_usd + cost);
      totals.by_agent[input.agent_id].events += 1;
    }

    // By task
    if (input.task_id) {
      if (!totals.by_task[input.task_id]) {
        totals.by_task[input.task_id] = { cost_usd: 0, events: 0 };
      }
      totals.by_task[input.task_id].cost_usd = roundCost(totals.by_task[input.task_id].cost_usd + cost);
      totals.by_task[input.task_id].events += 1;
    }

    // By session
    if (input.session_id) {
      if (!totals.by_session[input.session_id]) {
        totals.by_session[input.session_id] = { cost_usd: 0, events: 0 };
      }
      totals.by_session[input.session_id].cost_usd = roundCost(totals.by_session[input.session_id].cost_usd + cost);
      totals.by_session[input.session_id].events += 1;
    }

    // Update daily breakdown
    const day = await this.getDay(today);
    day.cost_usd = roundCost(day.cost_usd + cost);
    day.events += 1;

    if (!day.by_model[mc]) day.by_model[mc] = { cost_usd: 0, events: 0 };
    day.by_model[mc].cost_usd = roundCost(day.by_model[mc].cost_usd + cost);
    day.by_model[mc].events += 1;

    if (input.agent_id) {
      if (!day.by_agent[input.agent_id]) day.by_agent[input.agent_id] = { cost_usd: 0, events: 0 };
      day.by_agent[input.agent_id].cost_usd = roundCost(day.by_agent[input.agent_id].cost_usd + cost);
      day.by_agent[input.agent_id].events += 1;
    }

    if (input.task_id) {
      if (!day.by_task[input.task_id]) day.by_task[input.task_id] = { cost_usd: 0, events: 0 };
      day.by_task[input.task_id].cost_usd = roundCost(day.by_task[input.task_id].cost_usd + cost);
      day.by_task[input.task_id].events += 1;
    }

    // Atomic write: totals + daily breakdown in one batch
    this.totalsCache = totals;
    await this.ctx.storage.put({
      "totals": totals,
      [`day:${today}`]: day,
    });

    const sessionTotal = input.session_id
      ? totals.by_session[input.session_id]?.cost_usd ?? 0
      : null;
    return {
      running_global_total: totals.total_cost_usd,
      running_session_total: sessionTotal,
      was_duplicate: false,
    };
  }

  // ── Get Report ────────────────────────────────────────────────────────────

  private async handleGetReport(
    scope: string,
    scopeId: string | undefined,
    period: string
  ): Promise<ReportResult> {
    if (period === "all") {
      return this.reportFromTotals(scope, scopeId);
    }
    const dates = getDateRange(period);
    const days = await Promise.all(dates.map((d) => this.getDay(d)));
    return this.reportFromDays(days, scope, scopeId);
  }

  private async reportFromTotals(scope: string, scopeId?: string): Promise<ReportResult> {
    const t = await this.getTotals();
    let totalCost = t.total_cost_usd;
    let totalEvents = t.total_events;
    let byModel = Object.entries(t.by_model).map(([model, d]) => ({
      model,
      cost_usd: d.cost_usd,
      events: d.events,
    }));
    let byAgent = Object.entries(t.by_agent).map(([agent_id, d]) => ({ agent_id, ...d }));
    let byTask = Object.entries(t.by_task).map(([task_id, d]) => ({ task_id, ...d }));

    if (scope !== "all" && scopeId) {
      switch (scope) {
        case "model": {
          const m = t.by_model[scopeId];
          totalCost = m?.cost_usd ?? 0;
          totalEvents = m?.events ?? 0;
          byModel = m ? [{ model: scopeId, cost_usd: m.cost_usd, events: m.events }] : [];
          break;
        }
        case "agent": {
          const a = t.by_agent[scopeId];
          totalCost = a?.cost_usd ?? 0;
          totalEvents = a?.events ?? 0;
          byAgent = a ? [{ agent_id: scopeId, ...a }] : [];
          break;
        }
        case "task": {
          const k = t.by_task[scopeId];
          totalCost = k?.cost_usd ?? 0;
          totalEvents = k?.events ?? 0;
          byTask = k ? [{ task_id: scopeId, ...k }] : [];
          break;
        }
        case "session": {
          const s = t.by_session[scopeId];
          totalCost = s?.cost_usd ?? 0;
          totalEvents = s?.events ?? 0;
          break;
        }
      }
    }

    return { total_cost_usd: totalCost, total_events: totalEvents, by_model: byModel, by_agent: byAgent, by_task: byTask };
  }

  private reportFromDays(
    days: DayBreakdown[],
    scope: string,
    scopeId?: string
  ): ReportResult {
    const modelAgg: Record<string, { cost_usd: number; events: number }> = {};
    const agentAgg: Record<string, { cost_usd: number; events: number }> = {};
    const taskAgg: Record<string, { cost_usd: number; events: number }> = {};
    let totalCost = 0;
    let totalEvents = 0;

    for (const day of days) {
      totalCost += day.cost_usd;
      totalEvents += day.events;

      for (const [model, d] of Object.entries(day.by_model)) {
        if (!modelAgg[model]) modelAgg[model] = { cost_usd: 0, events: 0 };
        modelAgg[model].cost_usd += d.cost_usd;
        modelAgg[model].events += d.events;
      }
      for (const [agent, d] of Object.entries(day.by_agent)) {
        if (!agentAgg[agent]) agentAgg[agent] = { cost_usd: 0, events: 0 };
        agentAgg[agent].cost_usd += d.cost_usd;
        agentAgg[agent].events += d.events;
      }
      for (const [task, d] of Object.entries(day.by_task)) {
        if (!taskAgg[task]) taskAgg[task] = { cost_usd: 0, events: 0 };
        taskAgg[task].cost_usd += d.cost_usd;
        taskAgg[task].events += d.events;
      }
    }

    // Scope filtering
    if (scope !== "all" && scopeId) {
      switch (scope) {
        case "model":
          totalCost = modelAgg[scopeId]?.cost_usd ?? 0;
          totalEvents = modelAgg[scopeId]?.events ?? 0;
          break;
        case "agent":
          totalCost = agentAgg[scopeId]?.cost_usd ?? 0;
          totalEvents = agentAgg[scopeId]?.events ?? 0;
          break;
        case "task":
          totalCost = taskAgg[scopeId]?.cost_usd ?? 0;
          totalEvents = taskAgg[scopeId]?.events ?? 0;
          break;
      }
    }

    return {
      total_cost_usd: totalCost,
      total_events: totalEvents,
      by_model: Object.entries(modelAgg).map(([model, d]) => ({ model, ...d })),
      by_agent: Object.entries(agentAgg).map(([agent_id, d]) => ({ agent_id, ...d })),
      by_task: Object.entries(taskAgg).map(([task_id, d]) => ({ task_id, ...d })),
    };
  }

  // ── Budget Data ───────────────────────────────────────────────────────────

  private async handleGetBudgetData(
    scope: string,
    scopeId: string | undefined,
    period: string
  ): Promise<BudgetDataResult> {
    const dates = getDateRange(period);
    const days = await Promise.all(dates.map((d) => this.getDay(d)));

    let spend = 0;
    let events = 0;

    for (const day of days) {
      if (scope === "all") {
        spend += day.cost_usd;
        events += day.events;
      } else if (scope === "agent" && scopeId) {
        const a = day.by_agent[scopeId];
        if (a) { spend += a.cost_usd; events += a.events; }
      } else if (scope === "task" && scopeId) {
        const t = day.by_task[scopeId];
        if (t) { spend += t.cost_usd; events += t.events; }
      }
    }

    return { current_spend_usd: spend, total_events: events, days_in_period: dates.length };
  }

  // ── Compare Data ──────────────────────────────────────────────────────────

  private async handleGetCompareData(
    compareType: string,
    items: string[]
  ): Promise<CompareDataResult[]> {
    const totals = await this.getTotals();
    const results: CompareDataResult[] = [];

    for (const item of items) {
      let cost = 0;
      let events = 0;

      switch (compareType) {
        case "models": {
          const m = totals.by_model[item];
          if (m) { cost = m.cost_usd; events = m.events; }
          break;
        }
        case "agents": {
          const a = totals.by_agent[item];
          if (a) { cost = a.cost_usd; events = a.events; }
          break;
        }
        case "periods": {
          const day = await this.getDay(item);
          cost = day.cost_usd;
          events = day.events;
          break;
        }
      }

      results.push({ id: item, total_cost_usd: cost, total_events: events });
    }

    return results;
  }
}
