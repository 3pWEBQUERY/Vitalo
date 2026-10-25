"use server";

import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin } from "@/lib/admin";

type Result = { message?: string; error?: string };
const fields = (formData: FormData) => Object.fromEntries(formData.entries());

function refresh(...paths: string[]) {
  revalidatePath("/admin/community", "layout");
  revalidatePath("/admin", "layout");
  for (const p of paths) revalidatePath(p);
}

async function closeReports(adminId: string, targetType: "post" | "comment" | "group", ids: string[], status: "actioned" | "dismissed") {
  await db
    .update(schema.reports)
    .set({ status, resolvedBy: adminId, resolvedAt: new Date() })
    .where(and(eq(schema.reports.targetType, targetType), inArray(schema.reports.targetId, ids), eq(schema.reports.status, "open")));
}

// MARK: Posts

const postOp = z.enum(["hide", "restore", "delete"]);

async function applyPostOp(adminId: string, ids: string[], op: z.infer<typeof postOp>) {
  if (op === "hide") {
    await db.update(schema.posts).set({ status: "removed" }).where(inArray(schema.posts.id, ids));
    await closeReports(adminId, "post", ids, "actioned");
  } else if (op === "restore") {
    await db.update(schema.posts).set({ status: "published", deletedAt: null }).where(inArray(schema.posts.id, ids));
    await closeReports(adminId, "post", ids, "dismissed");
  } else {
    await db.delete(schema.posts).where(inArray(schema.posts.id, ids));
    await closeReports(adminId, "post", ids, "actioned");
  }
  await audit(adminId, op === "hide" ? "content.removed" : op === "restore" ? "content.restored" : "post.deleted", "post", ids.length === 1 ? ids[0] : undefined, ids.length > 1 ? { count: ids.length } : undefined);
}

export async function postAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const { id, op } = z.object({ id: z.uuid(), op: postOp }).parse(fields(formData));
  await applyPostOp(admin.id, [id], op);
  refresh(`/admin/community/posts/${id}`);
  if (op === "delete") redirect("/admin/community/posts?deleted=1");
  return { message: op === "hide" ? "Beitrag ausgeblendet." : "Beitrag wiederhergestellt." };
}

export async function bulkPostAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const parsed = z.object({ ids: z.array(z.uuid()).min(1).max(200), op: postOp }).safeParse({ ids: formData.getAll("ids").map(String), op: formData.get("op") });
  if (!parsed.success) return { error: "Bitte zuerst Beiträge auswählen." };
  await applyPostOp(admin.id, parsed.data.ids, parsed.data.op);
  refresh();
  const n = parsed.data.ids.length;
  const noun = n === 1 ? "Beitrag" : "Beiträge";
  return { message: `${n} ${noun} ${parsed.data.op === "hide" ? "ausgeblendet" : parsed.data.op === "restore" ? "wiederhergestellt" : "gelöscht"}.` };
}

export async function commentAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const { id, op } = z.object({ id: z.uuid(), op: postOp }).parse(fields(formData));
  const [comment] = await db.select().from(schema.comments).where(eq(schema.comments.id, id));
  if (!comment) return { error: "Den Kommentar gibt es nicht mehr." };
  const counted = comment.status === "published" && !comment.deletedAt;
  if (op === "delete") {
    await db.delete(schema.comments).where(eq(schema.comments.id, id));
  } else {
    await db.update(schema.comments).set({ status: op === "hide" ? "removed" : "published", deletedAt: op === "restore" ? null : comment.deletedAt }).where(eq(schema.comments.id, id));
  }
  const nowCounted = op === "restore";
  if (counted !== nowCounted) {
    await db.update(schema.posts).set({ commentCount: sql`greatest(${schema.posts.commentCount} ${nowCounted ? sql`+` : sql`-`} 1, 0)` }).where(eq(schema.posts.id, comment.postId));
  }
  await closeReports(admin.id, "comment", [id], op === "restore" ? "dismissed" : "actioned");
  await audit(admin.id, op === "restore" ? "content.restored" : "content.removed", "comment", id);
  refresh(`/admin/community/posts/${comment.postId}`);
  return { message: op === "hide" ? "Kommentar ausgeblendet." : op === "restore" ? "Kommentar wiederhergestellt." : "Kommentar gelöscht." };
}

// MARK: Groups

const groupInput = z.object({
  id: z.uuid(),
  name: z.string().trim().min(3, "Der Name braucht mindestens 3 Zeichen.").max(60),
  description: z.string().trim().max(500).transform((v) => v || null),
  rules: z.string().trim().max(2000).transform((v) => v || null),
  visibility: z.enum(["public", "private", "invite"]),
  status: z.enum(["active", "suspended", "removed"]),
});

export async function saveGroupAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const parsed = groupInput.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, ...values } = parsed.data;
  const [before] = await db.select().from(schema.communityGroups).where(eq(schema.communityGroups.id, id));
  if (!before) return { error: "Die Gruppe gibt es nicht mehr." };
  await db.update(schema.communityGroups).set(values).where(eq(schema.communityGroups.id, id));
  if (before.status !== values.status) await audit(admin.id, values.status === "active" ? "group.restored" : "group.suspended", "group", id, { status: values.status });
  await audit(admin.id, "group.update", "group", id, { name: values.name });
  refresh(`/admin/community/groups/${id}`);
  return { message: "Gruppe gespeichert." };
}

export async function deleteGroupAction(formData: FormData) {
  const admin = await requireAdmin("moderation");
  const id = z.uuid().parse(formData.get("id"));
  const [group] = await db.delete(schema.communityGroups).where(eq(schema.communityGroups.id, id)).returning();
  if (group) await audit(admin.id, "group.deleted", "group", id, { name: group.name });
  refresh();
  redirect("/admin/community/groups?deleted=1");
}

export async function memberAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const { groupId, userId, op } = z.object({ groupId: z.uuid(), userId: z.uuid(), op: z.enum(["admin", "moderator", "member", "approve", "remove"]) }).parse(fields(formData));
  const where = and(eq(schema.groupMembers.groupId, groupId), eq(schema.groupMembers.userId, userId));
  if (op === "remove") await db.delete(schema.groupMembers).where(where);
  else if (op === "approve") await db.update(schema.groupMembers).set({ status: "active" }).where(where);
  else await db.update(schema.groupMembers).set({ role: op }).where(where);
  await audit(admin.id, "group.member", "group", groupId, { userId, op });
  refresh(`/admin/community/groups/${groupId}`);
  return { message: op === "remove" ? "Mitglied entfernt." : op === "approve" ? "Beitritt bestätigt." : "Rolle geändert." };
}

// MARK: Challenges

const BLOCKED_GOALS = /(abnehm|lose weight|kilo|kg\b|kcal|kalorien|fast|fasten|hungern)/i;
const challengeInput = z
  .object({
    title: z.string().trim().min(3, "Der Titel braucht mindestens 3 Zeichen.").max(80),
    description: z.string().trim().max(600).transform((v) => v || null),
    kind: z.enum(["veggies", "water", "protein", "breakfast", "steps", "custom"]),
    targetDays: z.coerce.number().int().min(1, "Mindestens 1 Tag.").max(90, "Höchstens 90 Tage."),
    startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein Startdatum wählen."),
    endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte ein Enddatum wählen."),
  })
  .refine((c) => c.endsOn >= c.startsOn, { message: "Das Ende liegt vor dem Start." })
  .refine((c) => !BLOCKED_GOALS.test(`${c.title} ${c.description ?? ""}`), { message: "Challenges mit Abnehm-, Kalorien- oder Fastenzielen sind nicht erlaubt." });

export async function createChallengeAction(_: Result, formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const parsed = challengeInput.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const [challenge] = await db.insert(schema.challenges).values({ ...parsed.data, groupId: null, createdBy: null }).returning();
  await audit(admin.id, "challenge.create", "challenge", challenge.id, { title: challenge.title });
  refresh();
  redirect(`/admin/community/challenges/${challenge.id}?created=1`);
}

export async function saveChallengeAction(_: Result, formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const id = z.uuid().parse(formData.get("id"));
  const parsed = challengeInput.safeParse(fields(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  await db.update(schema.challenges).set(parsed.data).where(eq(schema.challenges.id, id));
  await audit(admin.id, "challenge.update", "challenge", id, { title: parsed.data.title });
  refresh(`/admin/community/challenges/${id}`);
  return { message: "Challenge gespeichert." };
}

export async function deleteChallengeAction(formData: FormData) {
  const admin = await requireAdmin("moderation");
  const id = z.uuid().parse(formData.get("id"));
  const [challenge] = await db.delete(schema.challenges).where(eq(schema.challenges.id, id)).returning();
  if (challenge) await audit(admin.id, "challenge.delete", "challenge", id, { title: challenge.title });
  refresh();
  redirect("/admin/community/challenges?deleted=1");
}

// MARK: Community profiles (from the user page)

export async function profileAction(formData: FormData): Promise<Result> {
  const admin = await requireAdmin("moderation");
  const { userId, op, handle } = z.object({ userId: z.uuid(), op: z.enum(["rename", "clear_bio", "clear_avatar", "remove"]), handle: z.string().optional() }).parse(fields(formData));
  const where = eq(schema.communityProfiles.userId, userId);
  if (op === "rename") {
    const next = (handle ?? "").trim().toLowerCase();
    if (!/^[a-z0-9_.]{3,24}$/.test(next)) return { error: "Name: 3–24 Zeichen, nur a–z, 0–9, Punkt und Unterstrich." };
    const [taken] = await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.handle, next));
    if (taken && taken.userId !== userId) return { error: "Dieser Name ist vergeben." };
    await db.update(schema.communityProfiles).set({ handle: next, updatedAt: new Date() }).where(where);
  } else if (op === "clear_bio") {
    await db.update(schema.communityProfiles).set({ bio: null, updatedAt: new Date() }).where(where);
  } else if (op === "clear_avatar") {
    await db.update(schema.communityProfiles).set({ avatarMediaId: null, updatedAt: new Date() }).where(where);
  } else {
    await db.update(schema.posts).set({ deletedAt: new Date() }).where(and(eq(schema.posts.userId, userId), isNull(schema.posts.deletedAt)));
    await db.delete(schema.groupMembers).where(eq(schema.groupMembers.userId, userId));
    await db.delete(schema.communityProfiles).where(where);
  }
  await audit(admin.id, "community.profile", "user", userId, { op, handle });
  revalidatePath(`/admin/users/${userId}`);
  return { message: op === "rename" ? "Name geändert." : op === "remove" ? "Community-Profil entfernt." : "Profil bereinigt." };
}
