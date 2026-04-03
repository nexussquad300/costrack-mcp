/**
 * Durable Object client — wraps fetch-based RPC to the CostAggregator DO.
 */
import type {
  Env,
  AddEventInput,
  AddEventResult,
  ReportResult,
  BudgetDataResult,
  CompareDataResult,
} from "../types/index.js";

function getStub(env: Env) {
  const id = env.COST_AGGREGATOR.idFromName("global");
  return env.COST_AGGREGATOR.get(id);
}

async function call<T>(env: Env, method: string, data: unknown): Promise<T> {
  const stub = getStub(env);
  const response = await stub.fetch(`http://do/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const err = (await response.json()) as { error: string };
    throw new Error(err.error ?? `DO call failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export async function doAddEvent(env: Env, input: AddEventInput): Promise<AddEventResult> {
  return call<AddEventResult>(env, "add-event", input);
}

export async function doGetReport(
  env: Env,
  scope: string,
  scopeId: string | undefined,
  period: string
): Promise<ReportResult> {
  return call<ReportResult>(env, "get-report", { scope, scope_id: scopeId, period });
}

export async function doGetBudgetData(
  env: Env,
  scope: string,
  scopeId: string | undefined,
  period: string
): Promise<BudgetDataResult> {
  return call<BudgetDataResult>(env, "get-budget-data", { scope, scope_id: scopeId, period });
}

export async function doGetCompareData(
  env: Env,
  compareType: string,
  items: string[]
): Promise<CompareDataResult[]> {
  return call<CompareDataResult[]>(env, "get-compare-data", { compare_type: compareType, items });
}
