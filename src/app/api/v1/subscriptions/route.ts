import { ok, route } from "@/lib/api";
import { effectivePlan } from "@/lib/appstore";
import { requireUser } from "@/lib/auth";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  return ok(await effectivePlan(user.id));
});
