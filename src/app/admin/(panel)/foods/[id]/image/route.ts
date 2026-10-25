import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db, schema } from "@/db";
import { audit, canAccess, currentAdmin, twoFactorRequired } from "@/lib/admin";
import { replaceFoodImage } from "@/lib/food-images";
import { MediaError } from "@/lib/media";

/**
 * Product photo upload for an existing food, called right after a file is chosen in the editor.
 * A plain request instead of the form's server action, so the photo is stored straight away.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(request, context, "upload");
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return handle(request, context, "remove");
}

async function handle(request: Request, context: { params: Promise<{ id: string }> }, mode: "upload" | "remove") {
  const fail = (status: number, error: string) => NextResponse.json({ error }, { status });
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) return fail(403, "Nicht erlaubt.");

  const session = await currentAdmin();
  if (!session) return fail(401, "Bitte erneut anmelden.");
  const { admin } = session;
  if (twoFactorRequired() && !admin.totpEnabled) return fail(403, "Bitte zuerst die Zwei-Faktor-Anmeldung einrichten.");
  if (!canAccess(admin.role, "foods")) return fail(403, "Keine Berechtigung für Lebensmittel.");

  const id = z.uuid().safeParse((await context.params).id);
  if (!id.success) return fail(404, "Das Lebensmittel gibt es nicht.");
  const [food] = await db.select({ id: schema.foods.id }).from(schema.foods).where(eq(schema.foods.id, id.data));
  if (!food) return fail(404, "Das Lebensmittel gibt es nicht mehr.");

  let upload: Uint8Array | null = null;
  if (mode === "upload") {
    const file = (await request.formData().catch(() => null))?.get("image");
    if (!file || typeof file === "string" || file.size === 0) return fail(400, "Bitte ein Bild auswählen.");
    upload = new Uint8Array(await file.arrayBuffer());
  }
  try {
    const result = await replaceFoodImage(food.id, upload, mode === "remove");
    await audit(admin.id, "food.update", "food", food.id, { fields: ["image"] });
    revalidatePath("/admin/foods");
    revalidatePath(`/admin/foods/${food.id}`);
    return NextResponse.json({ imageUrl: result?.imageUrl ?? null });
  } catch (error) {
    if (error instanceof MediaError) return fail(400, error.message);
    console.error("food image upload failed", error);
    return fail(500, "Das Bild konnte nicht gespeichert werden.");
  }
}
