// ━━━ Environment ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface Env {
  COSTRACK_EVENTS: KVNamespace;
  COST_AGGREGATOR: DurableObjectNamespace;
  ENVIRONMENT?: string;
}

// ━━━ Cost Event (KV raw storage) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CostEvent {
  event_version: "v1";
  event_id: string;
  timestamp: string;
  model_canonical: string;
  input_tokens: number;
  output_tokens: number;
  input_price_per_mtok: number | null;
  output_price_per_mtok: number | null;
  cost_usd: number | null;
  input_cost_usd: number | null;
  output_cost_usd: number | null;
  currency: "USD";
  agent_id?: string;
  task_id?: string;
  session_id?: string;
  metadata?: Record<string, unknown>;
  idempotency_key?: string;
}

// ━━━ Tool Input / Output Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface CostLogInput {
  model: string;
  input_tokens: number;
  output_tokens: number;
  agent_id?: string;
  task_id?: string;
  session_id?: string;
  provider?: string;
  metadata?: Record<string, unknown>;
  manual_cost_usd?: number;
  idempotency_key?: string;
  hard_limit_usd?: number;
}

export interface CostLogOutput {
  event_id: string;
  cost_usd: number | null;
  input_cost_usd: number | null;
  output_cost_usd: number | null;
  model_canonical: string;
  running_global_total: number;
  running_session_total: number | null;
  was_duplicate: boolean;
  hard_limit_status?: "OK" | "HARD_LIMIT_REACHED";
}

export interface CostReportInput {
  scope: "all" | "agent" | "task" | "session" | "model";
  scope_id?: string;
  period: "today" | "7d" | "30d" | "all";
}

export interface CostReportOutput {
  scope: string;
  period: string;
  total_cost_usd: number;
  total_events: number;
  avg_cost_per_event: number;
  by_model: Array<{ model: string; cost_usd: number; events: number }>;
  by_agent: Array<{ agent_id: string; cost_usd: number; events: number }>;
  by_task: Array<{ task_id: string; cost_usd: number; events: number }>;
  top_spenders: Array<{ type: string; id: string; cost_usd: number }>;
}

export interface CostCompareInput {
  compare_type: "models" | "agents" | "periods";
  items: string[];
}

export interface CostCompareOutput {
  compare_type: string;
  comparisons: Array<{
    id: string;
    total_cost_usd: number;
    total_events: number;
    avg_cost_per_event: number;
  }>;
  cheapest: string;
  recommendation: string;
}

export interface BudgetCheckInput {
  budget_usd: number;
  scope: "all" | "agent" | "task";
  scope_id?: string;
  period: "today" | "7d" | "30d";
}

export interface BudgetCheckOutput {
  budget_usd: number;
  current_spend_usd: number;
  budget_remaining_usd: number;
  percentage_used: number;
  avg_daily_spend_usd: number;
  days_remaining: number;
  projected_end_of_period_spend_usd: number;
  projected_overage_usd: number;
  status: "OK" | "WARNING" | "PROJECTED_OVERAGE" | "EXCEEDED";
}

export interface CostEstimateInput {
  model: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  num_calls?: number;
}

export interface CostEstimateOutput {
  model_canonical: string;
  pricing_available: boolean;
  estimated_total_cost_usd: number | null;
  cost_per_call_usd: number | null;
  alternatives: Array<{
    category: "cheapest" | "best_value" | "same_provider_cheaper";
    model: string;
    estimated_total_cost_usd: number;
    savings_usd: number;
    savings_percent: number;
  }>;
  warning?: string;
}

export interface PricingTableInput {
  provider?: "openai" | "anthropic" | "google" | "meta" | "deepseek" | "all";
  capability?: "flagship" | "mid" | "fast" | "embedding" | "all";
}

export interface PricingTableOutput {
  models: Array<{
    model_canonical: string;
    provider: string;
    capability: string;
    input_price_per_mtok: number;
    output_price_per_mtok: number;
    context_window: number;
  }>;
  last_updated: string;
}

// ━━━ DO Aggregation Types ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface AggregatorTotals {
  total_cost_usd: number;
  total_events: number;
  by_model: Record<string, { cost_usd: number; events: number; input_tokens: number; output_tokens: number }>;
  by_agent: Record<string, { cost_usd: number; events: number }>;
  by_task: Record<string, { cost_usd: number; events: number }>;
  by_session: Record<string, { cost_usd: number; events: number }>;
}

export interface DayBreakdown {
  date: string;
  cost_usd: number;
  events: number;
  by_model: Record<string, { cost_usd: number; events: number }>;
  by_agent: Record<string, { cost_usd: number; events: number }>;
  by_task: Record<string, { cost_usd: number; events: number }>;
}

export interface AddEventInput {
  cost_usd: number | null;
  model_canonical: string;
  agent_id?: string;
  task_id?: string;
  session_id?: string;
  input_tokens: number;
  output_tokens: number;
  idempotency_key?: string;
}

export interface AddEventResult {
  running_global_total: number;
  running_session_total: number | null;
  was_duplicate: boolean;
}

export interface ReportResult {
  total_cost_usd: number;
  total_events: number;
  by_model: Array<{ model: string; cost_usd: number; events: number }>;
  by_agent: Array<{ agent_id: string; cost_usd: number; events: number }>;
  by_task: Array<{ task_id: string; cost_usd: number; events: number }>;
}

export interface BudgetDataResult {
  current_spend_usd: number;
  total_events: number;
  days_in_period: number;
}

export interface CompareDataResult {
  id: string;
  total_cost_usd: number;
  total_events: number;
}
