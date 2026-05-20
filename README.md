# agnic-agent-wallet-verifier

Backend service for autonomous-agent wallet risk verification. Given a wallet address and EVM chain, it orchestrates a DAG of data-collection calls and returns a structured risk report — so your agent can decide whether to proceed with a payment without needing a human to check Etherscan.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/plan?address=0x...&chain=eth` | Returns the verification DAG and estimated cost — **no payments made** |
| POST | `/verify` | Executes the DAG and returns a validated `RiskReport` |
| GET | `/health` | Liveness check |

## Quick start

```bash
cp .env.example .env
# fill in OPENROUTER_API_KEY

deno task dev
```

```bash
# Preview the plan (no payments)
curl "http://localhost:8000/plan?address=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045&chain=eth"

# Run verification
curl -X POST http://localhost:8000/verify \
  -H "Content-Type: application/json" \
  -d '{"address":"0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045","chain":"eth"}'
```

## Stack

- **Runtime**: Deno 2.x
- **Framework**: Hono
- **Validation**: Zod (`hono/zod-validator`)
- **LLM**: Vercel AI SDK + OpenRouter (`@openrouter/ai-sdk-provider`)
- **Hosting**: Deno Deploy

## DAG

```
preflight (EOA check)
    ├── sanctions (OFAC/SDN) ─────────────────┐
    ├── web_search (social sentiment) ─────────┤
    ├── onchain (Etherscan history) ───────────┤→ synthesis (LLM risk report)
    └── ens (ENS reverse lookup) ─────────────┘
```

Nodes within each tier run in parallel. Synthesis waits for all data nodes.

## Supported chains

`eth`, `base`, `polygon`, `arbitrum`, `optimism`

## Environment variables

See `.env.example`.

## Status

Skeleton phase — DAG nodes are stubs. x402/Bazaar payment calls will be wired once wallet is configured.
