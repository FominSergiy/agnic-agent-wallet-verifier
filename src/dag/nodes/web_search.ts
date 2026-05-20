import type { NodeResult, VerifyRequest } from "../types.ts";

// Searches for social/news signals about the wallet address (scam reports, hacks, etc.)
// TODO: replace stub with real x402 Bazaar web search API call.
export async function runWebSearch(
  req: VerifyRequest,
  _deps: Record<string, NodeResult>,
): Promise<NodeResult> {
  console.log(`[web_search] sentiment search for ${req.address} (STUB — Bazaar x402 not wired)`);

  await delay(80);

  return {
    nodeId: "web_search",
    data: {
      query: `${req.address} scam hack exploit`,
      results: [],
      sentiment: "neutral",
      provider: "bazaar/web-search-stub",
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
