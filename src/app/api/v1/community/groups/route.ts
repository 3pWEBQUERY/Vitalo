import { and, count, eq, ilike, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { ApiError, body, ok, query, rateLimit, route } from "@/lib/api";
import { moderateText } from "@/lib/ai";
import { requireUser } from "@/lib/auth";
import { requireCommunityProfile } from "@/lib/community";

/** Discover groups: public and private ones are listed, invite-only ones are not (COM-09). */
export const GET = route(async (request) => {
  const { user } = await requireUser(request);
  const { q } = query(request, z.object({ q: z.string().max(60).optional() }));
  const rows = await db
    .select({
      group: schema.communityGroups,
      members: sql<number>`(select count(*)::int from group_members m where m.group_id = ${schema.communityGroups.id} and m.status = 'active')`,
      myStatus: sql<string | null>`(select m.status from group_members m where m.group_id = ${schema.communityGroups.id} and m.user_id = ${user.id})`,
    })
    .from(schema.communityGroups)
    .where(
      and(
        eq(schema.communityGroups.status, "active"),
        ne(schema.communityGroups.visibility, "invite"),
        q ? or(ilike(schema.communityGroups.name, `%${q}%`), ilike(schema.communityGroups.description, `%${q}%`)) : undefined,
      ),
    )
    .orderBy(sql`(select count(*) from group_members m where m.group_id = community_groups.id) desc`)
    .limit(50);
  return ok({
    groups: rows.map((r) => ({ id: r.group.id, name: r.group.name, description: r.group.description, visibility: r.group.visibility, members: r.members, myStatus: r.myStatus })),
  });
});

const input = z.object({
  name: z.string().trim().min(3).max(60),
  description: z.string().trim().max(500).nullable().optional(),
  rules: z.string().trim().max(2000).nullable().optional(),
  visibility: z.enum(["public", "private", "invite"]).default("public"),
});

/** Free accounts can own one group, Plus accounts more (PRD 20.2). */
export const POST = route(async (request) => {
  const { user } = await requireUser(request);
  await requireCommunityProfile(user.id);
  rateLimit(`group:${user.id}`, 5, 24 * 60 * 60_000);
  const data = await body(request, input);
  const [owned] = await db
    .select({ n: count() })
    .from(schema.communityGroups)
    .where(and(eq(schema.communityGroups.ownerId, user.id), eq(schema.communityGroups.status, "active")));
  if (user.plan !== "plus" && owned.n >= 1) throw new ApiError(402, "group_limit_reached");
  const moderation = await moderateText(user.id, `${data.name}\n${data.description ?? ""}\n${data.rules ?? ""}`);
  if (moderation.decision === "review") throw new ApiError(422, "group_needs_review", moderation.categories.join(","));
  const [group] = await db
    .insert(schema.communityGroups)
    .values({ ...data, description: data.description ?? null, rules: data.rules ?? null, ownerId: user.id })
    .returning();
  await db.insert(schema.groupMembers).values({ groupId: group.id, userId: user.id, role: "admin" });
  return ok(group, 201);
});
