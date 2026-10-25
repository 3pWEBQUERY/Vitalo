import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { brandDTO, resolveBrandFor } from "@/lib/brands";
import { isBarcode, productByBarcode } from "@/lib/off";
import { publicOrigin } from "@/lib/http";
import { publicImageUrl } from "@/lib/food-images";

/** Barcode lookup for the app: nutrition per 100 g, product photo and the brand's logo. */
export async function GET(request: NextRequest, context: { params: Promise<{ barcode: string }> }) {
  const { barcode } = await context.params;
  if (!isBarcode(barcode)) return NextResponse.json({ error: "invalid_barcode" }, { status: 400 });

  const food = await productByBarcode(barcode);
  if (!food) return NextResponse.json({ error: "not_found" }, { status: 404 });

  let brand = food.brandId ? (await db.select().from(schema.brands).where(eq(schema.brands.id, food.brandId)).limit(1))[0] : undefined;
  if (!brand && food.brand) {
    brand = (await resolveBrandFor(food.brand).catch(() => undefined))?.brand;
    if (brand) await db.update(schema.foods).set({ brandId: brand.id }).where(eq(schema.foods.id, food.id));
  }

  return NextResponse.json({
    barcode: food.barcode,
    name: food.name,
    names: food.names,
    brand: brand ? brandDTO(brand, publicOrigin(request), food.brand ?? undefined) : food.brand ? { id: null, name: food.brand, domain: null, iconUrl: null, logoUrl: null } : null,
    imageUrl: publicImageUrl(food.imageUrl),
    servingGrams: food.servingG,
    per100: {
      kcal: food.kcal100,
      protein: food.protein100,
      carbs: food.carbs100,
      fat: food.fat100,
      fiber: food.fiber100,
      sugar: food.sugar100,
      salt: food.salt100,
    },
    quality: food.quality,
    source: food.source,
  });
}
