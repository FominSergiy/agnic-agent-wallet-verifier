import type { NodeResult, VerifyRequest } from "../types.ts";

// Fetches on-chain history: tx count, wallet age, volume, counterparties.
// TODO: replace stub with Etherscan API call (direct key or x402-wrapped).
export async function runOnchain(
  req: VerifyRequest,
  _deps: Record<string, NodeResult>,
): Promise<NodeResult> {
  console.log(`[onchain] history for ${req.address} on ${req.chain} (STUB — Etherscan not wired)`);

  await delay(100);

  return {
    nodeId: "onchain",
    data: {
      firstSeenBlock: null,
      txCount: null,
      totalValueEth: null,
      knownCounterparties: [],
      provider: "etherscan-stub",
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
