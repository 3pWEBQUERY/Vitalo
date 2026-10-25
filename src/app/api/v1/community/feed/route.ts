import { z } from "zod";
import { ok, query, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { feed, requireCommunityProfile } from "@/lib/community";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  await requireCommunityProfile(user.id);
  const params = query(request, z.object({ cursor: z.string().max(200).optional(), mode: z.enum(["latest", "popular"]).default("latest"), groupId: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(50).default(20) }));
  return ok(await feed(user.id, params));
});
