import { body, ok, rateLimit, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { push, pushInput } from "@/lib/sync";

export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  rateLimit(`sync:${user.id}`, 120, 60_000);
  return ok(await push(user.id, await body(request, pushInput)));
});
