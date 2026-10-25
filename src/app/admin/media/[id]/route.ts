import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { canAccess, currentAdmin } from "@/lib/admin";
import { getObject } from "@/lib/storage";

/**
 * Community images for moderators: post pictures and avatars only. Progress photos and
 * label photos stay private and are never shown in the admin area (PRV-09).
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await currentAdmin();
  if (!session || !canAccess(session.admin.role, "moderation")) return new NextResponse(null, { status: 404 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 404 });
  const [media] = await db.select().from(schema.media).where(eq(schema.media.id, id));
  if (!media || media.purpose !== "post") return new NextResponse(null, { status: 404 });
  const thumb = request.nextUrl.searchParams.get("size") === "thumb";
  const bytes = (thumb ? await getObject(`${media.storageKey}.thumb.jpg`) : null) ?? (await getObject(media.storageKey));
  if (!bytes) return new NextResponse(null, { status: 404 });
  return new NextResponse(Buffer.from(bytes), { headers: { "Content-Type": thumb ? "image/jpeg" : media.contentType, "Cache-Control": "private, max-age=3600" } });
}
