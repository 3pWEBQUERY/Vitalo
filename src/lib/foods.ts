import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Food } from "@/db/schema";
import { ApiError } from "./api";
import { resolveBrandFor } from "./brands";
import { publicImageUrl } from "./food-images";

const QUALITY_RANK = sql`case quality when 'verified' then 3 when 'community' then 2 when 'unverified' then 1 else 0 end`;

/**
 * Full-text (German stemming) plus trigram similarity for typos, ranked by quality,
 * popularity and match. Suspect foods are hidden; private foods only for their creator (DB-02, DB-04).
 */
export async function searchFoods(q: string, userId: string | null, limit = 25): Promise<Food[]> {
  const term = q.trim().slice(0, 80);
  if (term.length < 2) return [];
  // All language variants (incl. de-CH "Pouletbrust") take part through word similarity.
  const allNames = sql`(f.name || ' ' || coalesce(f.brand, '') || ' ' || coalesce((select string_agg(value, ' ') from jsonb_each_text(f.names)), ''))`;
  const rows = await db.execute<Food & { score: number }>(sql`
    select f.*,
      greatest(similarity(f.name, ${term}), word_similarity(${term}, ${allNames})) * 2
      + ts_rank(f.search, websearch_to_tsquery('german', ${term}))
      + ${QUALITY_RANK} * 0.15
      + least(f.confirmations, 20) * 0.01 as score
    from foods f
    where (f.quality <> 'suspect' or f.created_by = ${userId})
      and (not f.is_private or f.created_by = ${userId})
      and (
        f.search @@ websearch_to_tsquery('german', ${term})
        or ${term} <% ${allNames}
        or ${allNames} ilike ${"%" + term + "%"}
        or (select bool_and(${allNames} ilike '%' || word || '%') from unnest(string_to_array(${term}, ' ')) as word where length(word) >= 2)
        or f.barcode = ${term}
      )
    order by score desc
    limit ${limit}
  `);
  return Array.from(rows).map(toFood);
}

/** Raw SQL returns snake_case columns; map them onto the typed row. */
function toFood(row: Record<string, unknown>): Food {
  const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
  return {
    id: String(row.id), source: row.source as Food["source"], sourceRef: (row.source_ref as string) ?? null, name: String(row.name),
    names: (row.names as Record<string, string>) ?? {}, brand: (row.brand as string) ?? null, brandId: (row.brand_id as string) ?? null,
    barcode: (row.barcode as string) ?? null, imageUrl: (row.image_url as string) ?? null, imageMediaId: (row.image_media_id as string) ?? null, servingG: num(row.serving_g),
    kcal100: Number(row.kcal_100), protein100: num(row.protein_100), carbs100: num(row.carbs_100), fat100: num(row.fat_100),
    fiber100: num(row.fiber_100), sugar100: num(row.sugar_100), salt100: num(row.salt_100), quality: row.quality as Food["quality"],
    createdBy: (row.created_by as string) ?? null, isPrivate: Boolean(row.is_private), servings: (row.servings as Food["servings"]) ?? [],
    nutrients: (row.nutrients as Record<string, number>) ?? {}, confirmations: Number(row.confirmations ?? 0), reports: Number(row.reports ?? 0),
    createdAt: new Date(row.created_at as string), updatedAt: new Date(row.updated_at as string),
  };
}

export type Per100 = { kcal: number; protein?: number | null; carbs?: number | null; fat?: number | null; sugar?: number | null; fiber?: number | null; salt?: number | null; alcohol?: number | null };

/** Automatic checks from PRD 7.4: energy must fit the macros (±20 %), totals and sub-values must be possible. */
export function plausibilityIssues(v: Per100): string[] {
  const issues: string[] = [];
  const { protein, carbs, fat } = v;
  if (protein != null && carbs != null && fat != null) {
    const computed = 4 * protein + 4 * carbs + 9 * fat + 7 * (v.alcohol ?? 0);
    if (computed > 20 && Math.abs(computed - v.kcal) / computed > 0.2) issues.push("energy_mismatch");
    if (protein + carbs + fat > 100.5) issues.push("macros_exceed_100g");
  }
  if (v.sugar != null && carbs != null && v.sugar > carbs + 0.1) issues.push("sugar_exceeds_carbs");
  if (v.kcal > 900) issues.push("energy_too_high");
  return issues;
}

const BLOCKED_WORDS = /\b(fuck|scheisse|scheiße|shit|nazi|hitler|porn|sex)\b/i;

export const contributionInput = z.object({
  name: z.string().trim().min(2).max(120),
  brand: z.string().trim().max(80).nullable().optional(),
  barcode: z.string().regex(/^\d{8,14}$/).nullable().optional(),
  isPrivate: z.boolean().default(false),
  per100: z.object({
    kcal: z.number().min(0).max(950),
    protein: z.number().min(0).max(100).nullable().optional(),
    carbs: z.number().min(0).max(100).nullable().optional(),
    fat: z.number().min(0).max(100).nullable().optional(),
    fiber: z.number().min(0).max(100).nullable().optional(),
    sugar: z.number().min(0).max(100).nullable().optional(),
    salt: z.number().min(0).max(100).nullable().optional(),
  }),
  servings: z.array(z.object({ unit: z.string().max(20), grams: z.number().positive().max(5000) })).max(10).default([]),
});

/**
 * A user's new food (DB-03/05). Usable by its creator at once; visible to everyone as
 * "unverified" if it passes the checks, otherwise held as "suspect" for the editors.
 */
export async function contributeFood(userId: string, input: z.infer<typeof contributionInput>): Promise<{ food: Food; issues: string[] }> {
  if (BLOCKED_WORDS.test(input.name) || BLOCKED_WORDS.test(input.brand ?? "")) throw new ApiError(422, "inappropriate_name");
  if (input.barcode && !input.isPrivate) {
    const [existing] = await db.select().from(schema.foods).where(and(eq(schema.foods.barcode, input.barcode), eq(schema.foods.isPrivate, false))).limit(1);
    if (existing) throw new ApiError(409, "barcode_exists", existing.id);
  }
  const issues = plausibilityIssues(input.per100);
  const brand = input.brand ? await resolveBrandFor(input.brand).catch(() => null) : null;
  const [food] = await db
    .insert(schema.foods)
    .values({
      source: "user",
      name: input.name,
      names: {},
      brand: brand?.shownName ?? input.brand ?? null,
      brandId: brand?.brand.id ?? null,
      barcode: input.barcode ?? null,
      kcal100: input.per100.kcal,
      protein100: input.per100.protein ?? null,
      carbs100: input.per100.carbs ?? null,
      fat100: input.per100.fat ?? null,
      fiber100: input.per100.fiber ?? null,
      sugar100: input.per100.sugar ?? null,
      salt100: input.per100.salt ?? null,
      servings: input.servings,
      servingG: input.servings[0]?.grams ?? null,
      quality: issues.length ? "suspect" : "unverified",
      createdBy: userId,
      isPrivate: input.isPrivate,
    })
    .returning();
  return { food, issues };
}

const within5 = (a: number | null | undefined, b: number | null | undefined) =>
  a == null || b == null ? true : Math.abs(a - b) <= Math.max(Math.abs(b) * 0.05, 0.5);

/**
 * "Thumbs up" with the values the person sees on the pack. Three matching confirmations
 * (within 5 %) from different people promote a food to "community confirmed" (PRD 7.2).
 */
export async function confirmFood(userId: string, foodId: string, values: Per100): Promise<{ quality: Food["quality"]; confirmations: number }> {
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, foodId)).limit(1);
  if (!food || (food.isPrivate && food.createdBy !== userId)) throw new ApiError(404, "not_found");
  if (food.createdBy === userId) throw new ApiError(422, "cannot_confirm_own_food");
  await db
    .insert(schema.foodConfirmations)
    .values({ foodId, userId, kcal100: values.kcal, protein100: values.protein ?? null, carbs100: values.carbs ?? null, fat100: values.fat ?? null })
    .onConflictDoUpdate({
      target: [schema.foodConfirmations.foodId, schema.foodConfirmations.userId],
      set: { kcal100: values.kcal, protein100: values.protein ?? null, carbs100: values.carbs ?? null, fat100: values.fat ?? null, createdAt: new Date() },
    });
  const all = await db.select().from(schema.foodConfirmations).where(eq(schema.foodConfirmations.foodId, foodId));
  const matching = all.filter((c) => within5(c.kcal100, food.kcal100) && within5(c.protein100, food.protein100) && within5(c.carbs100, food.carbs100) && within5(c.fat100, food.fat100));
  let quality = food.quality;
  if (matching.length >= 3 && (food.quality === "unverified" || food.quality === "suspect") && plausibilityIssues({ kcal: food.kcal100, protein: food.protein100, carbs: food.carbs100, fat: food.fat100, sugar: food.sugar100 }).length === 0) {
    quality = "community";
  }
  // Disagreeing values become a correction proposal for review (DB-06, DB-07).
  if (!within5(values.kcal, food.kcal100) || !within5(values.protein, food.protein100) || !within5(values.carbs, food.carbs100) || !within5(values.fat, food.fat100)) {
    await db.insert(schema.foodRevisions).values({
      foodId,
      userId,
      changes: { kcal100: values.kcal, protein100: values.protein ?? null, carbs100: values.carbs ?? null, fat100: values.fat ?? null },
      previous: { kcal100: food.kcal100, protein100: food.protein100, carbs100: food.carbs100, fat100: food.fat100 },
    });
  }
  await db.update(schema.foods).set({ quality, confirmations: matching.length, updatedAt: new Date() }).where(eq(schema.foods.id, foodId));
  return { quality, confirmations: matching.length };
}

/** Applies a correction. Verified foods only change through an editor (PRD 7.5). */
export async function applyRevision(revisionId: string, adminId: string | null): Promise<void> {
  const [revision] = await db.select().from(schema.foodRevisions).where(eq(schema.foodRevisions.id, revisionId)).limit(1);
  if (!revision || revision.status !== "pending") return;
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, revision.foodId)).limit(1);
  if (!food) return;
  if (food.quality === "verified" && !adminId) throw new ApiError(403, "verified_requires_editor");
  const changes = revision.changes as Partial<Record<"kcal100" | "protein100" | "carbs100" | "fat100", number | null>>;
  await db.update(schema.foods).set({ ...changes, kcal100: changes.kcal100 ?? food.kcal100, updatedAt: new Date() }).where(eq(schema.foods.id, food.id));
  await db.update(schema.foodRevisions).set({ status: "applied", adminId, decidedAt: new Date() }).where(eq(schema.foodRevisions.id, revisionId));
}

export function foodDTO(food: Food) {
  return {
    id: food.id,
    name: food.name,
    names: food.names,
    brand: food.brand,
    barcode: food.barcode,
    imageUrl: publicImageUrl(food.imageUrl),
    quality: food.quality,
    source: food.source,
    isPrivate: food.isPrivate,
    servings: food.servings.length ? food.servings : food.servingG ? [{ unit: "portion", grams: food.servingG }] : [],
    per100: { kcal: food.kcal100, protein: food.protein100, carbs: food.carbs100, fat: food.fat100, fiber: food.fiber100, sugar: food.sugar100, salt: food.salt100 },
  };
}
