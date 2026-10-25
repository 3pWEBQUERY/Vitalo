import { z } from "zod";
import { body, ok, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { report } from "@/lib/community";

/** Report posts, comments, people, groups or food entries with a reason (MOD-01, DB-06). */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`report:${user.id}`, 30, 60 * 60_000);
  const input = await body(
    request,
    z.object({
      targetType: z.enum(["post", "comment", "user", "group", "food"]),
      targetId: z.uuid(),
      reason: z.enum(["spam", "harassment", "eating_disorder", "body_shaming", "extreme_diet", "advertising", "wrong_values", "inappropriate", "other"]),
      details: z.string().max(1000).nullable().optional(),
    }),
  );
  await report(user.id, input);
  return ok({ received: true }, 201);
});
