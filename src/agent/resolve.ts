import type { Category, Call } from "./types.ts";
import type { Chain } from "../dag/types.ts";

type CallBase = Omit<Call, "phase" | "category">;

//TODO: this should be a self-discovery, no hard-coded endpoints anywhere. we can cache costs
const CATEGORY_MAP: Record<Category, CallBase> = {
  sanctions: { provider: "bazaar/ofac", endpoint: "bazaar/ofac", estimatedCostUsdc: 0.001 },
  labels: { provider: "bazaar/labels", endpoint: "bazaar/labels", estimatedCostUsdc: 0.0008 },
  onchain_history: { provider: "etherscan", endpoint: "etherscan", estimatedCostUsdc: 0.0007 },
  web_sentiment: { provider: "bazaar/web-search", endpoint: "bazaar/web-search", estimatedCostUsdc: 0.0005 },
  ens: { provider: "viem/public-rpc", endpoint: "ens-reverse", estimatedCostUsdc: 0 },
  contract_analysis: { provider: "bazaar/contract", endpoint: "bazaar/contract", estimatedCostUsdc: 0.003 },
};

const ENDPOINT_ENV_MAP: Record<Exclude<Category, "ens">, string> = {
  sanctions: "BAZAAR_OFAC_URL",
  labels: "BAZAAR_LABELS_URL",
  web_sentiment: "BAZAAR_WEB_SEARCH_URL",
  contract_analysis: "BAZAAR_CONTRACT_URL",
  onchain_history: "ETHERSCAN_X402_URL",
};

export function resolveEndpointUrl(category: Exclude<Category, "ens">): string {
  const envVar = ENDPOINT_ENV_MAP[category];
  const url = Deno.env.get(envVar) ?? "";
  if (!url) {
    throw new Error(
      `Endpoint URL not configured for category "${category}". Set ${envVar} env var.`,
    );
  }
  return url;
}

export function resolveBazaarEndpoints(
  categories: Category[],
  _chain: Chain,
): Call[] {
  return categories.map((category) => {
    const base = CATEGORY_MAP[category];
    return { ...base, category, phase: 1 } as Call;
  });
}
