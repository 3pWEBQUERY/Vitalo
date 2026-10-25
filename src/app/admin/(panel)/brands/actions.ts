"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db, schema } from "@/db";
import { BrandError, createBrand, deleteBrand, refreshBrandLogo, updateBrand, type BrandInput } from "@/lib/brands";
import { audit, requireAdmin } from "@/lib/admin";
import { formImage, MediaError, removeMedia, saveImage } from "@/lib/media";

export type FormState = { error?: string; saved?: boolean };

const brandForm = z.object({
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(80, "Der Name ist zu lang."),
  domain: z.string().trim().max(120).default(""),
  aliases: z.string().max(2000).default(""),
  isHidden: z.boolean(),
  lookupLogo: z.boolean(),
});

function parseBrand(formData: FormData): BrandInput {
  const parsed = brandForm.safeParse({
    name: formData.get("name") ?? "",
    domain: formData.get("domain") ?? "",
    aliases: formData.get("aliases") ?? "",
    isHidden: formData.get("isHidden") === "on",
    lookupLogo: formData.get("lookupLogo") === "on",
  });
  if (!parsed.success) throw new BrandError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  return {
    ...parsed.data,
    aliases: parsed.data.aliases.split(/\r?\n|,/).map((a) => a.trim()).filter(Boolean),
  };
}

/** Uploaded icon and wordmark replace earlier uploads; the old files are removed. */
async function applyUploads(brandId: string, formData: FormData): Promise<void> {
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, brandId)).limit(1);
  if (!brand) return;
  for (const [field, purpose, column] of [
    ["icon", "brand_icon", "customIconId"],
    ["logo", "brand_logo", "customLogoId"],
  ] as const) {
    const bytes = await formImage(formData.get(field));
    const remove = formData.get(`remove_${field}`) === "on";
    if (!bytes && !remove) continue;
    const previous = brand[column];
    const media = bytes ? await saveImage(bytes, purpose) : null;
    await db.update(schema.brands).set({ [column]: media?.id ?? null, updatedAt: new Date() }).where(eq(schema.brands.id, brandId));
    if (previous) await removeMedia(previous);
  }
}

function message(error: unknown): string {
  if (error instanceof BrandError || error instanceof MediaError) return error.message;
  console.error(error);
  return "Das hat nicht geklappt. Bitte erneut versuchen.";
}

export async function createBrandAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("brands");
  let id: string;
  try {
    const input = parseBrand(formData);
    const brand = await createBrand(input);
    await applyUploads(brand.id, formData);
    await audit(admin.id, "brand.create", "brand", brand.id, { name: input.name });
    id = brand.id;
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/admin/brands");
  redirect(`/admin/brands/${id}?created=1`);
}

export async function updateBrandAction(_: FormState, formData: FormData): Promise<FormState> {
  const admin = await requireAdmin("brands");
  const id = z.uuid().parse(formData.get("id"));
  try {
    const input = parseBrand(formData);
    await updateBrand(id, input);
    await applyUploads(id, formData);
    await audit(admin.id, "brand.update", "brand", id, { name: input.name, aliases: input.aliases.length });
  } catch (error) {
    return { error: message(error) };
  }
  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${id}`);
  return { saved: true };
}

export async function deleteBrandAction(formData: FormData): Promise<void> {
  const admin = await requireAdmin("brands");
  const id = z.uuid().parse(formData.get("id"));
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id));
  await deleteBrand(id);
  await audit(admin.id, "brand.delete", "brand", id, { name: brand?.name });
  revalidatePath("/admin/brands");
  redirect("/admin/brands?deleted=1");
}

export async function refreshBrandAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("brands");
  const id = z.uuid().parse(formData.get("id"));
  await refreshBrandLogo(id);
  await audit(admin.id, "brand.refresh_logo", "brand", id);
  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${id}`);
  return { message: "Logo neu gesucht." };
}

export async function toggleHiddenAction(formData: FormData): Promise<{ message: string }> {
  const admin = await requireAdmin("brands");
  const id = z.uuid().parse(formData.get("id"));
  await audit(admin.id, formData.get("hidden") === "true" ? "brand.hide" : "brand.show", "brand", id);
  await db
    .update(schema.brands)
    .set({ isHidden: formData.get("hidden") === "true", source: "manual", updatedAt: new Date() })
    .where(eq(schema.brands.id, id));
  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${id}`);
  return { message: formData.get("hidden") === "true" ? "Logo ausgeblendet." : "Logo eingeblendet." };
}

const bulkInput = z.object({ ids: z.array(z.uuid()).min(1).max(200), op: z.enum(["hide", "show", "refresh", "delete"]) });

export async function bulkBrandAction(formData: FormData): Promise<{ message?: string; error?: string }> {
  const admin = await requireAdmin("brands");
  const parsed = bulkInput.safeParse({ ids: formData.getAll("ids").map(String), op: formData.get("op") });
  if (!parsed.success) return { error: "Bitte zuerst Marken auswählen." };
  const { ids, op } = parsed.data;
  if (op === "delete") {
    for (const id of ids) await deleteBrand(id);
  } else if (op === "refresh") {
    for (const id of ids) await refreshBrandLogo(id);
  } else {
    await db.update(schema.brands).set({ isHidden: op === "hide", source: "manual", updatedAt: new Date() }).where(inArray(schema.brands.id, ids));
  }
  await audit(admin.id, op === "delete" ? "brand.delete" : op === "refresh" ? "brand.refresh_logo" : op === "hide" ? "brand.hide" : "brand.show", "brand", undefined, { count: ids.length, ids });
  revalidatePath("/admin/brands");
  const n = ids.length;
  const noun = n === 1 ? "Marke" : "Marken";
  return { message: { delete: `${n} ${noun} gelöscht.`, refresh: `Logos für ${n} ${noun} neu gesucht.`, hide: `${n} ${noun} ausgeblendet.`, show: `${n} ${noun} eingeblendet.` }[op] };
}
