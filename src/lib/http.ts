import type { NextRequest } from "next/server";

/** Origin the app can reach, also behind Railway's proxy. */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.PUBLIC_URL;
  if (configured) return configured.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? request.nextUrl.host;
  const protocol = request.headers.get("x-forwarded-proto") ?? request.nextUrl.protocol.replace(":", "");
  return `${protocol}://${host}`;
}
