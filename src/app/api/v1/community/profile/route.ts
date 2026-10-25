import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ApiError, body, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { goalTags, handle } from "../schemas";

const input = z.object({
  handle,
  bio: z.string().max(160).nullable().optional(),
  visibility: z.enum(["private", "followers", "public"]).default("followers"),
  goalTags: goalTags.default([]),
  discoverable: z.boolean().default(false),
  region: z.string().max(40).nullable().optional(),
  avatarMediaId: z.uuid().nullable().optional(),
  ageConfirmed: z.literal(true, { message: "Community is for adults aged 18 and over." }),
});

export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const [profile] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, user.id));
  return ok({ profile: profile ?? null });
});

/** Joining the community: pseudonym, visibility (default followers only) and age confirmation (COM-01, MOD-08). */
export const PUT = route(async (request) => {
  const { user } = await requireUser(request);
  const data = await body(request, input);
  const [taken] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.handle, data.handle));
  if (taken && taken.userId !== user.id) throw new ApiError(409, "handle_taken");
  const values = {
    handle: data.handle, bio: data.bio ?? null, visibility: data.visibility, goalTags: data.goalTags,
    discoverable: data.discoverable, region: data.region ?? null, avatarMediaId: data.avatarMediaId ?? null, updatedAt: new Date(),
  };
  const [profile] = await db
    .insert(schema.communityProfiles)
    .values({ userId: user.id, ageConfirmedAt: new Date(), ...values })
    .onConflictDoUpdate({ target: schema.communityProfiles.userId, set: values })
    .returning();
  return ok({ profile });
});

/** Leaving the community keeps all tracking data; posts are deleted on request (PRD 11.2). */
export const DELETE = route(async (request) => {
  const { user } = await requireUser(request);
  const deletePosts = request.nextUrl.searchParams.get("deletePosts") === "true";
  if (deletePosts) await db.update(schema.posts).set({ deletedAt: new Date() }).where(eq(schema.posts.userId, user.id));
  await db.delete(schema.follows).where(eq(schema.follows.followerId, user.id));
  await db.delete(schema.follows).where(eq(schema.follows.followeeId, user.id));
  await db.delete(schema.groupMembers).where(eq(schema.groupMembers.userId, user.id));
  await db.delete(schema.communityProfiles).where(eq(schema.communityProfiles.userId, user.id));
  return ok({ left: true, postsDeleted: deletePosts });
});
