import { z } from "zod";
import { body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { markChallengeDay } from "@/lib/community";

export const POST = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const { day } = await body(request, z.object({ day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }));
  return ok(await markChallengeDay(user.id, z.uuid().parse((await context.params).id), day));
});
