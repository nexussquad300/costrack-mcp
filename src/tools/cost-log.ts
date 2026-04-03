import { getEnv } from "../index.js";
import { normalizeModel } from "../normalize/model-normalizer.js";
import { lookupPricing } from "../pricing/pricing-table.js";
import { calculateCost } from "../utils/cost-calculator.js";
import { doAddEvent } from "../storage/do-client.js";
import { writeEvent } from "../storage/kv-adapter.js";
import type { CostLogInput, CostLogOutput, CostEvent } from "../types/index.js";

export async function costLog(args: CostLogInput): Promise<CostLogOutput> {
  const env = getEnv();

  // 1. Normalize model
  const modelCanonical = normalizeModel(args.model) ?? args.model;

  // 2. Lookup pricing
  const pricing = lookupPricing(modelCanonical);

  // 3. Calculate cost
  let costUsd: number | null = null;
  let inputCostUsd: number | null = null;
  let outputCostUsd: number | null = null;
  let inputPricePerMtok: number | null = null;
  let outputPricePerMtok: number | null = null;

  if (args.manual_cost_usd !== undefined) {
    costUsd = args.manual_cost_usd;
  } else if (pricing) {
    inputPricePerMtok = pricing.input_price_per_mtok;
    outputPricePerMtok = pricing.output_price_per_mtok;
    const calc = calculateCost(
      args.input_tokens,
      args.output_tokens,
      inputPricePerMtok,
      outputPricePerMtok
    );
    costUsd = calc.cost_usd;
    inputCostUsd = calc.input_cost_usd;
    outputCostUsd = calc.output_cost_usd;
  }
  // If no pricing and no manual cost → cost stays null (unpriced)

  // 4. Generate event ID
  const timestamp = new Date().toISOString();
  const random = crypto.randomUUID().split("-")[0];
  const eventId = `evt_${timestamp}_${random}`;

  // 5. Update DO aggregations (includes idempotency check)
  const doResult = await doAddEvent(env, {
    cost_usd: costUsd,
    model_canonical: modelCanonical,
    agent_id: args.agent_id,
    task_id: args.task_id,
    session_id: args.session_id,
    input_tokens: args.input_tokens,
    output_tokens: args.output_tokens,
    idempotency_key: args.idempotency_key,
  });

  if (doResult.was_duplicate) {
    return {
      event_id: eventId,
      cost_usd: costUsd,
      input_cost_usd: inputCostUsd,
      output_cost_usd: outputCostUsd,
      model_canonical: modelCanonical,
      running_session_total: doResult.running_session_total,
      was_duplicate: true,
    };
  }

  // 6. Write raw event to KV
  const kvEvent: CostEvent = {
    event_version: "v1",
    event_id: eventId,
    timestamp,
    model_canonical: modelCanonical,
    input_tokens: args.input_tokens,
    output_tokens: args.output_tokens,
    input_price_per_mtok: inputPricePerMtok,
    output_price_per_mtok: outputPricePerMtok,
    cost_usd: costUsd,
    input_cost_usd: inputCostUsd,
    output_cost_usd: outputCostUsd,
    currency: "USD",
    agent_id: args.agent_id,
    task_id: args.task_id,
    session_id: args.session_id,
    metadata: args.metadata,
    idempotency_key: args.idempotency_key,
  };

  await writeEvent(env, kvEvent);

  // 7. Hard limit check (signal only — does NOT block)
  const result: CostLogOutput = {
    event_id: eventId,
    cost_usd: costUsd,
    input_cost_usd: inputCostUsd,
    output_cost_usd: outputCostUsd,
    model_canonical: modelCanonical,
    running_session_total: doResult.running_session_total,
    was_duplicate: false,
  };

  if (args.hard_limit_usd !== undefined) {
    result.hard_limit_status =
      doResult.running_session_total >= args.hard_limit_usd
        ? "HARD_LIMIT_REACHED"
        : "OK";
  }

  return result;
}
