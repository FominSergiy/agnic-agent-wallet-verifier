# labels-registry-hybrid

**What:** Adds a single hardcoded supplementary source (`https://eth-labels.com/labels/<address>`, dawsbot/eth-labels' free public mirror of the Etherscan label cloud) on top of x402 self-discovery. The registry call runs in parallel with the x402 labels invocation and the ENS resolver, then merges into `findings.labels` as `{ x402_result, registry }` (mirroring how the Chainalysis oracle merges into `findings.sanctions`). Synthesis is told to weigh both equally.

## Files

**Added:**
- `src/agent/labels_registry.ts` — typed fetcher (5s timeout, injectable fetcher for tests, normalizes the response into a stable `RegistryResult` shape, throws `LabelsRegistryError` on any failure).
- `src/agent/labels_registry_test.ts` — 7 unit tests: happy path, empty array, `{"error":...}` rejection, non-200, non-JSON, abort/timeout, malformed-entry filtering.

**Modified:**
- `src/agent/verify.ts` — adds `fetchLabelsRegistry` to imports + `_testHooks`; gates on `categories.includes("labels")`; runs as the 3rd promise in the parallel block alongside `invokeAllFn` and the ENS resolver; on success merges into `findings.labels` and pulls `"labels"` out of `unresolved`; on failure swallows + emits a warn-level event.
- `src/agent/verify_test.ts` — 4 new named tests: `registry_merges_into_findings_labels_when_x402_succeeds`, `registry_rescues_labels_when_x402_fails`, `registry_failure_is_swallowed_and_does_not_block_verdict`, `registry_skipped_when_labels_category_not_requested`.
- `src/agent/synthesize_verdict.ts` — extends rule-2 ("labels — STRONG") in `PROMPT_PREAMBLE`: documents the three possible `findings.labels` shapes, adds a STRONG POSITIVE ATTRIBUTION rule for known-CEX/known-safe registry entries (allows confidence=`high` when combined with sanctions-clean even if x402 labels were empty), adds a registry-negative blocklist (`blocked`, `ofac-sanctioned`, `ofac-sanctions-lists`, `tornado-cash`, `darknet`, `phishing`, `scam`, `hacker`, `exploiter`).
- `src/agent/synthesize_verdict_test.ts` — 3 new tests asserting the new prompt scaffolding (`cex_registry_attribution_serialized_into_prompt`, `registry_negative_label_serialized_into_prompt`, `prompt_documents_registry_rules_and_shape`).
- `docs/agent-log.md` — appended row.

## Config

No new env vars. No API key. Single hardcoded URL: `https://eth-labels.com/labels/<address>` (chain-agnostic — the endpoint returns labels across all 8 EVM chains it indexes, and we pass our `chain` value through for traceability only).

External dependency added: `eth-labels.com` reachability. Failure mode is non-blocking — `verifyAgent` swallows the throw and proceeds with x402 + ENS as before.

## Validation (v8 e2e vs v7 baseline)

Ran `scripts/test_wallets.ts` against the 9-wallet fixture set (worktree dev server on port 8001, since 8000 was held by an unrelated process):

| Wallet | v7 verdict / conf | v8 verdict / conf | Delta |
|---|---|---|---|
| Vitalik (vitalik.eth) | safe / high | safe / high | — |
| Binance HW20 | safe / high | safe / high | — |
| Lazarus | do_not / high | do_not / high | — (oracle short-circuit) |
| Tornado Router | do_not / high | do_not / high | — |
| **Coinbase 1** | safe / **medium** | safe / **high** | **↑ registry-attributed** |
| **Kraken 4** | safe / **medium** | safe / **high** | **↑ registry-attributed** |
| OFAC SDN deposit | do_not / high | do_not / high | — (oracle short-circuit) |
| nick.eth | safe / high | safe / high | — |
| Synthetic fresh | insufficient / low | insufficient / low | — (correct) |

- Strict-match accuracy: **9/9** (same as v7).
- Confidence uplifts: **+2** (Coinbase 1, Kraken 4). Opus's per-wallet reasoning on both explicitly cites the eth-labels registry attribution.
- Regressions: **0**.
- Spend: $0.1218 → **$0.0753** (-38%); cause is a one-off catalog price drift on the Orbis reputation service that is unrelated to this change.
- Wall-clock: 301s → 379s (most of the +78s is one Vitalik `web_sentiment` hard-error + LLM-adapter retry, also unrelated; registry per-call overhead is ≤1s).

Per-wallet receipts: `docs/real-wallet-tests/runs_v8/`. Report: `docs/real-wallet-tests/report_v8.md`. Side-by-side diff: `docs/real-wallet-tests/comparison_v7_v8.md`.

## Notes / gotchas

- **Reverses the v7 self-discovery-purity stance** explicitly and on purpose, per user instruction ("hybrid approach of self-discovery + known urls with good quality signals — both should exist, not one over the other"). The previous run's analysis flagged this gap and accepted it; this change accepts the trade-off in the opposite direction.
- **Registry never short-circuits.** Unlike the Chainalysis oracle (which short-circuits to `do_not_transact` on `isSanctioned=true`), the registry only contributes evidence to the synthesis prompt. Both layers always run end-to-end so the self-discovery story stays intact.
- **No new `Category`.** Registry data lives inside the existing `labels` category. Coverage accounting unchanged.
- **Endpoint is case-insensitive on address; address is echoed lowercased in the response.** We pass through whatever casing the caller used.
- **Initial e2e run wasted** because port 8000 was already held by an unrelated deno process, so the harness hit v7 code; mitigation in dev now is to run on `PORT=8001` (or kill the prior process) and pass `VERIFY_AGENT_URL=http://localhost:8001/verify-agent` to `test_wallets.ts`.
- **Pre-existing lint warning** in `web/vite.config.ts` (`no-process-global`) is unrelated and was not touched.

## Follow-ups (not in scope)

- The eth-labels.com endpoint has no public SLA. If it becomes a hot path, consider a small bundled snapshot in-repo as a cold-cache fallback (we already verified the JSON shape and coverage for our fixtures, so a snapshot is trivial to build).
- The CEX allow-list inside `synthesize_verdict.ts` is hand-coded. As more registry-attributed wallets show up in production traffic, revisit whether the list should be derived from the registry's own `label` field rather than hardcoded.
