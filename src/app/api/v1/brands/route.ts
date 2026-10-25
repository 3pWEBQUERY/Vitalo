import { NextResponse, type NextRequest } from "next/server";
import { brandDTO, resolveBrandFor } from "@/lib/brands";
import { publicOrigin } from "@/lib/http";

/** GET /api/v1/brands?name=ESN → the brand with its logo URLs (resolved once, then cached). */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim();
  if (!name || name.length > 80) return NextResponse.json({ error: "invalid_name" }, { status: 400 });
  const { brand, shownName } = await resolveBrandFor(name);
  return NextResponse.json(brandDTO(brand, publicOrigin(request), shownName));
}
