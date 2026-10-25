import { z } from "zod";
import { body, noContent, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { react } from "@/lib/community";

/** Heart, applause or "strong"; null removes the reaction (COM-04). */
export const PUT = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  rateLimit(`react:${user.id}`, 120, 60_000);
  const { id } = await context.params;
  const { kind } = await body(request, z.object({ kind: z.enum(["heart", "clap", "strong"]).nullable() }));
  await react(user.id, z.uuid().parse(id), kind);
  return noContent();
});
