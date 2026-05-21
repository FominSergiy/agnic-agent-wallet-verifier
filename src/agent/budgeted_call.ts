import type { Call, Receipt, AgentCtx } from "./types.ts";
import { agnicFetch } from "../clients/agnic.ts";
import { resolveEndpointUrl } from "./resolve.ts";
import { runEns } from "../dag/nodes/ens.ts";
import type { VerifyRequest } from "../dag/types.ts";

export interface CallOutcome {
  call: Call;
  data: unknown | null;
  receipt: Receipt;
}

export type Invoker = (
  call: Call,
  ctx: AgentCtx,
) => Promise<{ data: unknown; amountUsdc: number; txHash?: string; paid?: boolean; network?: string }>;

export const x402Invoker: Invoker = async (call, ctx) => {
  if (call.category === "ens") {
    const req: VerifyRequest = { address: ctx.address, chain: ctx.chain };
    const r = await runEns(req, {});
    return { data: r.data, amountUsdc: 0, paid: false };
  }
  const url = resolveEndpointUrl(call.category);
  const result = await agnicFetch(url, {
    method: "POST",
    body: { address: ctx.address, chain: ctx.chain },
    maxValueUsd: call.estimatedCostUsdc,
  });
  return {
    data: result.data,
    amountUsdc: result.amountUsd,
    paid: result.paid,
    network: result.network ?? undefined,
  };
};

export async function budgetedCall(
  call: Call,
  ctx: AgentCtx,
  budgetCeiling: number,
  invoker: Invoker = x402Invoker,
  timeoutMs = 5000,
  backoffsMs: number[] = [200, 800],
): Promise<CallOutcome> {
  const callId = `${call.category}:${call.provider}`;

  if (ctx.spent + call.estimatedCostUsdc > budgetCeiling) {
    return {
      call,
      data: null,
      receipt: { callId, amountUsdc: 0, durationMs: 0, status: "skipped_budget" },
    };
  }

  const start = Date.now();
  let lastError = "";
  const attempts = 1 + backoffsMs.length;

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, backoffsMs[attempt - 1]));
    }
    let timerId: ReturnType<typeof setTimeout> | undefined;
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timerId = setTimeout(() => reject(new Error("timeout")), timeoutMs);
      });
      const result = await Promise.race([invoker(call, ctx), timeoutPromise]);
      clearTimeout(timerId);
      return {
        call,
        data: result.data,
        receipt: {
          callId,
          amountUsdc: result.amountUsdc,
          txHash: result.txHash,
          paid: result.paid,
          network: result.network,
          durationMs: Date.now() - start,
          status: "ok",
        },
      };
    } catch (err) {
      clearTimeout(timerId);
      lastError = err instanceof Error ? err.message : String(err);
      if (lastError === "timeout") {
        return {
          call,
          data: null,
          receipt: {
            callId,
            amountUsdc: 0,
            durationMs: Date.now() - start,
            status: "timeout",
            error: "timeout",
          },
        };
      }
    }
  }

  return {
    call,
    data: null,
    receipt: {
      callId,
      amountUsdc: 0,
      durationMs: Date.now() - start,
      status: "error",
      error: lastError,
    },
  };
}
