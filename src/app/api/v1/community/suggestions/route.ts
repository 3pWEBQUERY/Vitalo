import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { requireCommunityProfile, suggestions } from "@/lib/community";

/** Like-minded people by goal tags and rough region; only between people who opted in (COM-08). */
export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  await requireCommunityProfile(user.id);
  return ok({ people: await suggestions(user.id) });
});
