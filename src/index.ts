/**
 * CosTrack MCP Server — core tool definitions and request routing.
 *
 * Env is injected per-request by worker.ts via setEnv() before the
 * transport handles the request.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Env } from "./types/index.js";

import { costLog } from "./tools/cost-log.js";
import { costReport } from "./tools/cost-report.js";
import { costCompare } from "./tools/cost-compare.js";
import { budgetCheck } from "./tools/budget-check.js";
import { costEstimate } from "./tools/cost-estimate.js";
import { pricingTable } from "./tools/pricing-table.js";

// ━━━ Env injection (set by worker.ts per request) ━━━━━━━━━━━━━━━━━━━━━━━━━━

let _env: Env;

export function setEnv(env: Env): void {
  _env = env;
}

export function getEnv(): Env {
  if (!_env) throw new Error("Env not initialized — setEnv() must be called before tool execution");
  return _env;
}

// ━━━ MCP Server ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export function createServer() {
const server = new Server(
  { name: "costrack-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

// ── List Tools ──────────────────────────────────────────────────────────────

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "cost_log",
      description: "Record a cost event for an LLM call or agent operation",
      inputSchema: {
        type: "object" as const,
        properties: {
          model: {
            type: "string",
            description:
              "Model identifier (e.g., 'claude-sonnet-4', 'gpt-4o'). Will be normalized to canonical format.",
          },
          input_tokens: {
            type: "number",
            description: "Number of input tokens consumed",
            minimum: 0,
          },
          output_tokens: {
            type: "number",
            description: "Number of output tokens generated",
            minimum: 0,
          },
          agent_id: {
            type: "string",
            description: "Optional agent identifier for attribution",
          },
          task_id: {
            type: "string",
            description: "Optional task identifier for grouping",
          },
          session_id: {
            type: "string",
            description: "Optional session identifier for grouping",
          },
          provider: {
            type: "string",
            description: "Optional provider override (anthropic, openai, google)",
          },
          metadata: {
            type: "object",
            description: "Optional additional metadata (JSON object)",
          },
          manual_cost_usd: {
            type: "number",
            description: "Optional manual cost override (for models not in pricing table)",
            minimum: 0,
          },
          idempotency_key: {
            type: "string",
            description: "Optional idempotency key (duplicate keys are silently ignored)",
          },
          hard_limit_usd: {
            type: "number",
            description: "Optional hard limit check (signals if total spend >= limit)",
            minimum: 0,
          },
        },
        required: ["model", "input_tokens", "output_tokens"],
      },
    },
    {
      name: "cost_report",
      description: "Generate cost summary report with aggregations and breakdowns",
      inputSchema: {
        type: "object" as const,
        properties: {
          scope: {
            type: "string",
            enum: ["all", "agent", "task", "session", "model"],
            description: "Aggregation scope",
          },
          scope_id: {
            type: "string",
            description: "Scope identifier (required if scope != 'all')",
          },
          period: {
            type: "string",
            enum: ["today", "7d", "30d", "all"],
            description: "Time period for report",
          },
        },
        required: ["scope", "period"],
      },
    },
    {
      name: "cost_compare",
      description: "Compare costs side-by-side for models, agents, or time periods",
      inputSchema: {
        type: "object" as const,
        properties: {
          compare_type: {
            type: "string",
            enum: ["models", "agents", "periods"],
            description: "What to compare",
          },
          items: {
            type: "array",
            items: { type: "string" },
            description:
              "Model names, agent IDs, or date ranges to compare (e.g., ['claude-sonnet-4', 'gpt-4o'])",
            minItems: 2,
            maxItems: 5,
          },
        },
        required: ["compare_type", "items"],
      },
    },
    {
      name: "budget_check",
      description: "Check spend vs budget with projection for end-of-period",
      inputSchema: {
        type: "object" as const,
        properties: {
          budget_usd: {
            type: "number",
            description: "Budget threshold in USD",
            minimum: 0,
          },
          scope: {
            type: "string",
            enum: ["all", "agent", "task"],
            description: "Budget scope",
          },
          scope_id: {
            type: "string",
            description: "Scope identifier (required if scope != 'all')",
          },
          period: {
            type: "string",
            enum: ["today", "7d", "30d"],
            description: "Budget period",
          },
        },
        required: ["budget_usd", "scope", "period"],
      },
    },
    {
      name: "cost_estimate",
      description: "Estimate cost for planned LLM calls with alternative recommendations",
      inputSchema: {
        type: "object" as const,
        properties: {
          model: {
            type: "string",
            description: "Model to estimate for",
          },
          estimated_input_tokens: {
            type: "number",
            description: "Estimated input tokens",
            minimum: 0,
          },
          estimated_output_tokens: {
            type: "number",
            description: "Estimated output tokens",
            minimum: 0,
          },
          num_calls: {
            type: "number",
            description: "Number of calls (default: 1)",
            minimum: 1,
          },
        },
        required: ["model", "estimated_input_tokens", "estimated_output_tokens"],
      },
    },
    {
      name: "pricing_table",
      description: "Get current pricing data for supported LLM models",
      inputSchema: {
        type: "object" as const,
        properties: {
          provider: {
            type: "string",
            enum: ["openai", "anthropic", "google", "meta", "deepseek", "all"],
            description: "Optional provider filter",
          },
          capability: {
            type: "string",
            enum: ["flagship", "mid", "fast", "embedding", "all"],
            description: "Optional capability tier filter",
          },
        },
        required: [],
      },
    },
  ],
}));

// ── Call Tool ────────────────────────────────────────────────────────────────

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case "cost_log":
        result = await costLog(args as any);
        break;
      case "cost_report":
        result = await costReport(args as any);
        break;
      case "cost_compare":
        result = await costCompare(args as any);
        break;
      case "budget_check":
        result = await budgetCheck(args as any);
        break;
      case "cost_estimate":
        result = await costEstimate(args as any);
        break;
      case "pricing_table":
        result = await pricingTable(args as any);
        break;
      default:
        return {
          content: [{ type: "text" as const, text: JSON.stringify({ error: `Unknown tool: ${name}` }) }],
          isError: true,
        };
    }

    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  } catch (err) {
    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
        },
      ],
      isError: true,
    };
  }
});

  return server;
}
