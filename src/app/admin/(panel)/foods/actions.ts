"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, requireAdmin } from "@/lib/admin";
import { brandKey } from "@/lib/brands";
import { replaceFoodImage } from "@/lib/food-images";
import { formImage, MediaError, removeMedia } from "@/lib/media";
import { applyRevision, plausibilityIssues } from "@/lib/foods";
import { issueText, LANGUAGES } from "./quality";

export type FoodFormState = { error?: string; saved?: boolean };

const optional = z.preprocess((v) => (v === "" || v === null || v === undefined ? null : v), z.coerce.number().min(0, "Werte dürfen nicht negativ sein.").max(1000).nullable());
const text = (max: number) => z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(max)).transform((v) => v || null);

const foodForm = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(160),
  brand: text(80),
  barcode: z.string().trim().regex(/^(\d{8}|\d{12,14})?$/, "Barcode: 8 oder 12–14 Ziffern.").transform((v) => v || null),
  kcal100: z.coerce.number({ message: "Bitte Kalorien angeben." }).min(0).max(900, "Mehr als 900 kcal pro 100 g ist nicht möglich."),
  protein100: optional,
  carbs100: optional,
  fat100: optional,
  fiber100: optional,
  sugar100: optional,
  salt100: optional,
  servingG: optional,
  quality: z.enum(["verified", "community", "unverified", "suspect"]),
});

type FoodValues = z.infer<typeof foodForm> & { names: Record<string, string>; servings: { unit: string; grams: number }[]; brandId: string | null };

/** Reads the shared form: values, translations and portion sizes. */
async function readFood(formData: FormData): Promise<{ values?: FoodValues; error?: string }> {
  const parsed = foodForm.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Ungültige Eingabe." };
  const names: Record<string, string> = {};
  for (const lang of LANGUAGES) {
    const value = String(formData.get(`name_${lang.code}`) ?? "").trim();
    if (value) names[lang.code] = value.slice(0, 160);
  }
  const units = formData.getAll("serving_unit").map(String);
  const grams = formData.getAll("serving_grams").map(String);
  const servings: { unit: string; grams: number }[] = [];
  for (const [i, unit] of units.entries()) {
    const g = Number(grams[i]);
    if (unit.trim() && g > 0 && g <= 5000) servings.push({ unit: unit.trim().slice(0, 30), grams: Math.round(g * 10) / 10 });
  }
  const issues = plausibilityIssues({ kcal: parsed.data.kcal100, protein: parsed.data.protein100, carbs: parsed.data.carbs100, fat: parsed.data.fat100, sugar: parsed.data.sugar100, fiber: parsed.data.fiber100, salt: parsed.data.salt100 });
  if (issues.length && parsed.data.quality === "verified") return { error: `Nicht plausibel, daher nicht als geprüft speicherbar: ${issueText(issues)}.` };
  let brandId: string | null = null;
  if (parsed.data.brand) {
    const key = brandKey(parsed.data.brand);
    const [byName] = await db.select({ id: schema.brands.id }).from(schema.brands).where(eq(schema.brands.nameKey, key));
    const [byAlias] = byName ? [byName] : await db.select({ id: schema.brandAliases.brandId }).from(schema.brandAliases).where(eq(schema.brandAliases.aliasKey, key));
    brandId = byAlias?.id ?? null;
  }
  return { values: { ...parsed.data, names, servings, brandId } };
}

/** Applies the photo field: a new upload replaces the old one, "remove" clears it. */
async function applyImage(foodId: string, formData: FormData): Promise<string | null> {
  try {
    const changed = await replaceFoodImage(foodId, await formImage(formData.get("image")), formData.get("remove_image") === "on");
    return changed ? "image" : null;
  } catch (error) {
    if (error instanceof MediaError) throw error;
    console.error(error);
    throw new MediaError("Das Bild konnte nicht gespeichert werden.");
  }
}

function refresh(id?: string) {
  revalidatePath("/admin/foods");
  if (id) revalidatePath(`/admin/foods/${id}`);
  revalidatePath("/admin", "layout");
}

export async function createFoodAction(_: FoodFormState, formData: FormData): Promise<FoodFormState> {
  const admin = await requireAdmin("foods");
  const { values, error } = await readFood(formData);
  if (!values) return { error };
  if (values.barcode) {
    const [taken] = await db.select({ id: schema.foods.id }).from(schema.foods).where(eq(schema.foods.barcode, values.barcode));
    if (taken) return { error: "Für diesen Barcode gibt es schon einen Eintrag." };
  }
  const [food] = await db.insert(schema.foods).values({ ...values, source: "editorial" }).returning();
  try {
    await applyImage(food.id, formData);
  } catch (error) {
    return { error: `Gespeichert, aber ohne Bild: ${(error as Error).message}` };
  }
  await audit(admin.id, "food.create", "food", food.id, { name: food.name });
  refresh();
  redirect(`/admin/foods/${food.id}?created=1`);
}

/** Editor changes are stored as an applied revision, so the history shows every value ever set. */
export async function saveFoodAction(_: FoodFormState, formData: FormData): Promise<FoodFormState> {
  const admin = await requireAdmin("foods");
  const id = z.uuid().parse(formData.get("id"));
  const { values, error } = await readFood(formData);
  if (!values) return { error };
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, id));
  if (!food) return { error: "Das Lebensmittel gibt es nicht mehr." };
  const changes: Record<string, unknown> = {};
  const previous: Record<string, unknown> = {};
  for (const key of Object.keys(values) as (keyof FoodValues)[]) {
    if (JSON.stringify(food[key]) !== JSON.stringify(values[key])) {
      changes[key] = values[key];
      previous[key] = food[key];
    }
  }
  let imageChanged: string | null;
  try {
    imageChanged = await applyImage(id, formData);
  } catch (error) {
    return { error: (error as Error).message };
  }
  if (imageChanged) {
    changes.image = formData.get("remove_image") === "on" ? "entfernt" : "neu hochgeladen";
  }
  if (!Object.keys(changes).length) return { saved: true };
  await db.update(schema.foods).set({ ...values, updatedAt: new Date() }).where(eq(schema.foods.id, id));
  await db.insert(schema.foodRevisions).values({ foodId: id, adminId: admin.id, changes, previous, status: "applied", decidedAt: new Date() });
  await audit(admin.id, "food.update", "food", id, { fields: Object.keys(changes) });
  refresh(id);
  return { saved: true };
}

/** Diary entries keep their own copy of name and values, so deleting a food never changes past days. */
export async function deleteFoodAction(formData: FormData) {
  const admin = await requireAdmin("foods");
  const id = z.uuid().parse(formData.get("id"));
  const [food] = await db.delete(schema.foods).where(eq(schema.foods.id, id)).returning();
  if (food?.imageMediaId) await removeMedia(food.imageMediaId);
  if (food) await audit(admin.id, "food.delete", "food", id, { name: food.name });
  refresh();
  redirect("/admin/foods?deleted=1");
}

const bulkInput = z.object({ ids: z.array(z.uuid()).min(1).max(200), op: z.enum(["verified", "community", "unverified", "suspect", "delete"]) });

export async function bulkFoodAction(formData: FormData): Promise<{ message?: string; error?: string }> {
  const admin = await requireAdmin("foods");
  const parsed = bulkInput.safeParse({ ids: formData.getAll("ids").map(String), op: formData.get("op") });
  if (!parsed.success) return { error: "Bitte zuerst Einträge auswählen." };
  const { ids, op } = parsed.data;
  if (op === "delete") {
    const deleted = await db.delete(schema.foods).where(inArray(schema.foods.id, ids)).returning({ id: schema.foods.id, imageMediaId: schema.foods.imageMediaId });
    for (const food of deleted) if (food.imageMediaId) await removeMedia(food.imageMediaId);
    await audit(admin.id, "food.delete", "food", undefined, { count: deleted.length, ids });
    refresh();
    return { message: `${deleted.length} ${deleted.length === 1 ? "Eintrag" : "Einträge"} gelöscht.` };
  }
  if (op === "verified") {
    const foods = await db.select().from(schema.foods).where(inArray(schema.foods.id, ids));
    const implausible = foods.filter((f) => plausibilityIssues({ kcal: f.kcal100, protein: f.protein100, carbs: f.carbs100, fat: f.fat100, sugar: f.sugar100, fiber: f.fiber100, salt: f.salt100 }).length);
    if (implausible.length) return { error: `${implausible.length} der Einträge sind nicht plausibel und können nicht als geprüft markiert werden.` };
  }
  await db.update(schema.foods).set({ quality: op, updatedAt: new Date() }).where(inArray(schema.foods.id, ids));
  await audit(admin.id, "food.quality", "food", undefined, { count: ids.length, to: op });
  refresh();
  return { message: `Qualität für ${ids.length} ${ids.length === 1 ? "Eintrag" : "Einträge"} geändert.` };
}

export async function setQualityAction(formData: FormData) {
  const admin = await requireAdmin("foods");
  const { id, quality } = z.object({ id: z.uuid(), quality: z.enum(["verified", "community", "unverified", "suspect"]) }).parse(Object.fromEntries(formData.entries()));
  const [food] = await db.select().from(schema.foods).where(eq(schema.foods.id, id));
  if (!food) return;
  await db.update(schema.foods).set({ quality, reports: quality === "suspect" ? food.reports : 0, updatedAt: new Date() }).where(eq(schema.foods.id, id));
  if (quality !== "suspect") {
    await db
      .update(schema.reports)
      .set({ status: "actioned", resolvedBy: admin.id, resolvedAt: new Date() })
      .where(and(eq(schema.reports.targetType, "food"), eq(schema.reports.targetId, id), eq(schema.reports.status, "open")));
  }
  await db.insert(schema.foodRevisions).values({ foodId: id, adminId: admin.id, changes: { quality }, previous: { quality: food.quality }, status: "applied", decidedAt: new Date() });
  await audit(admin.id, "food.quality", "food", id, { from: food.quality, to: quality });
  refresh(id);
}

export async function revisionAction(formData: FormData) {
  const admin = await requireAdmin("foods");
  const { revisionId, decision } = z.object({ revisionId: z.uuid(), decision: z.enum(["apply", "reject"]) }).parse(Object.fromEntries(formData.entries()));
  const [revision] = await db.select().from(schema.foodRevisions).where(eq(schema.foodRevisions.id, revisionId));
  if (!revision) return;
  if (decision === "apply") {
    await applyRevision(revisionId, admin.id);
  } else {
    await db.update(schema.foodRevisions).set({ status: "rejected", adminId: admin.id, decidedAt: new Date() }).where(eq(schema.foodRevisions.id, revisionId));
  }
  await audit(admin.id, decision === "apply" ? "food.revision_applied" : "food.revision_rejected", "food", revision.foodId, { revisionId });
  refresh(revision.foodId);
}

/**
 * Merges a duplicate into the food that stays: diary entries, confirmations and corrections
 * move over, then the duplicate is removed. Past diary values never change (entries keep snapshots).
 */
export async function mergeFoodAction(formData: FormData) {
  const admin = await requireAdmin("foods");
  const { id, intoId } = z.object({ id: z.uuid(), intoId: z.uuid() }).parse(Object.fromEntries(formData.entries()));
  if (id === intoId) return;
  const [[source], [target]] = await Promise.all([
    db.select().from(schema.foods).where(eq(schema.foods.id, id)),
    db.select().from(schema.foods).where(eq(schema.foods.id, intoId)),
  ]);
  if (!source || !target) return;
  await db.transaction(async (tx) => {
    await tx.update(schema.mealEntries).set({ foodId: intoId }).where(eq(schema.mealEntries.foodId, id));
    await tx.execute(sql`insert into food_confirmations (food_id, user_id, kcal_100, protein_100, carbs_100, fat_100, created_at)
      select ${intoId}, user_id, kcal_100, protein_100, carbs_100, fat_100, created_at from food_confirmations where food_id = ${id}
      on conflict do nothing`);
    await tx.delete(schema.foodConfirmations).where(eq(schema.foodConfirmations.foodId, id));
    await tx.update(schema.foodRevisions).set({ foodId: intoId }).where(eq(schema.foodRevisions.foodId, id));
    await tx.update(schema.reports).set({ targetId: intoId }).where(and(eq(schema.reports.targetType, "food"), eq(schema.reports.targetId, id)));
    if (!target.barcode && source.barcode) await tx.update(schema.foods).set({ barcode: source.barcode }).where(eq(schema.foods.id, intoId));
    await tx.delete(schema.foods).where(eq(schema.foods.id, id));
  });
  await audit(admin.id, "food.merge", "food", intoId, { merged: id, name: source.name });
  refresh();
  redirect(`/admin/foods/${intoId}?merged=1`);
}
