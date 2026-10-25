import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { audit } from "./admin";

export type TargetType = (typeof schema.reports.$inferSelect)["targetType"];
export type Reason = (typeof schema.reports.$inferSelect)["reason"];

export const REASON_NAMES: Record<Reason, string> = {
  spam: "Spam",
  harassment: "Belästigung",
  eating_disorder: "Essstörung",
  body_shaming: "Body-Shaming",
  extreme_diet: "Extreme Diät",
  advertising: "Werbung",
  wrong_values: "Falsche Werte",
  inappropriate: "Unangemessen",
  other: "Sonstiges",
};

const POST_TITLES = { text: "Beitrag", photo: "Fotobeitrag", meal: "Mahlzeit-Beitrag", progress: "Fortschritts-Beitrag", milestone: "Meilenstein", recipe: "Rezept" } as const;

export const TARGET_NAMES: Record<TargetType, string> = { post: "Beitrag", comment: "Kommentar", user: "Person", group: "Gruppe", food: "Lebensmittel" };

/** Reasons that put a person's wellbeing at risk are shown first (MOD-05). */
const URGENT: Reason[] = ["eating_disorder", "harassment", "body_shaming", "extreme_diet"];

export type Preview = { title: string; body: string | null; author?: { userId: string; handle: string | null }; status: string; link?: string };

async function previews(items: { targetType: TargetType; targetId: string }[]): Promise<Map<string, Preview>> {
  const byType = (type: TargetType) => items.filter((i) => i.targetType === type).map((i) => i.targetId);
  const out = new Map<string, Preview>();
  const handleOf = async (ids: string[]) => {
    if (!ids.length) return new Map<string, string>();
    const rows = await db.select().from(schema.communityProfiles).where(inArray(schema.communityProfiles.userId, ids));
    return new Map(rows.map((r) => [r.userId, r.handle]));
  };
  const posts = byType("post").length ? await db.select().from(schema.posts).where(inArray(schema.posts.id, byType("post"))) : [];
  const comments = byType("comment").length ? await db.select().from(schema.comments).where(inArray(schema.comments.id, byType("comment"))) : [];
  const groups = byType("group").length ? await db.select().from(schema.communityGroups).where(inArray(schema.communityGroups.id, byType("group"))) : [];
  const foods = byType("food").length ? await db.select().from(schema.foods).where(inArray(schema.foods.id, byType("food"))) : [];
  const handles = await handleOf([...posts.map((p) => p.userId), ...comments.map((c) => c.userId), ...byType("user"), ...groups.map((g) => g.ownerId)]);
  for (const p of posts) out.set(`post:${p.id}`, { title: `${POST_TITLES[p.kind]}`, body: p.body, author: { userId: p.userId, handle: handles.get(p.userId) ?? null }, status: p.deletedAt ? "deleted" : p.status });
  for (const c of comments) out.set(`comment:${c.id}`, { title: "Kommentar", body: c.body, author: { userId: c.userId, handle: handles.get(c.userId) ?? null }, status: c.deletedAt ? "deleted" : c.status });
  for (const g of groups) out.set(`group:${g.id}`, { title: g.name, body: g.description, author: { userId: g.ownerId, handle: handles.get(g.ownerId) ?? null }, status: g.status });
  for (const f of foods) out.set(`food:${f.id}`, { title: f.name, body: `${f.kcal100} kcal / 100 g`, status: f.quality, link: `/admin/foods/${f.id}` });
  for (const id of byType("user")) out.set(`user:${id}`, { title: handles.get(id) ? `@${handles.get(id)}` : "Person", body: null, author: { userId: id, handle: handles.get(id) ?? null }, status: "active" });
  return out;
}

export type ReportGroup = {
  targetType: TargetType;
  targetId: string;
  reports: number;
  reporters: number;
  reasons: Reason[];
  details: string[];
  first: Date;
  urgent: boolean;
  preview: Preview | null;
};

/** Open reports, one entry per reported item, urgent reasons and most reported first. */
export async function openReports(): Promise<ReportGroup[]> {
  const rows = await db
    .select({
      targetType: schema.reports.targetType,
      targetId: schema.reports.targetId,
      reports: sql<number>`count(*)::int`,
      reporters: sql<number>`count(distinct ${schema.reports.reporterId})::int`,
      reasons: sql<Reason[]>`array_agg(distinct ${schema.reports.reason})`,
      details: sql<string[]>`array_remove(array_agg(${schema.reports.details}), null)`,
      first: sql<Date>`min(${schema.reports.createdAt})`,
    })
    .from(schema.reports)
    .where(eq(schema.reports.status, "open"))
    .groupBy(schema.reports.targetType, schema.reports.targetId)
    .limit(200);
  const shown = await previews(rows);
  return rows
    .map((r) => ({ ...r, first: new Date(r.first), urgent: r.reasons.some((reason) => URGENT.includes(reason)), preview: shown.get(`${r.targetType}:${r.targetId}`) ?? null }))
    .sort((a, b) => Number(b.urgent) - Number(a.urgent) || b.reporters - a.reporters || a.first.getTime() - b.first.getTime());
}

export async function heldContent() {
  const posts = await db
    .select({ post: schema.posts, handle: schema.communityProfiles.handle })
    .from(schema.posts)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.posts.userId))
    .where(and(eq(schema.posts.status, "held"), isNull(schema.posts.deletedAt)))
    .orderBy(schema.posts.createdAt)
    .limit(100);
  const comments = await db
    .select({ comment: schema.comments, handle: schema.communityProfiles.handle })
    .from(schema.comments)
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.comments.userId))
    .where(and(eq(schema.comments.status, "held"), isNull(schema.comments.deletedAt)))
    .orderBy(schema.comments.createdAt)
    .limit(100);
  return { posts, comments };
}

export async function openAppeals() {
  return db
    .select({ appeal: schema.appeals, sanction: schema.userSanctions, handle: schema.communityProfiles.handle })
    .from(schema.appeals)
    .leftJoin(schema.userSanctions, eq(schema.userSanctions.id, schema.appeals.sanctionId))
    .leftJoin(schema.communityProfiles, eq(schema.communityProfiles.userId, schema.appeals.userId))
    .where(eq(schema.appeals.status, "open"))
    .orderBy(schema.appeals.createdAt);
}

export async function sanctionsOf(userId: string) {
  return db.select().from(schema.userSanctions).where(eq(schema.userSanctions.userId, userId)).orderBy(desc(schema.userSanctions.createdAt));
}

async function closeReports(adminId: string, targetType: TargetType, targetId: string, status: "actioned" | "dismissed") {
  await db
    .update(schema.reports)
    .set({ status, resolvedBy: adminId, resolvedAt: new Date() })
    .where(and(eq(schema.reports.targetType, targetType), eq(schema.reports.targetId, targetId), eq(schema.reports.status, "open")));
}

/** The report was unfounded: content hidden by reports becomes visible again. */
export async function dismissReports(adminId: string, targetType: TargetType, targetId: string) {
  await closeReports(adminId, targetType, targetId, "dismissed");
  if (targetType === "post") await db.update(schema.posts).set({ status: "published" }).where(and(eq(schema.posts.id, targetId), eq(schema.posts.status, "held")));
  if (targetType === "comment") await db.update(schema.comments).set({ status: "published" }).where(and(eq(schema.comments.id, targetId), eq(schema.comments.status, "held")));
  await audit(adminId, "report.dismissed", targetType, targetId);
}

export async function removeContent(adminId: string, targetType: TargetType, targetId: string, note?: string) {
  if (targetType === "post") await db.update(schema.posts).set({ status: "removed" }).where(eq(schema.posts.id, targetId));
  if (targetType === "comment") {
    const [comment] = await db.update(schema.comments).set({ status: "removed" }).where(eq(schema.comments.id, targetId)).returning();
    if (comment) await db.update(schema.posts).set({ commentCount: sql`greatest(${schema.posts.commentCount} - 1, 0)` }).where(eq(schema.posts.id, comment.postId));
  }
  if (targetType === "group") await db.update(schema.communityGroups).set({ status: "removed" }).where(eq(schema.communityGroups.id, targetId));
  if (targetType === "food") await db.update(schema.foods).set({ quality: "suspect" }).where(eq(schema.foods.id, targetId));
  await closeReports(adminId, targetType, targetId, "actioned");
  await audit(adminId, "content.removed", targetType, targetId, note ? { note } : undefined);
}

export async function approveContent(adminId: string, targetType: "post" | "comment", targetId: string) {
  if (targetType === "post") await db.update(schema.posts).set({ status: "published" }).where(eq(schema.posts.id, targetId));
  else await db.update(schema.comments).set({ status: "published" }).where(eq(schema.comments.id, targetId));
  await closeReports(adminId, targetType, targetId, "dismissed");
  await audit(adminId, targetType === "post" ? "post.approved" : "content.restored", targetType, targetId);
}

export const SANCTION_NAMES = { warning: "Verwarnung", suspension: "Sperre", ban: "Ausschluss" } as const;

/** Warning, time-limited suspension or permanent ban from the community (MOD-06). Tracking stays usable. */
export async function sanction(adminId: string, userId: string, kind: keyof typeof SANCTION_NAMES, reason: string, days?: number) {
  const until = kind === "suspension" ? new Date(Date.now() + (days ?? 7) * 86400_000) : null;
  const [row] = await db.insert(schema.userSanctions).values({ userId, kind, reason, until, adminId }).returning();
  await audit(adminId, "sanction.created", "user", userId, { kind, reason, days: kind === "suspension" ? days ?? 7 : undefined });
  return row;
}

export async function liftSanction(adminId: string, sanctionId: string) {
  const [row] = await db.delete(schema.userSanctions).where(eq(schema.userSanctions.id, sanctionId)).returning();
  if (row) await audit(adminId, "sanction.lifted", "user", row.userId, { kind: row.kind });
}

export async function decideAppeal(adminId: string, appealId: string, grant: boolean) {
  const [appeal] = await db
    .update(schema.appeals)
    .set({ status: grant ? "granted" : "denied", decidedBy: adminId, decidedAt: new Date() })
    .where(and(eq(schema.appeals.id, appealId), eq(schema.appeals.status, "open")))
    .returning();
  if (!appeal) return;
  if (grant && appeal.sanctionId) await db.delete(schema.userSanctions).where(eq(schema.userSanctions.id, appeal.sanctionId));
  await audit(adminId, grant ? "appeal.granted" : "appeal.denied", "user", appeal.userId, { appealId });
}
