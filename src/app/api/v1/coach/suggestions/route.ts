import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { openSuggestions } from "@/lib/coach";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  return ok({ suggestions: await openSuggestions(user.id) });
});
