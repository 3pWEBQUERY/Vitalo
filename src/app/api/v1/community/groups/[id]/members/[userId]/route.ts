import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { body, forbidden, noContent, route } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { groupRole } from "@/lib/community";

/** Admins approve requests, invite and set roles; moderators approve and remove members (COM-06). */
export const PUT = route(async (request, context: { params: Promise<{ id: string; userId: string }> }) => {
  const { user } = await requireUser(request);
  const params = await context.params;
  const groupId = z.uuid().parse(params.id);
  const memberId = z.uuid().parse(params.userId);
  const role = await groupRole(user.id, groupId);
  const input = await body(request, z.object({ action: z.enum(["approve", "invite", "make_moderator", "make_member", "make_admin"]) }));
  if (!role || role === "member") throw forbidden();
  if (input.action.startsWith("make_") && role !== "admin") throw forbidden();
  if (input.action === "invite") {
    await db.insert(schema.groupMembers).values({ groupId, userId: memberId, status: "invited" }).onConflictDoNothing();
  } else if (input.action === "approve") {
    await db
      .update(schema.groupMembers)
      .set({ status: "active" })
      .where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, memberId), eq(schema.groupMembers.status, "requested")));
  } else {
    const newRole = input.action === "make_admin" ? "admin" : input.action === "make_moderator" ? "moderator" : "member";
    await db.update(schema.groupMembers).set({ role: newRole }).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, memberId)));
  }
  return noContent();
});

export const DELETE = route(async (request, context: { params: Promise<{ id: string; userId: string }> }) => {
  const { user } = await requireUser(request);
  const params = await context.params;
  const groupId = z.uuid().parse(params.id);
  const role = await groupRole(user.id, groupId);
  if (role !== "admin" && role !== "moderator") throw forbidden();
  await db.delete(schema.groupMembers).where(and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, z.uuid().parse(params.userId))));
  return noContent();
});
