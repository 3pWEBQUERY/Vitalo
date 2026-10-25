import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const rows = await db
    .select({ userId: schema.follows.followerId, handle: schema.communityProfiles.handle, since: schema.follows.createdAt })
    .from(schema.follows)
    .innerJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.follows.followerId))
    .where(and(eq(schema.follows.followeeId, user.id), eq(schema.follows.status, "pending")));
  return ok({ requests: rows });
});
