import type { RiskReport, VerifyRequest } from "../dag/types.ts";
import { defaultLlm, type LlmClient } from "./llm.ts";
import type { AgentCtx, Category } from "./types.ts";
import { llmPlan } from "./plan.ts";
import { resolveBazaarEndpoints } from "./resolve.ts";
import { phaseGroups } from "./phases.ts";
import { budgetedCall } from "./budgeted_call.ts";
import { mergeResults } from "./merge.ts";
import { shouldStopEarly } from "./stop.ts";
import { llmSynthesize } from "./synthesize.ts";
import { discover } from "../discovery/discover.ts";
import { invokeAll } from "./invoke_all.ts";
import { synthesizeVerdict } from "./synthesize_verdict.ts";
import type { WalletVerdict } from "./verdict.ts";
import type { DiscoveryPlan, WalletNetwork } from "../discovery/types.ts";
import type { ServiceInvocationOutcome } from "./invoke_service.ts";

const DEFAULT_CATEGORIES: Category[] = [
  "sanctions",
  "labels",
  "onchain_history",
  "web_sentiment",
  "contract_analysis",
];

export interface DiscoveryVerifyResult {
  mode: "discovery";
  verdict: WalletVerdict;
  plan: DiscoveryPlan;
  outcomes: ServiceInvocationOutcome[];
  walletNetwork: WalletNetwork;
  totalSpentUsdc: number;
}

export interface LegacyVerifyResult {
  mode: "legacy";
  report: RiskReport;
  ctx: AgentCtx;
}

export type VerifyAgentResult = DiscoveryVerifyResult | LegacyVerifyResult;

export interface VerifyAgentOpts {
  budgetCeiling?: number;
  llm?: LlmClient;
  // Override the env-driven flag (mostly for tests).
  useDiscovery?: boolean;
  categories?: Category[];
}

function shouldUseDiscovery(opts: VerifyAgentOpts): boolean {
  if (opts.useDiscovery !== undefined) return opts.useDiscovery;
  // Default to discovery unless explicitly disabled.
  return Deno.env.get("USE_DISCOVERY") !== "false";
}

export async function verifyAgent(
  req: VerifyRequest,
  opts: VerifyAgentOpts = {},
): Promise<VerifyAgentResult> {
  if (shouldUseDiscovery(opts)) {
    return await verifyViaDiscovery(req, opts);
  }
  return await verifyViaLegacy(req, opts);
}

async function verifyViaDiscovery(
  req: VerifyRequest,
  opts: VerifyAgentOpts,
): Promise<DiscoveryVerifyResult> {
  const categories = opts.categories ?? DEFAULT_CATEGORIES;
  const llm = opts.llm;

  const plan = await discover(req.address, categories, { llm });
  const invocation = await invokeAll(plan, req.chain, { llm });

  const verdict = await synthesizeVerdict({
    address: req.address,
    chain: req.chain,
    findings: invocation.findings,
    coverage: {
      requested: categories,
      resolved: Object.keys(invocation.findings) as Category[],
      unresolved: invocation.unresolved,
    },
    totalSpentUsdc: invocation.totalSpentUsdc,
  }, { llm });

  return {
    mode: "discovery",
    verdict,
    plan,
    outcomes: invocation.outcomes,
    walletNetwork: invocation.walletNetwork,
    totalSpentUsdc: invocation.totalSpentUsdc,
  };
}

async function verifyViaLegacy(
  req: VerifyRequest,
  opts: VerifyAgentOpts,
): Promise<LegacyVerifyResult> {
  const budgetCeiling = opts.budgetCeiling ?? 0.05;
  const llm = opts.llm ?? defaultLlm;

  const ctx: AgentCtx = {
    address: req.address,
    chain: req.chain,
    spent: 0,
    receipts: [],
    findings: {},
  };

  const plan = await llmPlan(req.address, req.chain, llm);
  ctx.plan = plan;

  const calls = resolveBazaarEndpoints(plan.categories, req.chain);
  const phases = phaseGroups(calls);

  for (const phase of phases) {
    const outcomes = await Promise.allSettled(
      phase.map((call) => budgetedCall(call, ctx, budgetCeiling)),
    );
    mergeResults(ctx, outcomes);

    if (shouldStopEarly(ctx, plan.earlyStop, budgetCeiling)) {
      break;
    }
  }

  const report = await llmSynthesize(ctx, llm);
  return { mode: "legacy", report, ctx };
}
