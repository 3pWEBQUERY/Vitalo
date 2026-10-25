import { and, asc, eq, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";

/**
 * Offline-first sync (PRD 15.2). The app pushes changed rows with client-generated UUIDs;
 * the server stamps them with its own time. Last change wins, a deletion always wins,
 * and pushes are idempotent. Pull returns everything changed since the cursor,
 * including deletions.
 */

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timestamp = z.iso.datetime({ offset: true });
const n = (max: number) => z.number().min(0).max(max).nullable().optional();

const meal = z.object({
  id: z.uuid(),
  deleted: z.boolean().optional(),
  entryDate: isoDate,
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  status: z.enum(["logged", "planned"]).default("logged"),
  foodId: z.uuid().nullable().optional(),
  name: z.string().min(1).max(200),
  quantityG: z.number().min(0).max(100_000),
  servingUnit: z.string().max(20).nullable().optional(),
  servingCount: n(1000),
  kcal: z.number().min(0).max(100_000),
  proteinG: n(10_000),
  carbsG: n(10_000),
  fatG: n(10_000),
  fiberG: n(10_000),
  sugarG: n(10_000),
  saltG: n(1_000),
  category: z.string().max(20).nullable().optional(),
  source: z.enum(["manual", "barcode", "photo_ai", "text_ai", "label", "recipe", "copy", "quick"]),
  aiConfidence: z.number().min(0).max(1).nullable().optional(),
});

const water = z.object({
  id: z.uuid(),
  deleted: z.boolean().optional(),
  loggedAt: timestamp,
  entryDate: isoDate,
  ml: z.number().int().min(1).max(10_000),
  drinkType: z.enum(["water", "tea", "coffee", "juice", "soda", "alcohol"]).default("water"),
});

const weight = z.object({
  id: z.uuid(),
  deleted: z.boolean().optional(),
  measuredAt: timestamp,
  weightKg: z.number().min(20).max(500),
  bodyFatPct: z.number().min(2).max(70).nullable().optional(),
  leanMassKg: z.number().min(10).max(300).nullable().optional(),
  waistCm: z.number().min(30).max(300).nullable().optional(),
  hipCm: z.number().min(30).max(300).nullable().optional(),
  source: z.enum(["manual", "healthkit", "scale"]).default("manual"),
});

const rating = z.number().int().min(0).max(5).nullable().optional();
const checkIn = z.object({
  id: z.uuid(),
  deleted: z.boolean().optional(),
  entryDate: isoDate,
  hunger: rating,
  satiety: rating,
  mood: rating,
  energy: rating,
  sleep: rating,
  eveningHunger: rating,
});

export const pushInput = z.object({
  meals: z.array(meal).max(500).default([]),
  water: z.array(water).max(500).default([]),
  weights: z.array(weight).max(500).default([]),
  checkIns: z.array(checkIn).max(500).default([]),
});
export type PushInput = z.infer<typeof pushInput>;

type Table = typeof schema.mealEntries | typeof schema.waterEntries | typeof schema.weightEntries | typeof schema.checkIns;

/** Upserts one table's changes for one user. Rows of other users and deleted rows are never touched. */
async function apply<T extends { id: string; deleted?: boolean }>(
  table: Table,
  userId: string,
  items: T[],
  toRow: (item: T) => Record<string, unknown>,
): Promise<{ applied: number; rejected: string[] }> {
  if (items.length === 0) return { applied: 0, rejected: [] };
  const ids = items.map((i) => i.id);
  const existing = await db
    .select({ id: table.id, userId: table.userId, deletedAt: table.deletedAt })
    .from(table)
    .where(inArray(table.id, ids));
  const byId = new Map(existing.map((row) => [row.id, row]));
  const rejected: string[] = [];
  let applied = 0;
  const now = new Date();
  for (const item of items) {
    const current = byId.get(item.id);
    if (current && current.userId !== userId) {
      rejected.push(item.id);
      continue;
    }
    if (current?.deletedAt) continue; // a deletion always wins
    if (item.deleted) {
      if (current) await db.update(table).set({ deletedAt: now, updatedAt: now }).where(eq(table.id, item.id));
      applied++;
      continue;
    }
    const row = { ...toRow(item), id: item.id, userId, updatedAt: now };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(row as any).onConflictDoUpdate({ target: table.id, set: row });
    applied++;
  }
  return { applied, rejected };
}

export async function push(userId: string, input: PushInput) {
  const meals = await apply(schema.mealEntries, userId, input.meals, (m) => ({
    entryDate: m.entryDate, mealType: m.mealType, status: m.status, foodId: m.foodId ?? null, nameSnapshot: m.name,
    quantityG: m.quantityG, servingUnit: m.servingUnit ?? null, servingCount: m.servingCount ?? null, kcal: m.kcal,
    proteinG: m.proteinG ?? null, carbsG: m.carbsG ?? null, fatG: m.fatG ?? null, fiberG: m.fiberG ?? null,
    sugarG: m.sugarG ?? null, saltG: m.saltG ?? null, category: m.category ?? null, source: m.source, aiConfidence: m.aiConfidence ?? null,
  }));
  const water = await apply(schema.waterEntries, userId, input.water, (w) => ({
    entryDate: w.entryDate, loggedAt: new Date(w.loggedAt), ml: w.ml, drinkType: w.drinkType,
  }));
  const weights = await apply(schema.weightEntries, userId, input.weights, (w) => ({
    measuredAt: new Date(w.measuredAt), weightKg: w.weightKg, bodyFatPct: w.bodyFatPct ?? null, leanMassKg: w.leanMassKg ?? null,
    waistCm: w.waistCm ?? null, hipCm: w.hipCm ?? null, source: w.source,
  }));
  const checkIns = await apply(schema.checkIns, userId, input.checkIns, (c) => ({
    entryDate: c.entryDate, hunger: c.hunger ?? null, satiety: c.satiety ?? null, mood: c.mood ?? null,
    energy: c.energy ?? null, sleep: c.sleep ?? null, eveningHunger: c.eveningHunger ?? null,
  }));
  return { meals, water, weights, checkIns };
}

const PAGE = 1000;

/** Rows changed after the cursor. The returned cursor trails "now" slightly so rows still being committed aren't skipped. */
export async function pull(userId: string, cursor: Date | null) {
  const since = cursor ?? new Date(0);
  const tables = {
    meals: schema.mealEntries,
    water: schema.waterEntries,
    weights: schema.weightEntries,
    checkIns: schema.checkIns,
  } as const;
  const result: Record<string, unknown[]> = {};
  let hasMore = false;
  let maxSeen = since;
  for (const [name, table] of Object.entries(tables)) {
    const rows = await db
      .select()
      .from(table)
      .where(and(eq(table.userId, userId), gt(table.updatedAt, since)))
      .orderBy(asc(table.updatedAt))
      .limit(PAGE + 1);
    if (rows.length > PAGE) hasMore = true;
    const page = rows.slice(0, PAGE);
    for (const row of page) if (row.updatedAt > maxSeen) maxSeen = row.updatedAt;
    result[name] = page.map(({ userId: _owner, ...row }) => ({ ...row, deleted: row.deletedAt !== null }));
  }
  const [{ now }] = await db.execute<{ now: Date }>(sql`select now() - interval '2 seconds' as now`);
  const safeNow = new Date(now);
  // Never move past "now minus 2 s": a row committed late with an earlier stamp would be skipped.
  // Rows returned twice are harmless, the app upserts by id.
  const nextCursor = hasMore ? maxSeen : new Date(Math.max(since.getTime(), safeNow.getTime()));
  return { ...result, cursor: nextCursor.toISOString(), hasMore };
}
