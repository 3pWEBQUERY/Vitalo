import { NextResponse, type NextRequest } from "next/server";

/**
 * First gate for the admin area: without a session cookie everything except the sign-in
 * pages goes to /admin/login. Pages and server actions check the session itself, the role
 * and two-factor sign-in (src/lib/admin.ts).
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const signingIn = pathname === "/admin/login" || pathname.startsWith("/admin/login/");
  const response = signingIn || request.cookies.has("vitalo_admin")
    ? NextResponse.next()
    : NextResponse.redirect(new URL("/admin/login", request.url));
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "same-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
