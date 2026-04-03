/**
 * KV adapter — raw event storage for audit trail / future export.
 */
import type { Env, CostEvent } from "../types/index.js";

export async function writeEvent(env: Env, event: CostEvent): Promise<void> {
  await env.COSTRACK_EVENTS.put(
    `event:${event.event_id}`,
    JSON.stringify(event)
  );
}

export async function readEvent(env: Env, eventId: string): Promise<CostEvent | null> {
  const raw = await env.COSTRACK_EVENTS.get(`event:${eventId}`);
  if (!raw) return null;
  return JSON.parse(raw) as CostEvent;
}
