import type { NodeResult, VerifyRequest } from "../types.ts";
import { RiskReportSchema } from "../types.ts";
import { generateStructured } from "../../gateway.ts";

export async function runSynthesis(
  req: VerifyRequest,
  deps: Record<string, NodeResult>,
): Promise<NodeResult> {
  console.log(`[synthesis] generating risk report for ${req.address}`);

  const findings = {
    address: req.address,
    chain: req.chain,
    preflight: deps.preflight?.data,
    sanctions: deps.sanctions?.data,
    webSearch: deps.web_search?.data,
    onchain: deps.onchain?.data,
    ens: deps.ens?.data,
  };

  const prompt = `
You are a wallet risk-analysis agent. Given the following on-chain and off-chain signals,
produce a structured risk report for the wallet address ${req.address} on chain ${req.chain}.

Findings:
${JSON.stringify(findings, null, 2)}

Rules:
- riskScore 0 = completely safe, 100 = definitely malicious
- Set sanctioned=true only if matchedLists is non-empty
- recommendation must be "proceed" (<30), "caution" (30-69), or "block" (≥70)
- Keep summary under 100 words
- generatedAt must be an ISO 8601 timestamp
`.trim();

  const report = await generateStructured(RiskReportSchema, prompt);

  return {
    nodeId: "synthesis",
    data: report as unknown as Record<string, unknown>,
  };
}
