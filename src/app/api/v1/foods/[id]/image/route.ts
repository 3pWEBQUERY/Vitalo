import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db, schema } from "@/db";
import { readMedia } from "@/lib/media";

/** Product photo uploaded by the editorial team. Public like the packaging it shows. */
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const [food] = await db.select({ imageMediaId: schema.foods.imageMediaId, isPrivate: schema.foods.isPrivate }).from(schema.foods).where(eq(schema.foods.id, id));
  if (!food?.imageMediaId || food.isPrivate) return new NextResponse(null, { status: 404 });
  const file = await readMedia(food.imageMediaId);
  if (!file) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(file.bytes), {
    headers: { "Content-Type": file.media.contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
