import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import type { Food } from "@/db/schema";
import { primaryBrand, resolveBrandFor } from "./brands";

/** Cached products are refreshed from Open Food Facts after a week. */
const REFRESH_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const USER_AGENT = "Vitalo/1.0 (contact@vitalo.app)";
const LANGUAGES = ["de", "fr", "it", "en", "es"] as const;
const barcodeIsSet = sql`barcode is not null`;

const optionalNumber = z.union([z.number(), z.string()]).nullable().optional().transform((value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
});

const offProduct = z.object({
  status: z.number(),
  product: z
    .object({
      product_name: z.string().optional(),
      brands: z.string().optional(),
      serving_quantity: optionalNumber,
      image_front_url: z.string().optional(),
      image_url: z.string().optional(),
      nutriments: z
        .object({
          "energy-kcal_100g": optionalNumber,
          proteins_100g: optionalNumber,
          carbohydrates_100g: optionalNumber,
          fat_100g: optionalNumber,
          fiber_100g: optionalNumber,
          sugars_100g: optionalNumber,
          salt_100g: optionalNumber,
        })
        .partial()
        .optional(),
    })
    .catchall(z.unknown())
    .optional(),
});

export function isBarcode(value: string): boolean {
  return /^\d{8,14}$/.test(value);
}

/** Local database first, then Open Food Facts. Returns null when the product is unknown. */
export async function productByBarcode(barcode: string): Promise<Food | null> {
  const [cached] = await db.select().from(schema.foods).where(eq(schema.foods.barcode, barcode)).limit(1);
  if (cached && (cached.source !== "off" || Date.now() - cached.updatedAt.getTime() < REFRESH_AFTER_MS)) return cached;

  const fields = ["product_name", ...LANGUAGES.map((l) => `product_name_${l}`), "brands", "serving_quantity", "nutriments", "image_front_url", "image_url"];
  const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}?fields=${fields.join(",")}`, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!response?.ok) return cached ?? null;
  const parsed = offProduct.safeParse(await response.json());
  const product = parsed.success ? parsed.data.product : undefined;
  const kcal = product?.nutriments?.["energy-kcal_100g"];
  if (!parsed.success || parsed.data.status !== 1 || !product || kcal == null) return cached ?? null;

  const names: Record<string, string> = {};
  for (const language of LANGUAGES) {
    const value = product[`product_name_${language}`];
    if (typeof value === "string" && value.trim()) names[language] = value.trim();
  }
  const resolved = product.brands?.trim() ? await resolveBrandFor(product.brands).catch(() => null) : null;
  const brand = resolved?.brand ?? null;
  const brandName = resolved?.shownName ?? primaryBrand(product.brands);

  const values = {
    source: "off" as const,
    sourceRef: barcode,
    name: product.product_name?.trim() || names.en || names.de || barcode,
    names,
    brand: brandName,
    brandId: brand?.id ?? null,
    barcode,
    imageUrl: product.image_front_url ?? product.image_url ?? null,
    servingG: product.serving_quantity && product.serving_quantity > 0 ? product.serving_quantity : null,
    kcal100: kcal,
    protein100: product.nutriments?.proteins_100g ?? null,
    carbs100: product.nutriments?.carbohydrates_100g ?? null,
    fat100: product.nutriments?.fat_100g ?? null,
    fiber100: product.nutriments?.fiber_100g ?? null,
    sugar100: product.nutriments?.sugars_100g ?? null,
    salt100: product.nutriments?.salt_100g ?? null,
    quality: "community" as const,
    updatedAt: new Date(),
  };
  const [saved] = await db
    .insert(schema.foods)
    .values(values)
    .onConflictDoUpdate({ target: schema.foods.barcode, targetWhere: barcodeIsSet, set: values })
    .returning();
  return saved;
}
