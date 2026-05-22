import { z } from "zod";

export const ChainSchema = z.enum(["eth", "base", "polygon", "arbitrum", "optimism"]);
export type Chain = z.infer<typeof ChainSchema>;

export const VerifyRequestSchema = z.object({
  address: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address"),
  chain: ChainSchema,
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const DAGNodeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  estimatedCostUsdc: z.string(),
  deps: z.array(z.string()),
  provider: z.string(),
});
export type DAGNode = z.infer<typeof DAGNodeSchema>;

export const PlanResponseSchema = z.object({
  address: z.string(),
  chain: ChainSchema,
  estimatedTotalCostUsdc: z.string(),
  dag: z.array(DAGNodeSchema),
});
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const SignalSchema = z.object({
  source: z.string(),
  finding: z.string(),
  severity: z.enum(["info", "low", "medium", "high", "critical"]),
});
export type Signal = z.infer<typeof SignalSchema>;

export const RiskReportSchema = z.object({
  address: z.string(),
  chain: ChainSchema,
  riskScore: z.number().min(0).max(100),
  riskLabel: z.enum(["safe", "low", "medium", "high", "critical"]),
  sanctioned: z.boolean(),
  labels: z.array(z.string()),
  signals: z.array(SignalSchema),
  summary: z.string(),
  recommendation: z.enum(["proceed", "caution", "block"]),
  generatedAt: z.string(),
}).describe("RiskReport");
export type RiskReport = z.infer<typeof RiskReportSchema>;

export interface NodeResult {
  nodeId: string;
  data: Record<string, unknown>;
  error?: string;
}
