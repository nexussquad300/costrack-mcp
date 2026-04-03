# CosTrack MCP — Agent Cost Control Layer

Lightweight MCP server that gives any AI agent or developer instant cost tracking, spend analysis, budget enforcement, and model cost optimization for LLM operations.

## What It Does

CosTrack sits between simple price-lookup tools and full observability platforms. It's an MCP-native cost **control** layer — log costs, get reports, check budgets, compare models — all via tool calls.

## Tools

| Tool | Description |
|------|-------------|
| `cost_log` | Record a cost event for an LLM call or agent operation |
| `cost_report` | Generate cost summary with breakdowns by model, agent, task |
| `cost_compare` | Compare costs side-by-side for models, agents, or periods |
| `budget_check` | Check spend vs budget with end-of-period projection |
| `cost_estimate` | Estimate cost for planned calls with cheaper alternatives |
| `pricing_table` | Get current pricing data for 17+ supported models |

## Supported Models

- **Anthropic:** Claude Opus 4, Opus 4.6, Sonnet 4, Sonnet 4.6, Haiku 4
- **OpenAI:** GPT-4o, GPT-4o Mini, GPT-4 Turbo, o1, o1-mini
- **Google:** Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.0 Flash
- **Meta:** Llama 4 Scout, Llama 4 Maverick
- **DeepSeek:** DeepSeek V3, DeepSeek R1

Model names are automatically normalized — use aliases like `sonnet`, `gpt-4o`, `haiku` etc.

## Quick Start

### Connect via Claude Desktop / Claude Code

Add to your MCP server configuration:

```json
{
  "mcpServers": {
    "costrack": {
      "url": "https://costrack-mcp.<your-subdomain>.workers.dev/mcp"
    }
  }
}
```

### Example Usage

**Log a cost event:**
```
cost_log(model: "claude-sonnet-4", input_tokens: 1500, output_tokens: 800, agent_id: "my-agent")
→ { cost_usd: 0.0165, running_session_total: 1.23 }
```

**Check budget:**
```
budget_check(budget_usd: 100, scope: "all", period: "30d")
→ { current_spend_usd: 65.0, status: "PROJECTED_OVERAGE", projected_end_of_period_spend_usd: 130.1 }
```

**Estimate before calling:**
```
cost_estimate(model: "claude-opus-4", estimated_input_tokens: 5000, estimated_output_tokens: 2000)
→ { cost_per_call_usd: 0.225, alternatives: [{ model: "anthropic/claude-sonnet-4", savings_percent: 90.0 }] }
```

## Features

- **Model Normalization** — `sonnet`, `claude-sonnet-4`, `anthropic/claude-sonnet-4` all resolve to the same model
- **Idempotency** — Pass `idempotency_key` to prevent duplicate cost logging
- **Hard Limit Signaling** — Set `hard_limit_usd` to get alerts when spend exceeds threshold (fail-safe, not fail-stop)
- **Price Snapshots** — Each event stores the price at time of logging; historical costs never change
- **Budget Projection** — Predicts end-of-period spend based on daily average
- **Alternative Suggestions** — `cost_estimate` recommends cheaper models in same capability tier

## Deployment

### Prerequisites

- Node.js 18+
- Cloudflare account with Workers enabled
- Wrangler CLI (`npm install -g wrangler`)

### Deploy

```bash
# Install dependencies
npm install

# Login to Cloudflare
wrangler login

# Create KV namespace
wrangler kv:namespace create COSTRACK_EVENTS
# Update wrangler.toml with the returned namespace ID

# Deploy
wrangler deploy
```

### Local Development

```bash
npm run dev
```

### Type Check

```bash
npm run build
```

## Architecture

- **Runtime:** Cloudflare Workers (TypeScript)
- **Storage:** Hybrid — Durable Objects (real-time aggregations) + KV (raw event audit trail)
- **Protocol:** MCP (Model Context Protocol) over Streamable HTTP
- **Pricing:** Built-in table, single-file source of truth (`src/pricing/pricing-table.ts`)

## Configuration

Edit `wrangler.toml` to set:
- `COSTRACK_EVENTS` KV namespace ID (Rich fills in after `wrangler kv:namespace create`)
- Production environment variables

## Project Structure

```
costrack-mcp/
├── src/
│   ├── tools/           # 6 tool implementations
│   ├── pricing/         # Pricing data + model aliases
│   ├── normalize/       # Model name normalization
│   ├── storage/         # Durable Object + KV + DO client
│   ├── utils/           # Cost calculator, tier check
│   ├── types/           # Shared TypeScript types
│   ├── index.ts         # MCP server core
│   └── worker.ts        # Cloudflare Workers entry point
├── wrangler.toml        # CF Workers config
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
