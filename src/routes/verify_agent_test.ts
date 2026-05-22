import { assertEquals } from "@std/assert";
import { Hono } from "hono";
import { verifyAgentRouter } from "./verify_agent.ts";
import { WalletVerdictSchema } from "../agent/verdict.ts";

function buildApp(): Hono {
  const app = new Hono();
  app.route("/verify-agent", verifyAgentRouter);
  return app;
}

Deno.test("POST /verify-agent rejects malformed address with 400", async () => {
  const app = buildApp();
  const res = await app.request("/verify-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address: "not-an-address", chain: "base" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("POST /verify-agent rejects unknown chain with 400", async () => {
  const app = buildApp();
  const res = await app.request("/verify-agent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      address: "0x9dd5e3a608Ba321C5205688d66E11e81B67e08c2",
      chain: "bitcoin",
    }),
  });
  assertEquals(res.status, 400);
});

// === END-TO-END test (hits real CDP + agnic + real x402 payments + real Opus). ===
// Run with: RUN_E2E=1 ~/.deno/bin/deno test --allow-net --allow-env src/routes/verify_agent_test.ts
// Costs ~$0.01–0.05 USDC per run (x402 spend + LLM call costs).
Deno.test({
  name: "POST /verify-agent end-to-end for funded mainnet wallet",
  ignore: !Deno.env.get("RUN_E2E"),
  fn: async () => {
    const app = buildApp();
    const res = await app.request("/verify-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: "0x9dd5e3a608Ba321C5205688d66E11e81B67e08c2",
        chain: "base",
      }),
    });
    const body = await res.json();
    console.log("E2E /verify-agent response:", JSON.stringify(body, null, 2));

    assertEquals(res.status, 200);

    // Parse the verdict shape with zod — that's our schema contract.
    const verdict = WalletVerdictSchema.parse(body.verdict);
    assertEquals(typeof verdict.safe, "boolean");
    assertEquals(
      ["safe_to_transact", "do_not_transact", "insufficient_data"].includes(verdict.verdict),
      true,
    );
    assertEquals(verdict.coverage.resolved.length >= 1, true);
    assertEquals(
      typeof body.totalSpentUsdc === "number" && body.totalSpentUsdc < 0.05,
      true,
    );
    assertEquals(body.walletNetwork, "base");
  },
});
