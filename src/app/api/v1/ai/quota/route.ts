import { ok, route } from "@/lib/api";
import { usedToday } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { setting } from "@/lib/settings";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const quota = user.plan === "plus" ? await setting("ai_plus_daily_quota", 60) : await setting("ai_free_daily_quota", 3);
  const used = await usedToday(user.id);
  return ok({ used, quota, remaining: Math.max(quota - used, 0), plan: user.plan });
});
