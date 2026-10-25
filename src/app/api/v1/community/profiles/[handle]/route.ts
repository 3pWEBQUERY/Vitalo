import { and, count, eq, isNull } from "drizzle-orm";
import { db, schema } from "@/db";
import { notFound, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { canSeeUser } from "@/lib/community";

export const GET = route(async (request, context: { params: Promise<{ handle: string }> }) => {
  const { user } = await requireUser(request);
  const { handle } = await context.params;
  const [profile] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.handle, handle.toLowerCase()));
  if (!profile) throw notFound();
  const visible = await canSeeUser(user.id, profile.userId);
  const [followers] = await db.select({ n: count() }).from(schema.follows).where(and(eq(schema.follows.followeeId, profile.userId), eq(schema.follows.status, "accepted")));
  const [posts] = await db.select({ n: count() }).from(schema.posts).where(and(eq(schema.posts.userId, profile.userId), eq(schema.posts.status, "published"), isNull(schema.posts.deletedAt)));
  const [relation] = await db.select().from(schema.follows).where(and(eq(schema.follows.followerId, user.id), eq(schema.follows.followeeId, profile.userId)));
  return ok({
    userId: profile.userId,
    handle: profile.handle,
    bio: visible ? profile.bio : null,
    goalTags: visible ? profile.goalTags : [],
    avatarUrl: profile.avatarMediaId ? `/api/v1/media/${profile.avatarMediaId}` : null,
    visibility: profile.visibility,
    followers: followers.n,
    posts: visible ? posts.n : null,
    following: relation?.status ?? null,
    canSeePosts: visible,
  });
});
