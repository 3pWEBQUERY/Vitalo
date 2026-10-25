import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { revokeAppleToken } from "./auth";
import { removeMedia } from "./media";

/** Calorie floor and goal-weight floor from PRD 17.4, read from admin settings. */
export async function validateGoal(input: { kcalTarget: number; kind: string; targetWeightKg?: number | null }, profile: { sexForCalc: string | null; heightCm: number | null }) {
  const { setting } = await import("./settings");
  const floor = profile.sexForCalc === "male" ? await setting("kcal_minimum_male", 1500) : await setting("kcal_minimum_female", 1200);
  const problems: string[] = [];
  if (input.kcalTarget < floor) problems.push(`kcal_below_minimum:${floor}`);
  if (input.targetWeightKg && profile.heightCm) {
    const bmi = input.targetWeightKg / (profile.heightCm / 100) ** 2;
    if (bmi < 18.5) problems.push("target_bmi_below_18_5");
  }
  return problems;
}

export async function currentGoal(userId: string) {
  const [goal] = await db.select().from(schema.goals).where(eq(schema.goals.userId, userId)).orderBy(desc(schema.goals.validFrom), desc(schema.goals.createdAt)).limit(1);
  return goal ?? null;
}

export async function latestConsents(userId: string) {
  const rows = await db.select().from(schema.consents).where(eq(schema.consents.userId, userId)).orderBy(desc(schema.consents.createdAt));
  const latest = new Map<string, (typeof rows)[number]>();
  for (const row of rows) if (!latest.has(row.kind)) latest.set(row.kind, row);
  return [...latest.values()];
}

export async function hasConsent(userId: string, kind: (typeof schema.consents.$inferSelect)["kind"]): Promise<boolean> {
  const [row] = await db.select().from(schema.consents).where(and(eq(schema.consents.userId, userId), eq(schema.consents.kind, kind))).orderBy(desc(schema.consents.createdAt)).limit(1);
  return row?.granted ?? false;
}

/** Everything stored about a person, in readable form (PRV-03). */
export async function exportData(userId: string) {
  const live = <T extends { deletedAt: Date | null }>(rows: T[]) => rows.filter((r) => !r.deletedAt);
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const [profile] = await db.select().from(schema.profiles).where(eq(schema.profiles.userId, userId));
  return {
    exportedAt: new Date().toISOString(),
    account: { id: user.id, createdAt: user.createdAt, plan: user.plan, email: user.email },
    profile: profile ?? null,
    goals: await db.select().from(schema.goals).where(eq(schema.goals.userId, userId)),
    consents: await db.select().from(schema.consents).where(eq(schema.consents.userId, userId)),
    meals: live(await db.select().from(schema.mealEntries).where(eq(schema.mealEntries.userId, userId))),
    water: live(await db.select().from(schema.waterEntries).where(eq(schema.waterEntries.userId, userId))),
    weights: live(await db.select().from(schema.weightEntries).where(eq(schema.weightEntries.userId, userId))),
    checkIns: live(await db.select().from(schema.checkIns).where(eq(schema.checkIns.userId, userId))),
    coachSuggestions: await db.select().from(schema.coachSuggestions).where(eq(schema.coachSuggestions.userId, userId)),
    foodsContributed: await db.select().from(schema.foods).where(eq(schema.foods.createdBy, userId)),
    community: {
      profile: (await db.select().from(schema.communityProfiles).where(eq(schema.communityProfiles.userId, userId)))[0] ?? null,
      posts: await db.select().from(schema.posts).where(and(eq(schema.posts.userId, userId), isNull(schema.posts.deletedAt))),
      comments: await db.select().from(schema.comments).where(and(eq(schema.comments.userId, userId), isNull(schema.comments.deletedAt))),
    },
  };
}

export function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const columns = Object.keys(rows[0]).filter((c) => c !== "userId");
  const cell = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = value instanceof Date ? value.toISOString() : typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(","), ...rows.map((row) => columns.map((c) => cell(row[c])).join(","))].join("\n");
}

/**
 * Deletes the account right away (PRD PRV-04): Apple token revoked, files removed,
 * every row deleted through the cascades. Backups expire on their own schedule.
 */
export async function deleteAccount(userId: string): Promise<{ appleRevoked: boolean }> {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return { appleRevoked: false };
  const appleRevoked = user.appleRefreshToken ? await revokeAppleToken(user.appleRefreshToken) : false;
  const owned = await db.select({ id: schema.media.id }).from(schema.media).where(eq(schema.media.ownerUserId, userId));
  for (const file of owned) await removeMedia(file.id);
  // Contributed foods stay for the community but lose the link to the person.
  await db.update(schema.foods).set({ createdBy: null }).where(and(eq(schema.foods.createdBy, userId), eq(schema.foods.isPrivate, false)));
  await db.delete(schema.foods).where(and(eq(schema.foods.createdBy, userId), eq(schema.foods.isPrivate, true)));
  await db.delete(schema.users).where(eq(schema.users.id, userId));
  return { appleRevoked };
}

export async function sessionsOf(userId: string) {
  return db
    .select({ id: schema.deviceSessions.id, deviceName: schema.deviceSessions.deviceName, appVersion: schema.deviceSessions.appVersion, createdAt: schema.deviceSessions.createdAt, lastUsedAt: schema.deviceSessions.lastUsedAt })
    .from(schema.deviceSessions)
    .where(and(eq(schema.deviceSessions.userId, userId), isNull(schema.deviceSessions.revokedAt)))
    .orderBy(desc(schema.deviceSessions.lastUsedAt));
}

export async function revokeSessions(userId: string, ids: string[]) {
  if (ids.length === 0) return;
  await db
    .update(schema.deviceSessions)
    .set({ revokedAt: sql`now()` })
    .where(and(eq(schema.deviceSessions.userId, userId), inArray(schema.deviceSessions.id, ids)));
}
