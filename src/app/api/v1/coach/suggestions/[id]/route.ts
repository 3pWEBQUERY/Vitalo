import { z } from "zod";
import { body, notFound, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { decide } from "@/lib/coach";

export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const { id } = await context.params;
  const input = await body(request, z.object({ status: z.enum(["accepted", "dismissed"]), optionId: z.string().max(40).optional() }));
  const updated = await decide(user.id, z.uuid().parse(id), input.status, input.optionId);
  if (!updated) throw notFound();
  return ok(updated);
});
