import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, forbidden, notFound, ok, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { groupRole } from "@/lib/community";

export const GET = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const id = z.uuid().parse((await context.params).id);
  const [group] = await db.select().from(schema.communityGroups).where(and(eq(schema.communityGroups.id, id), eq(schema.communityGroups.status, "active")));
  if (!group) throw notFound();
  const role = await groupRole(user.id, id);
  if (group.visibility === "invite" && !role) throw notFound();
  const members = role
    ? await db
        .select({ userId: schema.groupMembers.userId, role: schema.groupMembers.role, status: schema.groupMembers.status, handle: schema.communityProfiles.handle })
        .from(schema.groupMembers)
        .innerJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.groupMembers.userId))
        .where(eq(schema.groupMembers.groupId, id))
    : [];
  const canManage = role === "admin" || role === "moderator";
  return ok({ ...group, myRole: role, members: members.filter((m) => m.status === "active" || canManage) });
});

export const PATCH = route(async (request, context: { params: Promise<{ id: string }> }) => {
  const { user } = await requireUser(request);
  const id = z.uuid().parse((await context.params).id);
  if ((await groupRole(user.id, id)) !== "admin") throw forbidden();
  const changes = await body(
    request,
    z.object({
      description: z.string().max(500).nullable().optional(),
      rules: z.string().max(2000).nullable().optional(),
      visibility: z.enum(["public", "private", "invite"]).optional(),
    }),
  );
  const [group] = await db.update(schema.communityGroups).set(changes).where(eq(schema.communityGroups.id, id)).returning();
  return ok(group);
});
