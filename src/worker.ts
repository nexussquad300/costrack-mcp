/**
 * Cloudflare Workers entry point for CosTrack MCP.
 * Stateless per-request pattern — new transport per request.
 */
import { createServer, setEnv } from "./index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Env } from "./types/index.js";

// Re-export the Durable Object class so wrangler can find it
export { CostAggregator } from "./storage/aggregator-do.js";

function corsHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, mcp-session-id, Accept",
    ...extra,
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    setEnv(env);

    const url = new URL(request.url);

    // Health check
    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response(
        JSON.stringify({ status: "ok", name: "costrack-mcp", version: "1.0.0" }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // Smithery server card
    if (request.method === "GET" && url.pathname === "/.well-known/mcp/server-card.json") {
      return new Response(
        JSON.stringify({
          name: "costrack-mcp",
          description: "Agent Cost Control Layer — Track, analyze, and control LLM and agent operational costs. 6 tools: log costs, generate reports, compare models, check budgets with projections, estimate costs, and browse pricing for 17+ models.",
          version: "1.0.0",
          tools: [
            { name: "cost_log", description: "Record a cost event (LLM call, tool invocation, or custom cost)" },
            { name: "cost_report", description: "Generate cost summary by scope and time period" },
            { name: "cost_compare", description: "Compare costs between models, agents, or periods" },
            { name: "budget_check", description: "Check spend vs budget with daily projection" },
            { name: "cost_estimate", description: "Estimate cost before execution with alternative recommendations" },
            { name: "pricing_table", description: "Browse current pricing for 17+ models across 5 providers" }
          ],
          connection: {
            type: "streamable-http",
            url: "https://costrack-mcp.nexus300.workers.dev/mcp"
          }
        }),
        { headers: { ...corsHeaders(), "Content-Type": "application/json" } }
      );
    }

    // MCP endpoint
    if (url.pathname === "/mcp" || url.pathname === "/") {
      // Create fresh transport + server per request (stateless Workers pattern)
      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined as any,
        enableJsonResponse: true,
      });

      const server = createServer();
      await server.connect(transport);

      // Ensure Accept header includes required types (Smithery scanner fix)
      const headers = new Headers(request.headers);
      if (!headers.get("Accept")?.includes("text/event-stream")) {
        headers.set("Accept", "application/json, text/event-stream");
      }
      const patchedRequest = new Request(request.url, {
        method: request.method,
        headers,
        body: request.body,
        duplex: "half",
      } as any);

      const response = await transport.handleRequest(patchedRequest);
      const newHeaders = new Headers(response.headers);
      for (const [k, v] of Object.entries(corsHeaders())) newHeaders.set(k, v);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: newHeaders,
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
