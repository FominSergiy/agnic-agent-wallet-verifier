import { assertEquals, assertThrows } from "@std/assert";
import { resolveBazaarEndpoints, resolveEndpointUrl } from "./resolve.ts";

Deno.test("resolveBazaarEndpoints returns correct providers", () => {
  const calls = resolveBazaarEndpoints(["sanctions", "ens"], "eth");
  assertEquals(calls.length, 2);
  assertEquals(calls[0].provider, "bazaar/ofac");
  assertEquals(calls[0].estimatedCostUsdc, 0.001);
  assertEquals(calls[1].estimatedCostUsdc, 0);
});

Deno.test("resolveBazaarEndpoints is deterministic", () => {
  const a = resolveBazaarEndpoints(["labels", "onchain_history"], "eth");
  const b = resolveBazaarEndpoints(["labels", "onchain_history"], "eth");
  assertEquals(JSON.stringify(a), JSON.stringify(b));
});

Deno.test("resolveBazaarEndpoints returns empty for empty input", () => {
  assertEquals(resolveBazaarEndpoints([], "eth"), []);
});

Deno.test("resolveBazaarEndpoints preserves input order", () => {
  const calls = resolveBazaarEndpoints(["ens", "sanctions"], "eth");
  assertEquals(calls[0].provider, "viem/public-rpc");
  assertEquals(calls[1].provider, "bazaar/ofac");
});

Deno.test("resolveEndpointUrl returns URL from env var", () => {
  Deno.env.set("BAZAAR_OFAC_URL", "https://bazaar.example.com/ofac");
  try {
    assertEquals(resolveEndpointUrl("sanctions"), "https://bazaar.example.com/ofac");
  } finally {
    Deno.env.delete("BAZAAR_OFAC_URL");
  }
});

Deno.test("resolveEndpointUrl covers all paid categories", () => {
  const categories = ["sanctions", "labels", "web_sentiment", "contract_analysis", "onchain_history"] as const;
  for (const cat of categories) {
    const envVar = {
      sanctions: "BAZAAR_OFAC_URL",
      labels: "BAZAAR_LABELS_URL",
      web_sentiment: "BAZAAR_WEB_SEARCH_URL",
      contract_analysis: "BAZAAR_CONTRACT_URL",
      onchain_history: "ETHERSCAN_X402_URL",
    }[cat];
    Deno.env.set(envVar, `https://example.com/${cat}`);
    try {
      assertEquals(resolveEndpointUrl(cat), `https://example.com/${cat}`);
    } finally {
      Deno.env.delete(envVar);
    }
  }
});

Deno.test("resolveEndpointUrl throws descriptive error when env var missing", () => {
  Deno.env.delete("BAZAAR_LABELS_URL");
  assertThrows(
    () => resolveEndpointUrl("labels"),
    Error,
    "BAZAAR_LABELS_URL",
  );
});
