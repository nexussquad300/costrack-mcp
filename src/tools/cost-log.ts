import { normalizeModel } from "../normalize/model-normalizer.js";
import { lookupPricing } from "../pricing/pricing-table.js";
import { calculateCost } from "../utils/cost-calculator.js";
import { doAddEvent } from "../storage/do-client.js";
import { writeEvent } from "../storage/kv-adapter.js";
import {
  validateNonEmptyString,
  validatePositiveNumber,
  validatePositiveNumberOrUndefined,
  validateStringOrUndefined,
  ValidationError,
} from "../utils/validate.js";
import type { Env, CostLogInput, CostLogOutput, CostEvent } from "../types/index.js";

export async function costLog(env: Env, args: CostLogInput): Promise<CostLogOutput> {
  // Validate inputs
  const model = validateNonEmptyString(args.model, "model");
  const input_tokens = validatePositiveNumber(args.input_tokens, "input_tokens");
  const output_tokens = validatePositiveNumber(args.output_tokens, "output_tokens");
  const manual_cost_usd = validatePositiveNumberOrUndefined(args.manual_cost_usd, "manual_cost_usd");
  const hard_limit_usd = validatePositiveNumberOrUndefined(args.hard_limit_usd, "hard_limit_usd");
  const agent_id = validateStringOrUndefined(args.agent_id, "agent_id");
  const task_id = validateStringOrUndefined(args.task_id, "task_id");
  const session_id = validateStringOrUndefined(args.session_id, "session_id");

  if (input_tokens > 10_000_000) throw new ValidationError("input_tokens exceeds maximum (10M)");
  if (output_tokens > 10_000_000) throw new ValidationError("output_tokens exceeds maximum (10M)");

  // 1. Normalize model
  const modelCanonical = normalizeModel(model) ?? model;

  // 2. Lookup pricing
  const pricing = lookupPricing(modelCanonical);

  // 3. Calculate cost
  let costUsd: number | null = null;
  let inputCostUsd: number | null = null;
  let outputCostUsd: number | null = null;
  let inputPricePerMtok: number | null = null;
  let outputPricePerMtok: number | null = null;

  if (manual_cost_usd !== undefined) {
    costUsd = manual_cost_usd;
  } else if (pricing) {
    inputPricePerMtok = pricing.input_price_per_mtok;
    outputPricePerMtok = pricing.output_price_per_mtok;
    const calc = calculateCost(
      input_tokens,
      output_tokens,
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
    agent_id,
    task_id,
    session_id,
    input_tokens,
    output_tokens,
    idempotency_key: args.idempotency_key,
  });

  if (doResult.was_duplicate) {
    return {
      event_id: eventId,
      cost_usd: costUsd,
      input_cost_usd: inputCostUsd,
      output_cost_usd: outputCostUsd,
      model_canonical: modelCanonical,
      running_global_total: doResult.running_global_total,
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
    input_tokens,
    output_tokens,
    input_price_per_mtok: inputPricePerMtok,
    output_price_per_mtok: outputPricePerMtok,
    cost_usd: costUsd,
    input_cost_usd: inputCostUsd,
    output_cost_usd: outputCostUsd,
    currency: "USD",
    agent_id,
    task_id,
    session_id,
    metadata: args.metadata,
    idempotency_key: args.idempotency_key,
  };

  await writeEvent(env, kvEvent);

  // 7. Hard limit check (signal only — does NOT block)
  // Use session total if session_id provided, otherwise global total
  const result: CostLogOutput = {
    event_id: eventId,
    cost_usd: costUsd,
    input_cost_usd: inputCostUsd,
    output_cost_usd: outputCostUsd,
    model_canonical: modelCanonical,
    running_global_total: doResult.running_global_total,
    running_session_total: doResult.running_session_total,
    was_duplicate: false,
  };

  if (hard_limit_usd !== undefined) {
    const compareTotal = doResult.running_session_total ?? doResult.running_global_total;
    result.hard_limit_status =
      compareTotal >= hard_limit_usd
        ? "HARD_LIMIT_REACHED"
        : "OK";
  }

  return result;
}
