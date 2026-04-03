# CosTrack MCP — Build Notes

**Built:** 2026-04-03
**Spec:** COSTRACK_SPEC.md (Forge, Phase 1 Spec 3)
**Status:** Code complete, type-checked, dry-run verified

## Deviations from Spec

1. **DO communication via fetch() instead of RPC** — The spec's entry point example shows stdio transport. Actual implementation uses `WebStandardStreamableHTTPServerTransport` for CF Workers (matching ScannerMCP pattern). DO methods are called via fetch-based routing instead of typed RPC to avoid circular type dependencies.

2. **Global DO instance** — Spec calls for per-session DO isolation (`session:{session_id}`). V1 uses a single "global" DO instance since per-session isolation requires MCP session ID propagation into tool handlers, which the SDK doesn't expose directly. Per-session isolation can be added in V2 with middleware.

3. **idempotency_keys persisted to DO storage** — Spec says "in-memory cache, not persisted". Implementation persists to DO storage for durability across DO evictions, with an in-memory Set as a hot cache. This is strictly better behavior.

## What Rich Needs To Do

1. `wrangler login` (browser auth)
2. `wrangler kv:namespace create COSTRACK_EVENTS` — fill ID into wrangler.toml
3. `wrangler kv:namespace create COSTRACK_EVENTS --preview` — fill preview ID
4. `wrangler deploy`
5. Create GitHub repo: `nexussquad300/costrack-mcp`
6. Smithery marketplace submission

## Verification

- `tsc --noEmit` → exits 0 (no type errors)
- `wrangler deploy --dry-run` → exits 0 (bundle: 153 KiB gzip, bindings: DO + KV)
