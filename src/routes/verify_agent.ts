import { Hono } from "hono";
import { zValidator } from "hono/zod-validator";
import { z } from "zod";
import { VerifyRequestSchema } from "../dag/types.ts";
import { verifyAgent } from "../agent/verify.ts";
import {
  DiscoveryFetchError,
  WalletUnfundedError,
} from "../discovery/types.ts";
import { SanctionsInvocationError } from "../agent/invoke_all.ts";

const VerifyAgentRequestSchema = VerifyRequestSchema.extend({
  budgetCeiling: z.number().positive().optional(),
});

const verifyAgentRouter = new Hono();

verifyAgentRouter.post("/", zValidator("json", VerifyAgentRequestSchema), async (c) => {
  const { budgetCeiling, ...req } = c.req.valid("json");
  try {
    const result = await verifyAgent(req, { budgetCeiling });
    if (result.mode === "discovery") {
      return c.json({
        verdict: result.verdict,
        plan: {
          services: result.plan.services.map((s) => ({
            category: s.category,
            resource: s.resource,
            priceUsdc: s.priceUsdc,
            rationale: s.rationale,
          })),
        },
        receipts: result.outcomes.map((o) => ({
          category: o.category,
          resource: o.resource,
          status: o.status,
          adapterPath: o.adapterPath,
          amountUsdc: o.amountUsdc,
          durationMs: o.durationMs,
          paid: o.paid,
          error: o.error,
        })),
        walletNetwork: result.walletNetwork,
        totalSpentUsdc: result.totalSpentUsdc,
      });
    }
    // Legacy path response shape (unchanged from before).
    return c.json({ report: result.report, ctx: result.ctx });
  } catch (e) {
    if (e instanceof WalletUnfundedError) {
      return c.json({
        error: "wallet_unfunded",
        message: e.message,
        baseAddress: e.baseAddress,
        baseSepoliaAddress: e.baseSepoliaAddress,
      }, 402);
    }
    if (e instanceof SanctionsInvocationError) {
      return c.json({
        error: "sanctions_invocation_failed",
        message: e.message,
      }, 502);
    }
    if (e instanceof DiscoveryFetchError) {
      return c.json({
        error: "discovery_upstream_failed",
        message: e.message,
        status: e.status,
        url: e.url,
      }, 502);
    }
    if (e instanceof Error && e.message.includes("AGNIC_API_KEY")) {
      return c.json({ error: "missing_config", message: e.message }, 500);
    }
    throw e;
  }
});

export { verifyAgentRouter };
