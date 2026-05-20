import { Hono } from "hono";
import { zValidator } from "hono/zod-validator";
import { RiskReportSchema, VerifyRequestSchema } from "../dag/types.ts";
import { runDag } from "../dag/runner.ts";

const verifyRouter = new Hono();

verifyRouter.post("/", zValidator("json", VerifyRequestSchema), async (c) => {
  const req = c.req.valid("json");

  const results = await runDag(req);

  const synthesisResult = results["synthesis"];
  if (!synthesisResult || synthesisResult.error) {
    return c.json(
      { error: synthesisResult?.error ?? "Synthesis node failed" },
      500,
    );
  }

  const parsed = RiskReportSchema.safeParse(synthesisResult.data);
  if (!parsed.success) {
    return c.json({ error: "Risk report failed schema validation", details: parsed.error }, 500);
  }

  return c.json(parsed.data);
});

export { verifyRouter };
