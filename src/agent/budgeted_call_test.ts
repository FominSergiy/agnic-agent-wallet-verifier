import { assertEquals } from "@std/assert";
import type { Call, AgentCtx } from "./types.ts";
import { budgetedCall, x402Invoker, type Invoker } from "./budgeted_call.ts";

function makeCall(overrides: Partial<Call> = {}): Call {
  return {
    category: "sanctions",
    provider: "bazaar/ofac",
    endpoint: "bazaar/ofac",
    estimatedCostUsdc: 0.001,
    phase: 1,
    ...overrides,
  };
}

function makeCtx(overrides: Partial<AgentCtx> = {}): AgentCtx {
  return { address: "0x0", chain: "eth", spent: 0, receipts: [], findings: {}, ...overrides };
}

Deno.test("budgetedCall success", async () => {
  const invoker: Invoker = () => Promise.resolve({ data: { ok: true }, amountUsdc: 0.001 });
  const outcome = await budgetedCall(makeCall(), makeCtx(), 1, invoker);
  assertEquals(outcome.receipt.status, "ok");
  assertEquals(outcome.receipt.amountUsdc, 0.001);
  assertEquals(outcome.receipt.callId, "sanctions:bazaar/ofac");
});

Deno.test("budgetedCall retries 3 times on error", async () => {
  let count = 0;
  const invoker: Invoker = () => {
    count++;
    return Promise.reject(new Error("oops"));
  };
  const outcome = await budgetedCall(makeCall(), makeCtx(), 1, invoker, 5000, [0, 0]);
  assertEquals(outcome.receipt.status, "error");
  assertEquals(outcome.receipt.error, "oops");
  assertEquals(count, 3);
});

Deno.test("budgetedCall timeout", async () => {
  const invoker: Invoker = () => new Promise(() => {});
  const outcome = await budgetedCall(makeCall(), makeCtx(), 1, invoker, 50, []);
  assertEquals(outcome.receipt.status, "timeout");
  assertEquals(outcome.data, null);
});

Deno.test("budgetedCall budget skip", async () => {
  let called = false;
  const invoker: Invoker = () => {
    called = true;
    return Promise.resolve({ data: {}, amountUsdc: 0 });
  };
  const outcome = await budgetedCall(
    makeCall({ estimatedCostUsdc: 0.001 }),
    makeCtx({ spent: 0.05 }),
    0.05,
    invoker,
  );
  assertEquals(outcome.receipt.status, "skipped_budget");
  assertEquals(called, false);
});

Deno.test("budgetedCall retry then succeed", async () => {
  let count = 0;
  const invoker: Invoker = () => {
    count++;
    if (count < 3) return Promise.reject(new Error("fail"));
    return Promise.resolve({ data: { ok: true }, amountUsdc: 0.001 });
  };
  const outcome = await budgetedCall(makeCall(), makeCtx(), 1, invoker, 5000, [0, 0]);
  assertEquals(outcome.receipt.status, "ok");
  assertEquals(count, 3);
});

Deno.test("x402Invoker: calls agnicFetch with correct URL and body for sanctions", async () => {
  Deno.env.set("AGNIC_API_KEY", "test-key");
  Deno.env.set("BAZAAR_OFAC_URL", "https://bazaar.example.com/ofac");
  const orig = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody = "";
  globalThis.fetch = async (url, init) => {
    capturedUrl = url.toString();
    capturedBody = typeof (init as { body?: unknown })?.body === "string"
      ? (init as { body: string }).body
      : "";
    return new Response(JSON.stringify({ sanctioned: false }), {
      status: 200,
      headers: { "X-Agnic-Paid": "true", "X-Agnic-Amount": "0.001" },
    });
  };
  try {
    const result = await x402Invoker(makeCall({ category: "sanctions" }), makeCtx({ address: "0xABC" }));
    assertEquals(result.paid, true);
    assertEquals(result.amountUsdc, 0.001);
    assertEquals(capturedUrl.includes("bazaar.example.com"), true);
    assertEquals(JSON.parse(capturedBody).address, "0xABC");
  } finally {
    globalThis.fetch = orig;
    Deno.env.delete("AGNIC_API_KEY");
    Deno.env.delete("BAZAAR_OFAC_URL");
  }
});

Deno.test("x402Invoker: receipt uses actual cost not estimate", async () => {
  Deno.env.set("AGNIC_API_KEY", "test-key");
  Deno.env.set("BAZAAR_OFAC_URL", "https://bazaar.example.com/ofac");
  const orig = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({}), {
      status: 200,
      // actual cost is half the estimate
      headers: { "X-Agnic-Paid": "true", "X-Agnic-Amount": "0.0005" },
    });
  try {
    const result = await x402Invoker(
      makeCall({ category: "sanctions", estimatedCostUsdc: 0.001 }),
      makeCtx(),
    );
    assertEquals(result.amountUsdc, 0.0005);
  } finally {
    globalThis.fetch = orig;
    Deno.env.delete("AGNIC_API_KEY");
    Deno.env.delete("BAZAAR_OFAC_URL");
  }
});

Deno.test("x402Invoker: ens skips agnicFetch and returns paid=false", async () => {
  const orig = globalThis.fetch;
  let fetchCalled = false;
  globalThis.fetch = async () => {
    fetchCalled = true;
    return new Response("", { status: 200 });
  };
  try {
    const result = await x402Invoker(makeCall({ category: "ens", estimatedCostUsdc: 0 }), makeCtx());
    assertEquals(result.paid, false);
    assertEquals(result.amountUsdc, 0);
    assertEquals(fetchCalled, false);
  } finally {
    globalThis.fetch = orig;
  }
});

Deno.test("x402Invoker: payment error propagates to budgetedCall as status=error", async () => {
  Deno.env.set("AGNIC_API_KEY", "test-key");
  Deno.env.set("BAZAAR_OFAC_URL", "https://bazaar.example.com/ofac");
  const orig = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: "payment_exceeds_max", error_description: "too high" }), {
      status: 400,
    });
  try {
    const outcome = await budgetedCall(makeCall(), makeCtx(), 1, x402Invoker, 5000, []);
    assertEquals(outcome.receipt.status, "error");
    assertEquals(outcome.receipt.error?.includes("payment_exceeds_max"), true);
  } finally {
    globalThis.fetch = orig;
    Deno.env.delete("AGNIC_API_KEY");
    Deno.env.delete("BAZAAR_OFAC_URL");
  }
});
