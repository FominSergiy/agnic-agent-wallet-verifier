# X402 Payment Integration

**What:** Routes every paid agent-loop API call through Agnic's `/api/x402/fetch` proxy, which handles EIP-712 signing and on-chain settlement transparently — no private keys in this service.

**Files:** `src/clients/agnic.ts`, `src/clients/agnic_test.ts`, `src/agent/budgeted_call.ts`, `src/agent/resolve.ts`, `src/agent/types.ts`, `.env.example`

**Config:** `AGNIC_API_KEY` (required), `BAZAAR_OFAC_URL`, `BAZAAR_LABELS_URL`, `BAZAAR_WEB_SEARCH_URL`, `BAZAAR_CONTRACT_URL`, `ETHERSCAN_X402_URL`

**Notes:** Bazaar endpoint URLs are placeholders — fill in real URLs once available from the Bazaar platform. ENS category skips x402 (free viem call). `receipt.amountUsdc` now reflects actual cost from `X-Agnic-Amount` response header, not the pre-call estimate.
