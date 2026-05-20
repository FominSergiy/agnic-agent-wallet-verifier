import type { NodeResult, VerifyRequest } from "../types.ts";

// Checks address against OFAC/SDN sanctions list via Bazaar compliance API.
// TODO: replace stub with real x402 Bazaar sanctions call.
export async function runSanctions(
  req: VerifyRequest,
  _deps: Record<string, NodeResult>,
): Promise<NodeResult> {
  console.log(`[sanctions] OFAC check for ${req.address} (STUB — Bazaar x402 not wired)`);

  await delay(50);

  return {
    nodeId: "sanctions",
    data: {
      sanctioned: false,
      matchedLists: [],
      provider: "bazaar/ofac-stub",
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
