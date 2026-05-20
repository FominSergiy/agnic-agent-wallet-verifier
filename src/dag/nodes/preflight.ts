import type { NodeResult, VerifyRequest } from "../types.ts";

// Determines if the address is an EOA or contract.
// TODO: replace stub with a real RPC call (e.g. eth_getCode via viem public client).
export async function runPreflight(
  req: VerifyRequest,
  _deps: Record<string, NodeResult>,
): Promise<NodeResult> {
  console.log(`[preflight] checking address type for ${req.address} on ${req.chain}`);

  await delay(20);

  return {
    nodeId: "preflight",
    data: {
      address: req.address,
      chain: req.chain,
      type: "eoa", // stub: assume EOA
      checksumAddress: req.address,
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
