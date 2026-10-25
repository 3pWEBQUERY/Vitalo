import { z } from "zod";
import { body, ok, rateLimit, route } from "@/lib/api";
import { analyzeText } from "@/lib/ai";
import { requireUser } from "@/lib/auth";

/** "2 Spiegeleier mit Toast und Kaffee mit Milch" → foods with amount ranges, matched to the database. */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`ai:${user.id}`, 10, 60_000);
  const { text } = await body(request, z.object({ text: z.string().trim().min(2).max(1000), locale: z.string().max(10).optional() }));
  return ok(await analyzeText(user, text));
});
