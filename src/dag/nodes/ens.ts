import type { NodeResult, VerifyRequest } from "../types.ts";

// Resolves ENS reverse-lookup and checks for known protocol labels.
// TODO: replace stub with viem publicClient.getEnsName() on mainnet.
export async function runEns(
  req: VerifyRequest,
  _deps: Record<string, NodeResult>,
): Promise<NodeResult> {
  console.log(`[ens] reverse lookup for ${req.address} (STUB — viem not wired)`);

  await delay(30);

  return {
    nodeId: "ens",
    data: {
      ensName: null,
      labels: [],
      provider: "ens-stub",
    },
  };
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
