import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { db, schema } from "@/db";
import { readMedia } from "@/lib/media";

const UUID = /^[0-9a-f-]{36}$/i;
const CACHE = "public, max-age=604800, stale-while-revalidate=86400";

/**
 * Serves a brand's square icon (or wide logo with ?kind=logo). An uploaded image wins over
 * the provider's; the provider is fetched through this server so its key never reaches the app.
 */
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  if (!UUID.test(id)) return new NextResponse(null, { status: 404 });
  const [brand] = await db.select().from(schema.brands).where(eq(schema.brands.id, id)).limit(1);
  if (!brand || brand.isHidden) return new NextResponse(null, { status: 404 });
  const kind = request.nextUrl.searchParams.get("kind") === "logo" ? "logo" : "icon";

  const customId = kind === "logo" ? brand.customLogoId : brand.customIconId;
  if (customId) {
    const file = await readMedia(customId);
    if (file) {
      return new NextResponse(Buffer.from(file.bytes), { headers: { "Content-Type": file.media.contentType, "Cache-Control": CACHE } });
    }
  }

  const source = kind === "logo" ? brand.logoUrl : brand.iconUrl;
  if (!source) return new NextResponse(null, { status: 404 });
  const upstream = await fetch(source, { signal: AbortSignal.timeout(8000), redirect: "manual" }).catch(() => null);
  const type = upstream?.headers.get("content-type") ?? "";
  if (!upstream?.ok || !type.startsWith("image/")) return new NextResponse(null, { status: 404 });
  return new NextResponse(upstream.body, { headers: { "Content-Type": type, "Cache-Control": CACHE } });
}
