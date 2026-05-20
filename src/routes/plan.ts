import { Hono } from "hono";
import { zValidator } from "hono/zod-validator";
import { z } from "zod";
import { ChainSchema, type PlanResponse } from "../dag/types.ts";

const planQuerySchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address"),
  chain: ChainSchema,
});

const planRouter = new Hono();

// Static DAG definition — no side effects, no payments made.
const DAG_DEFINITION = [
  {
    id: "preflight",
    name: "EOA vs Contract check",
    description: "Determines if the address is an externally-owned account or a smart contract via RPC.",
    estimatedCostUsdc: "0.0000",
    deps: [],
    provider: "viem/public-rpc",
  },
  {
    id: "sanctions",
    name: "OFAC/SDN sanctions screening",
    description: "Checks the address against OFAC Specially Designated Nationals and other sanctions lists.",
    estimatedCostUsdc: "0.0010",
    deps: ["preflight"],
    provider: "bazaar/ofac",
  },
  {
    id: "web_search",
    name: "Web sentiment search",
    description: "Searches for social and news signals associating the address with scams, hacks, or exploits.",
    estimatedCostUsdc: "0.0005",
    deps: ["preflight"],
    provider: "bazaar/web-search",
  },
  {
    id: "onchain",
    name: "On-chain history",
    description: "Retrieves transaction count, wallet age, total volume, and known counterparties via Etherscan.",
    estimatedCostUsdc: "0.0007",
    deps: ["preflight"],
    provider: "etherscan",
  },
  {
    id: "ens",
    name: "ENS label lookup",
    description: "Resolves ENS reverse-lookup and checks for known protocol or exchange labels.",
    estimatedCostUsdc: "0.0000",
    deps: ["preflight"],
    provider: "viem/ens",
  },
  {
    id: "synthesis",
    name: "LLM risk synthesis",
    description: "Aggregates all signals into a structured risk report using an LLM with schema validation.",
    estimatedCostUsdc: "0.0010",
    deps: ["sanctions", "web_search", "onchain", "ens"],
    provider: "openrouter",
  },
];

const TOTAL_COST = DAG_DEFINITION.reduce(
  (sum, node) => sum + parseFloat(node.estimatedCostUsdc),
  0,
).toFixed(4);

planRouter.get("/", zValidator("query", planQuerySchema), (c) => {
  const { address, chain } = c.req.valid("query");

  const response: PlanResponse = {
    address,
    chain,
    estimatedTotalCostUsdc: TOTAL_COST,
    dag: DAG_DEFINITION,
  };

  return c.json(response);
});

export { planRouter };
