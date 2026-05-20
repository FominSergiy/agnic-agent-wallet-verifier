import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, zodSchema } from "ai";
import { z } from "zod";

// Thin adapter layer. Swap the provider here when agnic gateway is ready —
// the DAG synthesis node only calls `generateStructured` and stays unchanged.

function getProvider() {
  const agnicKey = Deno.env.get("AGNIC_API_KEY");
  if (agnicKey) {
    // TODO: wire agnic provider when docs are available
    // return createAgnic({ apiKey: agnicKey });
    console.warn("[gateway] AGNIC_API_KEY set but agnic provider not yet wired — falling back to OpenRouter");
  }

  const openrouterKey = Deno.env.get("OPENROUTER_API_KEY");
  if (!openrouterKey) {
    throw new Error("No AI gateway configured. Set OPENROUTER_API_KEY or AGNIC_API_KEY.");
  }
  return createOpenRouter({ apiKey: openrouterKey });
}

const DEFAULT_MODEL = Deno.env.get("AI_MODEL") ?? "anthropic/claude-sonnet-4-6";

export async function generateStructured<T>(
  schema: z.ZodType<T>,
  prompt: string,
  model = DEFAULT_MODEL,
): Promise<T> {
  const provider = getProvider();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { object } = await generateObject({
    model: provider(model),
    // ai@4.3.x was compiled against zod v3 types; cast to satisfy overload
    schema: zodSchema(schema as unknown as Parameters<typeof zodSchema>[0]),
    prompt,
  });
  return object as T;
}
