import type { NodeResult, VerifyRequest } from "./types.ts";
import { runPreflight } from "./nodes/preflight.ts";
import { runSanctions } from "./nodes/sanctions.ts";
import { runWebSearch } from "./nodes/web_search.ts";
import { runOnchain } from "./nodes/onchain.ts";
import { runEns } from "./nodes/ens.ts";
import { runSynthesis } from "./nodes/synthesis.ts";

type NodeRunner = (req: VerifyRequest, deps: Record<string, NodeResult>) => Promise<NodeResult>;

const NODE_RUNNERS: Record<string, NodeRunner> = {
  preflight: runPreflight,
  sanctions: runSanctions,
  web_search: runWebSearch,
  onchain: runOnchain,
  ens: runEns,
  synthesis: runSynthesis,
};

const NODE_DEPS: Record<string, string[]> = {
  preflight: [],
  sanctions: ["preflight"],
  web_search: ["preflight"],
  onchain: ["preflight"],
  ens: ["preflight"],
  synthesis: ["sanctions", "web_search", "onchain", "ens"],
};

// Runs nodes in topological order, parallelising nodes with the same dep-depth.
export async function runDag(req: VerifyRequest): Promise<Record<string, NodeResult>> {
  const completed: Record<string, NodeResult> = {};
  const remaining = new Set(Object.keys(NODE_RUNNERS));

  while (remaining.size > 0) {
    const ready = [...remaining].filter((id) =>
      NODE_DEPS[id].every((dep) => dep in completed)
    );

    if (ready.length === 0) {
      throw new Error("DAG cycle detected or unresolvable dependency");
    }

    const results = await Promise.all(
      ready.map((id) => NODE_RUNNERS[id](req, completed))
    );

    for (const result of results) {
      completed[result.nodeId] = result;
      remaining.delete(result.nodeId);
    }
  }

  return completed;
}
